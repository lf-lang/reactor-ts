import {TimeValue, BinaryTimeValue, UnitBasedTimeValue, TimeUnit} from './time';
import {Socket, createConnection, SocketConnectOpts, Server, createServer} from 'net'
import { EventEmitter } from 'events';

/**
 * Definitions for RTI (Runtime infrastructure).
 * RTI is used for distributed Reactor-ts/Lingua Franca programs.
 */

//---------------------------------------------------------------------//
// Constants                                                           //
//---------------------------------------------------------------------//

/** 
 *  Size of the buffer used for messages sent between federates.
 *  This is used by both the federates and the rti, so message lengths
 *  should generally match.
 */
export const BUFFER_SIZE: number = 256;

/** 
 *  Number of seconds that elapse between a federate's attempts
 *  to connect to the RTI.
 */
export const CONNECT_RETRY_INTERVAL: number = 2;

/** 
 *  Bound on the number of retries to connect to the RTI.
 *  A federate will retry every CONNECT_RETRY_INTERVAL seconds
 *  this many times before giving up. E.g., 500 retries every
 *  2 seconds results in retrying for about 16 minutes.
 */
export const CONNECT_NUM_RETRIES: number = 500;

// Delay the start of all federates by this amount.
const DELAY_START: TimeValue = new UnitBasedTimeValue(1, TimeUnit.sec);

//---------------------------------------------------------------------//
// Enums                                                               //
//---------------------------------------------------------------------//

/**
 * In the C reactor target these message types are encoded as an unsigned char,
 * so to maintain compatability the magnitude must not exceed 255
 */
enum MessageTypes {

    /**
     * Byte Identifying a federate ID message, which is 32 bits long.
     */
    FED_ID = 1,

    /**
     * Byte identifying a timestamp message, which is 64 bits long.
     */
    TIMESTAMP = 2,

    /** 
     *  Byte identifying a message to forward to another federate.
     *  The next two bytes will be the ID of the destination port.
     *  The next two bytes are the destination federate ID.
     *  The four bytes after that will be the length of the message.
     *  The remaining bytes are the message.
     */
    MESSAGE = 3,

    /** 
     * Byte identifying that the federate is ending its execution.
     */
    RESIGN = 4,

    /** 
     *  Byte identifying a timestamped message to forward to another federate.
     *  The next two bytes will be the ID of the destination port.
     *  The next two bytes are the destination federate ID.
     *  The four bytes after that will be the length of the message.
     *  The next eight bytes will be the timestamp.
     *  The remaining bytes are the message.
     */
    TIMED_MESSAGE = 5,

    /** 
     *  Byte identifying a next event time (NET) message sent from a federate.
     *  The next eight bytes will be the timestamp. This message from a
     *  federate tells the RTI the time of the earliest event on that federate's
     *  event queue. In other words, absent any further inputs from other federates,
     *  this will be the logical time of the next set of reactions on that federate.
     */
    NEXT_EVENT_TIME = 6,

    /** 
     *  Byte identifying a time advance grant (TAG) sent to a federate.
     *  The next eight bytes will be the timestamp.
     */
    TIME_ADVANCE_GRANT = 7,

    /** 
     *  Byte identifying a logical time complete (LTC) message sent by a federate
     *  to the RTI. The next eight bytes will be the timestamp.
     */
    LOGICAL_TIME_COMPLETE = 8
}

/**
 * Mode of execution of a federate.
 */
enum ExecutionMode {
    FAST,
    REALTIME
}

/**
 * State of a federate during execution.
 */
enum FedState {
    NOT_CONNECTED,  // The federate has not connected.
    GRANTED,        // Most recent NEXT_EVENT_TIME has been granted.
    PENDING         // Waiting for upstream federates.
}

//---------------------------------------------------------------------//
// Classes                                                             //
//---------------------------------------------------------------------//

/** Information about a federate, including its runtime state,
 *  mode of execution, and connectivity with other federates.
 *  The list of upstream and downstream federates does not include
 *  those that are connected via a "physical" connection (one
 *  denoted with ~>) because those connections do not impose
 *  any scheduling constraints.
 */
export class Federate extends EventEmitter{

    // ID of this federate.
    private id:number;

    // The ID of the thread handling communication with this federate.
    // pthread_t thread_id;              
    
    // The socket descriptor for communicating with this federate.
    private socket: Socket | null = null;

    // The largest logical time completed by the federate
    // (or null if no time has been completed).
    private completed: TimeValue | null = null;

    // Most recent NET received from the federate
    // (or null if no NET has been received).
    private nextEvent: TimeValue | null = null;

    // State of the federate.
    private state: FedState = FedState.NOT_CONNECTED;

    // Array of upstream federate ids.
    private upstream: Array<number> = new Array<number>();

    // Minimum delay on connections from upstream federates.
    private upstreamDelay: TimeValue | null = null;

    // Array of downstream federate ids.
    private downstream: Array<number> = new Array<number>();

    // FAST or REALTIME.
    private executionMode: ExecutionMode = ExecutionMode.REALTIME;

    // Start time for all federates, determined by the RTI
    private startTime: null | TimeValue = null;

    public getStartTime() {
        return this.startTime;
    }

    public constructor (id: number) {
        super();
        this.id = id;
    }

    /** 
     *  Create a socket connection to the RTI and register this federate's
     *  ID with the RTI.
     *  @param port The port number to use.
     */
    public connectToRTI(port: number) {
        // Create an IPv4 socket for TCP (not UDP) communication over IP (0)
        
        let thiz = this;

        const options: SocketConnectOpts = {
            "port": port,
            "family": 4, // IPv4,
            "localAddress": "0.0.0.0" // All interfaces, 0.0.0.0.
        }
        this.socket = createConnection(options, () => {
            // This function is a listener to the 'connection' socket
            // event. 

            this.socket?.on('data', thiz.handleSocketData(thiz));

            // Immediately send a FED ID message after connecting.
            const buffer = Buffer.alloc(5);
            buffer.writeUInt8(MessageTypes.FED_ID, 0);
            buffer.writeUInt32LE(this.id, 1);
            this.socket?.write(buffer);

            // Next, emit a connected event.
            this.emit('connected');
        });
    }

    /** 
     *  Send the specified TimeValue to the RTI and set up
     *  a handler for the response.
     *  The specified TimeValue should be current physical time of the
     *  federate, and the response will be the designated start time for
     *  the federate. May only be called after the federate emits a
     *  'connected' event. When the RTI responds, this federate will
     *  emit a 'startTime' event.
     *  @param myPhysicalTime The physical time at this federate.
     *  @param callback A callback function that will be called once the
     *  RTI responds with the designated start time for this federate
     *  as its argument.
     */
    public getStartTimeFromRTI(myPhysicalTime: TimeValue) {
        let msg = Buffer.alloc(9)
        msg.writeUInt8(MessageTypes.TIMESTAMP, 0);
        let time = myPhysicalTime.get64Bit();
        time.copy(msg, 1); // Copy time into msg
        this.socket?.write(msg);
    }

    private handleSocketData(thiz: this) {
        return function(data: Buffer) {
            if (data.length < 1) {
                throw new Error( `Received a message from the RTI with 0 length.`);
            }

            let bufferIndex = 0;
            while (bufferIndex < data.length) {

                // Convert the first byte to a number so it can be compared
                // against the messageType enum.
                console.log(data);
                let messageTypeByte = data[bufferIndex]
                switch (messageTypeByte) {
                    case MessageTypes.FED_ID: {
                        // Federate ID: 32 bits long.
                        throw new Error('Received a FED_ID message from the RTI. ' 
                            + 'FED_ID messages may only be sent by federates');
                        break;
                    }
                    case MessageTypes.TIMESTAMP: {
                        // Timestamp 64 bits long.
                        let timeBuffer = Buffer.alloc(8);
                        data.copy(timeBuffer, 0, bufferIndex + 1, bufferIndex + 9 );
                        thiz.startTime = new BinaryTimeValue(timeBuffer);
                        thiz.emit('startTime');
                        bufferIndex += 9;
                        break;
                    }
                    case MessageTypes.MESSAGE: {
                        // Message: The next two bytes will be the ID of the destination port
                        // The next two bytes are the destination federate ID.
                        // The next four bytes after that will be the length of the message
                        // The remaining bytes are the message.
                        break;
                    }
                    case MessageTypes.RESIGN: {
                        // Resign: no bytes

                        break;
                    }
                    case MessageTypes.TIMED_MESSAGE: {
                        // Timed Message: The next two bytes will be the ID of the destination port.
                        // Message: The next two bytes will be the ID of the destination port
                        // The next two bytes are the destination federate ID.
                        // The next four bytes after that will be the length of the message
                        // ** The next eight bytes will be the timestamp.
                        // The remaining bytes are the message.

                        break;
                    }
                    case MessageTypes.NEXT_EVENT_TIME: {
                        // Next Event Time: The next eight bytes will be the timestamp.

                        break;
                    }
                    case MessageTypes.TIME_ADVANCE_GRANT: {
                        // Time Advance Grant: The next eight bytes will be the timestamp.

                        break;
                    }
                    case MessageTypes.LOGICAL_TIME_COMPLETE: {
                        // Logial Time Complete: The next eight bytes will be the timestamp.

                        break;
                    } 
                }
            }
        }
    }

//     /** 
//      *  Handle a message being received from a federate via the RTI.
//      *  @param sending_socket The identifier for the sending socket.
//      *  @param buffer The buffer to read into (the first byte is already there).
//      *  @param header_size The number of bytes in the header.
//      */
//     public handleMessage(int sending_socket, unsigned char* buffer, unsigned int header_size) {
    
//     }

//     /** 
//      *  Send a time advance grant (TAG) message to the specified socket
//      *  with the specified time.
//      */
//     public sendTimeAdvanceGrant(federate_t* fed, instant_t time) {
    
//     }

//     /** 
//      *  Find the earliest time at which the specified federate may
//      *  experience its next event. This is the least next event time
//      *  of the specified federate and (transitively) upstream federates
//      *  (with delays of the connections added). For upstream federates,
//      *  we assume (conservatively) that federate upstream of those
//      *  may also send an event. If any upstream federate has not sent
//      *  a next event message, this will return the completion time
//      *  of the federate (which may be NEVER, if the federate has not
//      *  yet completed a logical time).
//      *  @param fed The federate.
//      *  @param candidate A candidate time (for the first invocation,
//      *   this should be fed->next_time).
//      *  @param visited An array of booleans indicating which federates
//      *   have been visited (for the first invocation, this should be
//      *   an array of falses of size NUMBER_OF_FEDERATES).
//      */
//     public transitive_next_event(federate_t* fed, instant_t candidate, bool visited[]) {
    
//     }


//     /** 
//      * Determine whether the specified reactor is eligible for a time advance grant,
//      *  and, if so, send it one. This first compares the next event time of the
//      *  federate to the completion time of all its upstream federates (plus the
//      *  delay on the connection to those federates). It finds the minimum of all
//      *  these times, with a caveat. If the candidate for minimum has a sufficiently
//      *  large next event time that we can be sure it will provide no event before
//      *  the next smallest minimum, then that candidate is ignored and the next
//      *  smallest minimum determines the time.  If the resulting time to advance
//      *  to does not move time forward for the federate, then no time advance
//      *  grant message is sent to the federate.
//      *
//      *  This should be called whenever an upstream federate either registers
//      *  a next event time or completes a logical time.
//      *  @return True if the TAG message is sent and false otherwise.
//      */
//     public sendTimeAdvanceIfAppropriate(federate_t* fed) {
    
//     }

//     /** 
//      *  Handle a logical time complete (LTC) message.
//      *  @param fed The federate that has completed a logical time.
//      */
//     public handleLogicalTimeComplete(federate_t* fed) {

//     }

//     /** 
//      *  Handle a next event time (NET) message.
//      *  @param fed The federate sending a NET message.
//      */
//     public handleNextEventTime(federate_t* fed) {

//     }


//     // UNECESSARY?
//     /** Thread handling communication with a federate.
//      *  @param fed A pointer to an int that is the
//      *   socket descriptor for the federate.
//      */
//     public federate(void* fed) {
    
//     }

//     /** 
//      *  Launch the specified executable by forking the calling process and converting
//      *  the forked process into the specified executable.
//      *  If forking the process fails, this will return -1.
//      *  Otherwise, it will return the process ID of the created process.
//      *  @param executable The executable program.
//      *  @return The PID of the created process or -1 if the fork fails.
//      */
//     public federate_launcher(char* executable) {
    
//     }

}

// Emits the event 'ready' when all federates are connected.
export class RTI extends EventEmitter {

    // The server descriptor for the RTI.
    private server: Server | null = null;

    // The number of federates for the RTI to manage.
    private totalFeds: number;

    // A map relating socket connections to this server and the associated
    // federate ID. If the socket does not have a known federate ID, the socket
    // is mapped to null.
    private connections: Map<Socket, number> = new Map<Socket, number>();

    // A map relating federate IDs to sockets.
    private idToSocket: Map<number, Socket> = new Map<number, Socket>();

    private maxStartTime: null | TimeValue = null;

    // A map relating federate IDs to physical times reported from TimeStamp
    // messages.
    private idToStartTimes: Map<number, TimeValue> = new Map<number, TimeValue>();

    /** 
     *  Start the socket server for the runtime infrastructure (RTI).
     *  RTI will emit the event 'ready' when all federates are connected
     *  to the server.
     *  @param port The port on which to listen for socket connections.
     */
    public startRTIServer(port: number) {
        // const options: SocketConnectOpts = {
        //     "port": port,
        //     "family": 4, // IPv4,
        //     "localAddress": "0.0.0.0" // All interfaces, 0.0.0.0.
        // }
        let thiz = this;

        this.server = createServer();

        this.server.on('end', () => {
            console.log('Client disconnected');
        });

        this.server.on('error', (err) => {
            throw err;
        });

        this.server.on('connection', (socket: Socket) => {
            console.log('New socket connection');
            //thiz.connections.set(socket, null);
            socket.on('data', thiz.handleSocketData(thiz, socket));
        })

        this.server.listen(port, () => {
            console.log(`server bound to port: ${port}`);
        });
    }

    private handleSocketData (thiz: this, socket: Socket) : (data: Buffer) => void {
        return function(data: Buffer) {

            let bufferIndex = 0;
            while (bufferIndex < data.length) {
                console.log("Start handle socket data with bufferIndex: " + bufferIndex);
                if (data.length < 1) {
                    throw new Error( `Received a message from socket ${socket} with 0 length.`);
                }

                // Convert the first byte to a number so it can be compared
                // against the messageType enum.
                // console.log(data);
                let messageTypeByte = data[bufferIndex]
                // console.log(messageTypeByte);
                // console.log(messageTypeByte == MessageTypes.FED_ID);
                // console.log(data[bufferIndex] == MessageTypes.FED_ID)
                switch (messageTypeByte) {
                    case MessageTypes.FED_ID: {
                        console.log("in fed-id");
                        // Federate ID: 32 bits long.
        
                        // FIXME: This will kind of work regardless of the endianness, as long as it's
                        // consistent, but collisions are possible.
                        // REPLACE WITH PROTOBUFFS OR MESSAGEPACK
                        // if (data.length < 5) {
                        //     throw new Error(`Received a FED_ID message from socket ${socket}
                        //         with incorrect length ${data.length}.`);
                        // }
                        let fedID = data.readInt32LE(bufferIndex + 1);
        
                        if (thiz.connections.size > thiz.totalFeds) {
                            throw new Error(`Expected ${thiz.totalFeds} connections, but exceeded that number.`)
                        }
                        if (thiz.connections.has(socket) && thiz.connections.get(socket) !== null) {
                            throw new Error(`Received FED_ID message from socket ${socket}, `
                                + `containing the new ID: ${fedID}, but that socket has already been assigned `
                                + `the ID ${thiz.connections.get(socket)}.`);
                        }
                        thiz.connections.set(socket, fedID);
                        thiz.idToSocket.set(fedID, socket);
                        if (thiz.connections.size == thiz.totalFeds) {
                            console.log("It's the feds!");
                            thiz.emit('ready');
                        }
                        console.log("ending FED_ID");
                        
                        bufferIndex += 5;
                        break;
                    }
                    case MessageTypes.TIMESTAMP: {
                        console.log("IN timestamp from serrver");
                        // Timestamp 64 bits long.
                        
                        // Record the proposed start time and see if it's
                        // the greatest proposed start time so far.
                        let timeBuffer = Buffer.alloc(8);
                        data.copy(timeBuffer, 0, bufferIndex + 1, bufferIndex + 9 );
                        console.log("length is: " + timeBuffer.length);
                        console.log("TimeBuffer: " + timeBuffer.toString('hex'));
                        let time = new BinaryTimeValue(timeBuffer);
                        console.log("Time is: " + time);
                        if (thiz.maxStartTime === null || thiz.maxStartTime < time ) {
                            thiz.maxStartTime = time;
                        }
                        let id = thiz.connections.get(socket);
                        if (id) {
                            thiz.idToStartTimes.set(id, time );
                        }

                        // If all federates have proposed a start time,
                        // respond to all of them with the greatest proposed
                        // time plus an offset.
                        if (thiz.idToStartTimes.size == thiz.totalFeds) {
                            const responseBuffer = Buffer.alloc(9);
                            const responseTime = thiz.maxStartTime.add(DELAY_START).get64Bit();
                            responseBuffer[0] = MessageTypes.TIMESTAMP;
                            responseTime.copy(responseBuffer, 1);

                            console.log("REsponse buffer: " + responseBuffer.toString('hex'));
                            for (let s of thiz.connections.keys()) {
                                s.write(responseBuffer);
                            }
                        }

                        bufferIndex += 9;
                        break;
                    }
                    case MessageTypes.MESSAGE: {
                        // Message: The next two bytes will be the ID of the destination port
                        // The next two bytes are the destination federate ID.
                        // The next four bytes after that will be the length of the message
                        // The remaining bytes are the message.

                        // FIXME: increment bufferIndex
                        break;
                    }
                    case MessageTypes.RESIGN: {
                        // Resign: no bytes
        
                        // FIXME: increment bufferIndex
                        break;
                    }
                    case MessageTypes.TIMED_MESSAGE: {
                        // Timed Message: The next two bytes will be the ID of the destination port.
                        // Message: The next two bytes will be the ID of the destination port
                        // The next two bytes are the destination federate ID.
                        // The next four bytes after that will be the length of the message
                        // ** The next eight bytes will be the timestamp.
                        // The remaining bytes are the message.
        
                        // FIXME: increment bufferIndex
                        break;
                    }
                    case MessageTypes.NEXT_EVENT_TIME: {
                        // Next Event Time: The next eight bytes will be the timestamp.
        
                        // FIXME: increment bufferIndex
                        break;
                    }
                    case MessageTypes.TIME_ADVANCE_GRANT: {
                        // Time Advance Grant: The next eight bytes will be the timestamp.
        
                        // FIXME: increment bufferIndex
                        break;
                    }
                    case MessageTypes.LOGICAL_TIME_COMPLETE: {
                        // Logial Time Complete: The next eight bytes will be the timestamp.
        
                        // FIXME: increment bufferIndex
                        break;
                    } 
                }

            }
            console.log("***********");
            
        }

    }

    /**
     *  Create an RTI instance.
     *  @param totalFeds Number of federates.
     */
    public constructor (totalFeds: number) {
        super();
        this.totalFeds = totalFeds;
    }

    // /** 
    //  *  Wait for one incoming connection request from each federate.
    //  *  Execute callback when all federates are connected
    //  *  @param socket_descriptor The socket on which to accept connections.
    //  */
    // public connectToFederates(callback: () => {}) {

    //     this.socket.
    // //     for (int i = 0; i < NUMBER_OF_FEDERATES; i++) {
    // //         // Wait for an incoming connection request.
    // //         struct sockaddr client_fd;
    // //         uint32_t client_length = sizeof(client_fd);
    // //         int socket_id = accept(socket_descriptor, &client_fd, &client_length);
    // //         if (socket_id < 0) error("ERROR on server accept");

    // //         // The first message from the federate should be its ID.
    // //         // Buffer for message ID plus the federate ID.
    // //         int length = sizeof(int) + 1;
    // //         unsigned char buffer[length];

    // //         // Read bytes from the socket. We need 5 bytes.
    // //         int bytes_read = 0;
    // //         while (bytes_read < length) {
    // //             int more = read(socket_id, &(buffer[bytes_read]),
    // //                     length - bytes_read);
    // //             if (more < 0) error("ERROR on RTI reading from socket");
    // //             // If more == 0, this is an EOF. Exit the thread.
    // //             if (more == 0) return;
    // //             bytes_read += more;
    // //         }
    // //         // printf("DEBUG: read %d bytes.\n", bytes_read);

    // //         // First byte received is the message ID.
    // //         if (buffer[0] != FED_ID) {
    // //             fprintf(stderr, "ERROR: RTI expected a FED_ID message. Got %u (see rti.h).\n", buffer[0]);
    // //         }

    // //         int fed_id = swap_bytes_if_big_endian_int(*((int*)(&(buffer[1]))));
    // //         // printf("DEBUG: RTI received federate ID: %d\n", fed_id);

    // //         if (federates[fed_id].state != NOT_CONNECTED) {
    // //             fprintf(stderr, "Duplicate federate ID: %d.\n", fed_id);
    // //             // FIXME: Rather harsh error handling here.
    // //             exit(1);
    // //         }
    // //         // Default state is as if an NMR has been granted for the start time.
    // //         federates[fed_id].state = GRANTED;
    // //         federates[fed_id].socket = socket_id;

    // //         // Create a thread to communicate with the federate.
    // //         pthread_create(&(federates[fed_id].thread_id), NULL, federate, &(federates[fed_id]));
    // //     }
    // // }
    
    // }

    // /** 
    //  *  Start the runtime infrastructure (RTI) interaction with the federates
    //  *  and wait for the federates to exit.
    //  *  @param socket_descriptor The socket descriptor returned by start_rti_server().
    //  */
    // public waitForFederates(int socket_descriptor) {

    //     //  // Wait for connections from federates and create a thread for each.
    //     //  connect_to_federates(socket_descriptor);

    //     //  // All federates have connected.
    //     //  printf("RTI: All expected federates have connected. Starting execution.\n");
        
    //     //  // Wait for federate threads to exit.
    //     //  void* thread_exit_status;
    //     //  for (int i = 0; i < NUMBER_OF_FEDERATES; i++) {
    //     //      pthread_join(federates[i].thread_id, &thread_exit_status);
    //     //      printf("RTI: Federate thread exited.\n");
    //     //  }
    //     //  // NOTE: In all common TCP/IP stacks, there is a time period,
    //     //  // typically between 30 and 120 seconds, called the TIME_WAIT period,
    //     //  // before the port is released after this close. This is because
    //     //  // the OS is preventing another program from accidentally receiving
    //     //  // duplicated packets intended for this program.
    //     //  close(socket_descriptor);    
    // }

}