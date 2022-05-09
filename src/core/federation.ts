
import {Socket, createConnection, SocketConnectOpts} from 'net'
import {EventEmitter} from 'events';
import {
    Log, Tag, TimeValue, Origin, getCurrentPhysicalTime, Alarm,
    Present, App, Action, TaggedEvent
} from './internal';

//---------------------------------------------------------------------//
// Federated Execution Constants and Enums                             //
//---------------------------------------------------------------------//

// FIXME: For now this constant is unused.
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
export const CONNECT_RETRY_INTERVAL: TimeValue = TimeValue.secs(2);

/** 
 *  Bound on the number of retries to connect to the RTI.
 *  A federate will retry every CONNECT_RETRY_INTERVAL seconds
 *  this many times before giving up. E.g., 500 retries every
 *  2 seconds results in retrying for about 16 minutes.
 */
export const CONNECT_NUM_RETRIES: number = 500;

/**
 * Message types defined for communication between a federate and the
 * RTI (Run Time Infrastructure).
 * In the C reactor target these message types are encoded as an unsigned char,
 * so to maintain compatability in TypeScript the magnitude must not exceed 255
 */
enum RTIMessageTypes {

    /**
     * Byte identifying a rejection of the previously received message.
     * The reason for the rejection is included as an additional byte
     * (uchar) (see below for encodings of rejection reasons).
     */
    MSG_TYPE_REJECT = 0,

    /** 
     *  Byte identifying a message from a federate to an RTI containing
     *  the federation ID and the federate ID. The message contains, in
     *  this order:
     *  * One byte equal to MSG_TYPE_FED_IDS.
     *  * Two bytes (ushort) giving the federate ID.
     *  * One byte (uchar) giving the length N of the federation ID.
     *  * N bytes containing the federation ID.
     *  Each federate needs to have a unique ID between 0 and
     *  NUMBER_OF_FEDERATES-1.
     *  Each federate, when starting up, should send this message
     *  to the RTI. This is its first message to the RTI.
     *  The RTI will respond with either MSG_TYPE_REJECT, MSG_TYPE_ACK, or MSG_TYPE_UDP_PORT.
     *  If the federate is a C target LF program, the generated federate
     *  code does this by calling synchronize_with_other_federates(),
     *  passing to it its federate ID.
     */
    MSG_TYPE_FED_IDS = 1,

    /**
     * Byte identifying a timestamp message, which is 64 bits long.
     * Each federate sends its starting physical time as a message of this
     * type, and the RTI broadcasts to all the federates the starting logical
     * time as a message of this type.
     */
    MSG_TYPE_TIMESTAMP = 2,

    /** 
     *  Byte identifying a message to forward to another federate.
     *  The next two bytes will be the ID of the destination port.
     *  The next two bytes are the destination federate ID.
     *  The four bytes after that will be the length of the message.
     *  The remaining bytes are the message.
     *  NOTE: This is currently not used. All messages are tagged, even
     *  on physical connections, because if "after" is used, the message
     *  may preserve the logical timestamp rather than using the physical time.
     */
    MSG_TYPE_MESSAGE = 3,

    /** 
     * Byte identifying that the federate is ending its execution.
     */
    MSG_TYPE_RESIGN = 4,

    /** 
     *  Byte identifying a timestamped message to forward to another federate.
     *  The next two bytes will be the ID of the destination reactor port.
     *  The next two bytes are the destination federate ID.
     *  The four bytes after that will be the length of the message.
     *  The next eight bytes will be the timestamp of the message.
     *  The next four bytes will be the microstep of the message.
     *  The remaining bytes are the message.
     *
     *  With centralized coordination, all such messages flow through the RTI.
     *  With decentralized coordination, tagged messages are sent peer-to-peer
     *  between federates and are marked with MSG_TYPE_P2P_TAGGED_MESSAGE.
     */
    MSG_TYPE_TAGGED_MESSAGE = 5,

    /** 
     * Byte identifying a next event tag (NET) message sent from a federate
     * in centralized coordination.
     * The next eight bytes will be the timestamp.
     * The next four bytes will be the microstep.
     * This message from a federate tells the RTI the tag of the earliest event 
     * on that federate's event queue. In other words, absent any further inputs 
     * from other federates, this will be the least tag of the next set of
     * reactions on that federate. If the event queue is empty and a timeout
     * time has been specified, then the timeout time will be sent. If there is
     * no timeout time, then FOREVER will be sent. Note that this message should
     * not be sent if there are physical actions and the earliest event on the event
     * queue has a tag that is ahead of physical time (or the queue is empty).
     * In that case, send TAN instead.
     */
     MSG_TYPE_NEXT_EVENT_TAG = 6,

    /** 
     * Byte identifying a time advance grant (TAG) sent by the RTI to a federate
     * in centralized coordination. This message is a promise by the RTI to the federate
     * that no later message sent to the federate will have a tag earlier than or
     * equal to the tag carried by this TAG message.
     * The next eight bytes will be the timestamp.
     * The next four bytes will be the microstep.
     */
    MSG_TYPE_TAG_ADVANCE_GRANT = 7,

    /** 
     * Byte identifying a provisional time advance grant (PTAG) sent by the RTI to a federate
     * in centralized coordination. This message is a promise by the RTI to the federate
     * that no later message sent to the federate will have a tag earlier than the tag
     * carried by this PTAG message.
     * The next eight bytes will be the timestamp.
     * The next four bytes will be the microstep.
     */
    MSG_TYPE_PROVISIONAL_TAG_ADVANCE_GRANT = 8,

    /** 
     * Byte identifying a logical tag complete (LTC) message sent by a federate
     * to the RTI.
     * The next eight bytes will be the timestep of the completed tag.
     * The next four bytes will be the microsteps of the completed tag.
     */
    MSG_TYPE_LOGICAL_TAG_COMPLETE = 9,

    /**
     * A message that informs the RTI about connections between this federate and
     * other federates where messages are routed through the RTI. Currently, this
     * only includes logical connections when the coordination is centralized. This
     * information is needed for the RTI to perform the centralized coordination.
     * 
     * @note Only information about the immediate neighbors is required. The RTI can
     * transitively obtain the structure of the federation based on each federate's
     * immediate neighbor information.
     *
     * The next 4 bytes is the number of upstream federates. 
     * The next 4 bytes is the number of downstream federates.
     * 
     * Depending on the first four bytes, the next bytes are pairs of (fed ID (2
     * bytes), delay (8 bytes)) for this federate's connection to upstream federates
     * (by direct connection). The delay is the minimum "after" delay of all
     * connections from the upstream federate.
     *
     * Depending on the second four bytes, the next bytes are fed IDs (2
     * bytes each), of this federate's downstream federates (by direct connection).
     *
     * @note The upstream and downstream connections are transmitted on the same
     *  message to prevent (at least to some degree) the scenario where the RTI has
     *  information about one, but not the other (which is a critical error).
     */
    MSG_TYPE_NEIGHBOR_STRUCTURE = 24,

    /**
     * Byte identifying an acknowledgment of the previously received MSG_TYPE_FED_IDS message
     * sent by the RTI to the federate
     * with a payload indicating the UDP port to use for clock synchronization.
     * The next four bytes will be the port number for the UDP server, or
     * 0 or USHRT_MAX if there is no UDP server.  0 means that initial clock synchronization
     * is enabled, whereas USHRT_MAX mean that no synchronization should be performed at all.
     */
    MSG_TYPE_UDP_PORT = 254,

    /**
     * Byte identifying an acknowledgment of the previously received message.
     * This message carries no payload.
     */
    MSG_TYPE_ACK = 255
}

//---------------------------------------------------------------------//
// Federated Execution Classes                                         //
//---------------------------------------------------------------------//

// FIXME: add "FederatedApp" and other class names here
// to the prohibited list of LF names.

/**
 * Node.js doesn't export a type for errors with a code,
 * so this is a workaround for typing such an Error.
 */
interface NodeJSCodedError extends Error{
    code: string;
}

/**
 * Custom type guard for a NodeJsCodedError
 * @param e The Error to be tested as being a NodeJSCodedError
 */
function isANodeJSCodedError(e: Error): e is NodeJSCodedError {
    return (typeof (e as NodeJSCodedError).code === 'string');
}

/**
 * An RTIClient is used within a federate to abstract the socket
 * connection to the RTI and the RTI's binary protocol over the socket.
 * RTIClient exposes functions for federate-level operations like
 * establishing a connection to the RTI or sending a message.
 * RTIClient is an EventEmitter, and asynchronously emits events for:
 * 'startTime', 'connected', 'message', 'timedMessage', and 
 * 'timeAdvanceGrant'. The federatedApp is responsible for handling the
 * events to ensure a correct exeuction. 
 */
class RTIClient extends EventEmitter {

    // ID of federation that this federate will join.
    private federationID:string;

    // ID of this federate.
    private id:number;         
    
    // The socket descriptor for communicating with this federate.
    private socket: Socket | null = null;

    // The mapping between a federate port ID and the federate port action
    // scheduled upon reception of a message designated for that federate port.
    
    /**
     * TODO: Specify Type in Action
     */
    private federatePortActionByID: Map<number, Action<any>> = new Map<number, Action<any>>();

    /**
     * Establish the mapping between a federate port's action and its ID.
     * @param federatePortID The federate port's ID.
     * @param federatePort The federate port's action.
     */
    public registerFederatePortAction<T extends Present>(federatePortID: number, federatePortAction: Action<T>) {
        this.federatePortActionByID.set(federatePortID, federatePortAction);
    }

    /**
     * Constructor for an RTIClient
     * @param id The ID of the federate this client communicates
     * on behalf of.
     */
    public constructor (federationID: string, id: number) {
        super();
        this.federationID = federationID;
        this.id = id;
    }

    // If the last data sent to handleSocketData contained an incomplete
    // or chunked message, that data is copied over to chunkedBuffer so it can
    // be saved until the next time handleSocketData is called. If no data has been
    // saved, chunkedBuffer is null.
    private chunkedBuffer : Buffer | null = null;

    // The number of attempts made by this federate to connect to the RTI.
    private connectionAttempts = 0;

    /** 
     *  Create a socket connection to the RTI and register this federate's
     *  ID with the RTI. If unable to make a connection, retry.
     *  @param port The RTI's remote port number.
     *  @param host The RTI's remote host name. 
     */
    public connectToRTI(port: number, host: string) {
        // Create an IPv4 socket for TCP (not UDP) communication over IP (0)
    
        let thiz = this;

        const options: SocketConnectOpts = {
            "port": port,
            "family": 4, // IPv4,
            "localAddress": "0.0.0.0", // All interfaces, 0.0.0.0.
            "host": host
        }

        this.socket = createConnection(options, () => {
            // This function is a listener to the 'connection' socket
            // event.

            // Only set up an event handler for close if the connection is
            // created. Otherwise this handler will go off on every reconnection
            // attempt.
            this.socket?.on('close', () => {
                Log.info(this, () => {return 'RTI socket has closed.'});
            });

            // Immediately send a federate ID message after connecting.
            const buffer = Buffer.alloc(4);
            buffer.writeUInt8(RTIMessageTypes.MSG_TYPE_FED_IDS, 0);
            buffer.writeUInt16LE(this.id, 1);

            buffer.writeUInt8(this.federationID.length, 3);
            try {
                Log.debug(this, () => {return 'Sending a FED ID message to the RTI.'});
                this.socket?.write(buffer);
                this.socket?.write(this.federationID);
            } catch (e) {
                Log.error(this, () => {return `${e}`});
            }

            // Finally, emit a connected event.
            this.emit('connected');
        });

        this.socket?.on('data', thiz.handleSocketData.bind(thiz));

        // If the socket reports a connection refused error,
        // suppress the message and try to reconnect.
        this.socket?.on('error', (err: Error ) => {
            if (isANodeJSCodedError(err) && err.code === 'ECONNREFUSED' ) {
                Log.info(this, () => {
                    return `Failed to connect to RTI with error: ${err}.`
                })
                if (this.connectionAttempts < CONNECT_NUM_RETRIES) {
                    Log.info(this, () => {return `Retrying RTI connection in ${CONNECT_RETRY_INTERVAL}.`})
                    this.connectionAttempts++;
                    let a = new Alarm();
                    a.set(this.connectToRTI.bind(this, port, host), CONNECT_RETRY_INTERVAL)
                } else {
                    Log.error(this, () => {return `Could not connect to RTI after ${CONNECT_NUM_RETRIES} attempts.`})
                }
            } else {
                Log.error(this, () => {return err.toString()})
            }
        });
    }

    /**
     * Destroy the RTI Client's socket connection to the RTI.
     */
    public closeRTIConnection() {
        Log.debug( this, () => {return 'Closing RTI connection by destroying and unrefing socket.'});
        this.socket?.destroy();
        this.socket?.unref(); // Allow the program to exit
    }

    public sendNeighborStructure(upstreamFedIDs: number[], upstreamFedDelays: bigint[], downstreamFedIDs: number[]) {
        let msg = Buffer.alloc(9 + upstreamFedIDs.length * 10 + downstreamFedIDs.length * 2);
        msg.writeUInt8(RTIMessageTypes.MSG_TYPE_NEIGHBOR_STRUCTURE);
        msg.writeUInt32LE(upstreamFedIDs.length, 1);
        msg.writeUInt32LE(downstreamFedIDs.length, 5);
        
        let bufferIndex = 9;
        for (let i = 0; i < upstreamFedIDs.length; i++) {
            msg.writeUInt16LE(upstreamFedIDs[i], bufferIndex);
            msg.writeBigUInt64LE(upstreamFedDelays[i], bufferIndex + 2);
            bufferIndex += 10;
        }

        for (let i = 0; i < downstreamFedIDs.length; i++) {
            msg.writeUInt16LE(downstreamFedIDs[i], bufferIndex);
            bufferIndex += 2;
        }

        try {
            this.socket?.write(msg);
        } catch (e) {
            Log.error(this, () => {return `${e}`});
        }
    }

    public sendUDPPortNumToRTI(udpPort: number) {
        let msg = Buffer.alloc(3);
        msg.writeUInt8(RTIMessageTypes.MSG_TYPE_UDP_PORT, 0);
        msg.writeUInt16BE(udpPort, 1);
        try {
            this.socket?.write(msg);
        } catch (e) {
            Log.error(this, () => {return `${e}`});
        }
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
     */
    public requestStartTimeFromRTI(myPhysicalTime: TimeValue) {
        let msg = Buffer.alloc(9)
        msg.writeUInt8(RTIMessageTypes.MSG_TYPE_TIMESTAMP, 0);
        let time = myPhysicalTime.toBinary();
        time.copy(msg, 1);
        try {
            Log.debug(this, () => {return `Sending RTI start time: ${myPhysicalTime}`});
            this.socket?.write(msg);
        } catch (e) {
            Log.error(this, () => {return `${e}`});
        }
    }

    /**
     * Send an RTI (untimed) message to a remote federate.
     * @param data The message encoded as a Buffer. The data may be
     * arbitrary length.
     * @param destFederateID The federate ID of the federate
     * to which this message should be sent.
     * @param destPortID The port ID for the port on the destination
     * federate to which this message should be sent.
     */
    public sendRTIMessage<T extends Present>(data: T, destFederateID: number, destPortID: number) {
        const value = Buffer.from(JSON.stringify(data), "utf-8");
        
        let msg = Buffer.alloc(value.length + 9);
        msg.writeUInt8(RTIMessageTypes.MSG_TYPE_MESSAGE, 0);
        msg.writeUInt16LE(destPortID, 1);
        msg.writeUInt16LE(destFederateID, 3);
        msg.writeUInt32LE(value.length, 5);
        value.copy(msg, 9); // Copy data into the message
        try {
            Log.debug(this, () => {return `Sending RTI (untimed) message to `
                + `federate ID: ${destFederateID} and port ID: ${destPortID}.`});
            this.socket?.write(msg);
        } catch (e) {
            Log.error(this, () => {return `${e}`});
        }
    }

    /**
     * Send an RTI timed message to a remote federate.
     * @param data The message encoded as a Buffer. The data may be
     * arbitrary length.
     * @param destFederateID The federate ID of the federate
     * to which this message should be sent.
     * @param destPortID The port ID for the port on the destination
     * federate to which this message should be sent.
     * @param time The time of the message encoded as a 64 bit little endian
     * unsigned integer in a Buffer.
     */
    public sendRTITimedMessage<T extends Present>(data: T, destFederateID: number, destPortID: number, time: Buffer) {
        const value = Buffer.from(JSON.stringify(data), "utf-8");
        
        let msg = Buffer.alloc(value.length + 21);
        msg.writeUInt8(RTIMessageTypes.MSG_TYPE_TAGGED_MESSAGE, 0);
        msg.writeUInt16LE(destPortID, 1);
        msg.writeUInt16LE(destFederateID, 3);
        msg.writeUInt32LE(value.length, 5);
        time.copy(msg, 9); // Copy the current time into the message
        // FIXME: Add microstep properly.
        value.copy(msg, 21); // Copy data into the message
        try {
            Log.debug(this, () => {return `Sending RTI (timed) message to `
                + `federate ID: ${destFederateID}, port ID: ${destPortID} `
                + `, time: ${time.toString('hex')}.`});
            this.socket?.write(msg);
        } catch (e) {
            Log.error(this, () => {return `${e}`});
        }
    }

    /**
     * Send the RTI a logical time complete message. This should be
     * called when the federate has completed all events for a given
     * logical time.
     * @param completeTime The logical time that is complete. The time
     * should be encoded as a 64 bit little endian unsigned integer in
     * a Buffer.
     */
    public sendRTILogicalTimeComplete(completeTime: Buffer) {
        let msg = Buffer.alloc(13);
        msg.writeUInt8(RTIMessageTypes.MSG_TYPE_LOGICAL_TAG_COMPLETE, 0);
        completeTime.copy(msg, 1);
        // FIXME: Add microstep properly.
        try {
            Log.debug(this, () => {return "Sending RTI logical time complete: " + completeTime.toString('hex');});
            this.socket?.write(msg);
        } catch (e) {
            Log.error(this, () => {return `${e}`});
        }
    }

    /**
     * Send the RTI a resign message. This should be called when
     * the federate is shutting down.
     */
    public sendRTIResign() {
        let msg = Buffer.alloc(1);
        msg.writeUInt8(RTIMessageTypes.MSG_TYPE_RESIGN, 0);
        try {
            Log.debug(this, () => {return "Sending RTI resign.";});
            this.socket?.write(msg);
        } catch (e) {
            Log.error(this, () => {return `${e}`});
        }
    }

    /**
     * Send the RTI a next event time message. This should be called when
     * the federate would like to advance logical time, but has not yet
     * received a sufficiently large time advance grant.
     * @param nextTime The time of the message encoded as a 64 bit unsigned
     * integer in a Buffer.
     */
    public sendRTINextEventTime(nextTime: Buffer) {
        let msg = Buffer.alloc(13);
        msg.writeUInt8(RTIMessageTypes.MSG_TYPE_NEXT_EVENT_TAG, 0);
        nextTime.copy(msg,1);
        // FIXME: Add microstep properly.
        try {
            Log.debug(this, () => {return "Sending RTI Next Event Time.";});
            this.socket?.write(msg);
        } catch (e) {
            Log.error(this, () => {return `${e}`});
        }
    }

    /**
     * The handler for the socket's data event. 
     * The data Buffer given to the handler may contain 0 or more complete messages.
     * Iterate through the complete messages, and if the last message is incomplete
     * save it as thiz.chunkedBuffer so it can be prepended onto the
     * data when handleSocketData is called again.
     * @param assembledData The Buffer of data received by the socket. It may
     * contain 0 or more complete messages.
     */
    private handleSocketData(data: Buffer) {
        let thiz = this;
        if (data.length < 1) {
            throw new Error( `Received a message from the RTI with 0 length.`);
        }

        // Used to track the current location within the data Buffer.
        let bufferIndex = 0;

        // Append the new data to leftover data from chunkedBuffer (if any)
        // The result is assembledData.
        let assembledData: Buffer;

        if (thiz.chunkedBuffer) {
            assembledData = Buffer.alloc(thiz.chunkedBuffer.length + data.length);
            thiz.chunkedBuffer.copy(assembledData, 0, 0, thiz.chunkedBuffer.length);
            data.copy(assembledData, thiz.chunkedBuffer.length);
            thiz.chunkedBuffer = null;
        } else {
            assembledData = data;
        }
        Log.debug(thiz, () => {return `Assembled data is: ${assembledData.toString('hex')}`});

        while (bufferIndex < assembledData.length) {
            
            let messageTypeByte = assembledData[bufferIndex]
            switch (messageTypeByte) {
                case RTIMessageTypes.MSG_TYPE_FED_IDS: {
                    // MessageType: 1 byte.
                    // Federate ID: 2 bytes long.
                    // Should never be received by a federate.
                    
                    Log.error(thiz, () => {return "Received MSG_TYPE_FED_IDS message from the RTI."});     
                    throw new Error('Received a MSG_TYPE_FED_IDS message from the RTI. ' 
                        + 'MSG_TYPE_FED_IDS messages may only be sent by federates');
                    break;
                }
                case RTIMessageTypes.MSG_TYPE_TIMESTAMP: {
                    // MessageType: 1 byte.
                    // Timestamp: 8 bytes.

                    let incomplete = assembledData.length < 9 + bufferIndex;

                    if (incomplete) {
                        thiz.chunkedBuffer = Buffer.alloc(assembledData.length - bufferIndex);
                        assembledData.copy(thiz.chunkedBuffer, 0, bufferIndex)
                    } else {
                        let timeBuffer = Buffer.alloc(8);
                        assembledData.copy(timeBuffer, 0, bufferIndex + 1, bufferIndex + 9 );
                        let startTime = TimeValue.fromBinary(timeBuffer);
                        Log.debug(thiz, () => { return "Received MSG_TYPE_TIMESTAMP buffer from the RTI " +
                        `with startTime: ${timeBuffer.toString('hex')}`;      
                        })
                        Log.debug(thiz, () => { return "Received MSG_TYPE_TIMESTAMP message from the RTI " +
                            `with startTime: ${startTime}`;      
                        })
                        thiz.emit('startTime', startTime);
                    }

                    bufferIndex += 9;
                    break;
                }
                case RTIMessageTypes.MSG_TYPE_MESSAGE: {
                    // MessageType: 1 byte.
                    // Message: The next two bytes will be the ID of the destination port
                    // The next two bytes are the destination federate ID (which can be ignored).
                    // The next four bytes after that will be the length of the message
                    // The remaining bytes are the message.

                    let incomplete = assembledData.length < 9 + bufferIndex;

                    if (incomplete) {
                        thiz.chunkedBuffer = Buffer.alloc(assembledData.length - bufferIndex);
                        assembledData.copy(thiz.chunkedBuffer, 0, bufferIndex)
                        bufferIndex += 9;
                    } else {
                        let destPortID = assembledData.readUInt16LE(bufferIndex + 1);
                        let messageLength = assembledData.readUInt32LE(bufferIndex + 5);

                        // Once the message length is parsed, we can determine whether
                        // the body of the message has been chunked.
                        let isChunked = messageLength > (assembledData.length - (bufferIndex + 9));

                        if (isChunked) {
                            // Copy the unprocessed remainder of assembledData into chunkedBuffer
                            thiz.chunkedBuffer = Buffer.alloc(assembledData.length - bufferIndex);
                            assembledData.copy(thiz.chunkedBuffer, 0, bufferIndex);
                        } else {
                            // Finish processing the complete message.
                            let messageBuffer = Buffer.alloc(messageLength);
                            assembledData.copy(messageBuffer, 0, bufferIndex + 9, bufferIndex + 9 + messageLength);  
                            let destPortAction = thiz.federatePortActionByID.get(destPortID);
                            thiz.emit('message', destPortAction, messageBuffer);
                        }

                        bufferIndex += messageLength + 9;
                    }
                    break;
                }
                case RTIMessageTypes.MSG_TYPE_TAGGED_MESSAGE: {
                    // MessageType: 1 byte.
                    // The next two bytes will be the ID of the destination port.
                    // The next two bytes are the destination federate ID.
                    // The next four bytes after that will be the length of the message
                    // The next eight bytes will be the timestamp.
                    // The next four bytes will be the microstep of the message.
                    // The remaining bytes are the message.

                    let incomplete = assembledData.length < 21 + bufferIndex;

                    if (incomplete) {
                        thiz.chunkedBuffer = Buffer.alloc(assembledData.length - bufferIndex);
                        assembledData.copy(thiz.chunkedBuffer, 0, bufferIndex)
                        bufferIndex += 21;
                    } else {
                        let destPortID = assembledData.readUInt16LE(bufferIndex + 1);
                        let messageLength = assembledData.readUInt32LE(bufferIndex + 5);

                        let tagBuffer = Buffer.alloc(12);
                        assembledData.copy(tagBuffer, 0, bufferIndex + 9, bufferIndex + 21);
                        let tag = Tag.fromBinary(tagBuffer);
                        Log.debug(thiz, () => {return `Received an RTI MSG_TYPE_TAGGED_MESSAGE: Tag Buffer: ${tag}`});
                        // FIXME: Process microstep properly.

                        let isChunked = messageLength > (assembledData.length - (bufferIndex + 21));

                        if (isChunked) {
                            // Copy the unprocessed remainder of assembledData into chunkedBuffer
                            thiz.chunkedBuffer = Buffer.alloc(assembledData.length - bufferIndex);
                            assembledData.copy(thiz.chunkedBuffer, 0, bufferIndex)
                        } else {
                            // Finish processing the complete message.
                            let messageBuffer = Buffer.alloc(messageLength);
                            assembledData.copy(messageBuffer, 0, bufferIndex + 21, bufferIndex + 21 +  messageLength);  
                            let destPort = thiz.federatePortActionByID.get(destPortID);
                            thiz.emit('timedMessage', destPort, messageBuffer, tag);
                        }

                        bufferIndex += messageLength + 21;
                        break;
                    }
                }
                // FIXME: It's unclear what should happen if a federate gets this
                // message.
                case RTIMessageTypes.MSG_TYPE_RESIGN: {
                    // MessageType: 1 byte.
                    Log.debug(thiz, () => {return 'Received an RTI MSG_TYPE_RESIGN.'});
                    Log.error(thiz, () => {return 'FIXME: No functionality has '
                        + 'been implemented yet for a federate receiving a MSG_TYPE_RESIGN message from '
                        + 'the RTI'});
                    bufferIndex += 1;
                    break;
                }
                case RTIMessageTypes.MSG_TYPE_NEXT_EVENT_TAG: {
                    // MessageType: 1 byte.
                    // Timestamp: 8 bytes.
                    // Microstep: 4 bytes.
                    Log.error(thiz, () => {return 'Received an RTI MSG_TYPE_NEXT_EVENT_TAG. This message type '
                        + 'should not be received by a federate'});
                    bufferIndex += 13;
                    break;
                }
                case RTIMessageTypes.MSG_TYPE_TAG_ADVANCE_GRANT: {
                    // MessageType: 1 byte.
                    // Timestamp: 8 bytes.
                    // Microstep: 4 bytes.
                    Log.debug(thiz, () => {return 'Received an RTI MSG_TYPE_TAG_ADVANCE_GRANT'});
                    let tagBuffer = Buffer.alloc(12);
                    assembledData.copy(tagBuffer, 0, bufferIndex + 1, bufferIndex + 13);
                    let tag = Tag.fromBinary(tagBuffer);
                    thiz.emit('timeAdvanceGrant', tag);
                    bufferIndex += 13;
                    break;
                }
                case RTIMessageTypes.MSG_TYPE_PROVISIONAL_TAG_ADVANCE_GRANT: {
                    Log.debug(thiz, () => {return 'Received an RTI MSG_TYPE_PROVISIONAL_TAG_ADVANCE_GRANT'});
                    let tagBuffer = Buffer.alloc(12);
                    assembledData.copy(tagBuffer, 0, bufferIndex + 1, bufferIndex + 13);
                    let tag = Tag.fromBinary(tagBuffer);
                    Log.debug(thiz, () => {return `PTAG value: ${tag}`});
                    thiz.emit('provisionalTimeAdvanceGrant', tag);
                    bufferIndex += 13;
                    break;
                }
                case RTIMessageTypes.MSG_TYPE_LOGICAL_TAG_COMPLETE: {
                    // Logial Time Complete: The next eight bytes will be the timestamp.
                    Log.error(thiz, () => {return 'Received an RTI MSG_TYPE_LOGICAL_TAG_COMPLETE.  This message type '
                        + 'should not be received by a federate'});
                    bufferIndex += 13;
                    break;
                }
                case RTIMessageTypes.MSG_TYPE_ACK: {
                    Log.debug(thiz, () => {return 'Received an RTI MSG_TYPE_ACK'});
                    bufferIndex += 1;
                    break;
                }
                case RTIMessageTypes.MSG_TYPE_REJECT: {
                    let rejectionReason = assembledData.readUInt8(bufferIndex + 1);
                    Log.error(thiz, () => {return 'Received an RTI MSG_TYPE_REJECT. Rejection reason: ' + rejectionReason});
                    bufferIndex += 2;
                    break;
                }
                default: {
                    throw new Error(`Unrecognized message type in message from the RTI: ${assembledData.toString('hex')}.`)
                }
            }
        }
        Log.debug(thiz, () => {return 'exiting handleSocketData'})
    }
}

/**
 * A federated app is an app containing federates as its top level reactors.
 * A federate is a component in a distributed reactor execution in which
 * reactors from the same (abstract) model run in distinct networked processes.
 * A federated app contains the federates designated to run in a particular
 * process. The federated program is coordinated by the RTI (Run Time Infrastructure).
 * Like an app, a federated app is the top level reactor for a particular process,
 * but a federated app must follow the direction of the RTI for beginning execution,
 * advancing time, and exchanging messages with other federates.
 * 
 * Note: There is no special class for a federate. A federate is the name for a top
 * level reactor of a federated app.
 */
export class FederatedApp extends App {

    /**
     * A federate's rtiClient establishes the federate's connection to
     * the RTI (Run Time Infrastructure). When socket events occur,
     * the rtiClient processes socket-level data into events it emits at the
     * Federate's level of abstraction.
     */
    private rtiClient: RTIClient;

    /**
     * If a federated app uses logical connections, its execution 
     * with respect to time advancement must be sychronized with the RTI.
     * If this variable is true, logical time in this federate
     * cannot advance beyond the time given in the greatest Time Advance Grant
     * sent from the RTI.
     */
    private rtiSynchronized: boolean = false;

    /**
     * The largest time advance grant received so far from the RTI,
     * or null if no time advance grant has been received yet.
     * An RTI synchronized Federate cannot advance its logical time
     * beyond this value.
     */
    private greatestTimeAdvanceGrant: Tag | null = null;

    private upstreamFedIDs: number[] = [];
    private upstreamFedDelays: bigint[] = [];
    private downstreamFedIDs: number[] = [];

    public addUpstreamFederate(fedID: number, fedDelay: bigint) {
        this.upstreamFedIDs.push(fedID);
        this.upstreamFedDelays.push(fedDelay);
        this._isLastTAGProvisional = true;
    }

    public addDownstreamFederate(fedID: number) {
        this.downstreamFedIDs.push(fedID);
    }

    /**
     * Getter for rtiSynchronized
     */
    public _isRTISynchronized() {
        return this.rtiSynchronized;
    }

    /**
     * Getter for greatestTimeAdvanceGrant
     */
    public _getGreatestTimeAdvanceGrant() {
        return this.greatestTimeAdvanceGrant;
    }

    /**
     * Return whether the next event can be handled, or handling the next event
     * has to be postponed to a later time.
     * 
     * If this federated app has not received a sufficiently large time advance
     * grant (TAG) from the RTI for the next event, send it a Next Event Time
     * (NET) message and return. _next() will be called when a new greatest TAG
     * is received. The NET message is not sent if the connection to the RTI is
     * closed. FIXME: what happens in that case? Will next be called?
     * @param event 
     */
    protected _canProceed(event: TaggedEvent<Present>) {
        if (this._isRTISynchronized()) {
            let greatestTAG = this._getGreatestTimeAdvanceGrant();
            let nextTag = event.tag;
            if (greatestTAG === null || greatestTAG.isSmallerThan(nextTag)) {
                this.sendRTINextEventTime(nextTag);
                Log.debug(this, () => "The greatest time advance grant \
                received from the RTI is less than the timestamp of the \
                next event on the event queue");
                Log.global.debug("Exiting _next.");
                return false;
            }
        }
        return true
    }

    protected _iterationComplete(): void {
        let currentTime = this.util.getCurrentTag()
        this.sendRTILogicalTimeComplete(currentTime);
    }

    protected _finish() {
        this.sendRTILogicalTimeComplete(this.util.getCurrentTag());
        this.sendRTIResign();
        this.shutdownRTIClient();
        super._finish();
    }

    // FIXME: Some of the App settings (like fast) are probably incompatible
    // with federated execution.

    /**
     * Federated app constructor. The primary difference from an App constructor
     * is the federateID and the rtiPort. 
     * @param federationID Unique ID of the federation that this federate will join.
     * @param federateID The ID for the federate assigned to this federatedApp.
     * For compatability with the C RTI the ID must be expressable as a 16 bit
     * unsigned short. The ID must be unique among all federates and be a number
     * between 0 and NUMBER_OF_FEDERATES - 1.
     * @param rtiPort The network socket port for communication with the RTI.
     * @param rtiHost The network host (IP address) for communication with the RTI.
     * @param executionTimeout Terminate execution after the designated delay.
     * @param keepAlive Continue execution when the event loop is empty.
     * @param fast Execute as fast as possible, allowing logical time to exceed physical time.
     * @param success Optional argument. Called when the FederatedApp exits with success.
     * @param failure Optional argument. Called when the FederatedApp exits with failure.
     */
    constructor (federationID: string, federateID: number, private rtiPort: number, private rtiHost: string,
        executionTimeout?: TimeValue | undefined, keepAlive?: boolean,
        fast?: boolean, success?: () => void, failure?: () => void) {

        super(executionTimeout, keepAlive, fast,
            // Let super class (App) call FederateApp's _shutdown in success and failure.
            () => {
                success? success(): () => {};
                this._shutdown();
            },
            () => {
                failure? failure(): () => {};
                this._shutdown();
            });
        this.rtiClient = new RTIClient(federationID, federateID);
    }

    /**
     * Register a federate port's action with the federate. It must be registered
     * so it is known by the rtiClient and may be scheduled when a message for the
     * port has been received via the RTI. If at least one of a federate's actions
     * is logical, signifying a logical connection to the federate's port,
     * this FederatedApp must be made RTI synchronized. The advancement of time in
     * an RTI synchronized FederatedApp is managed by the RTI.
     * @param federatePortID The designated ID for the federate port. For compatability with the
     * C RTI, the ID must be expressable as a 16 bit unsigned short. The ID must be
     * unique among all port IDs on this federate and be a number between 0 and NUMBER_OF_PORTS - 1
     * @param federatePort The federate port's action for registration.
     */
    public registerFederatePortAction<T extends Present>(federatePortID: number, federatePortAction: Action<T>) {
        if (federatePortAction.origin === Origin.logical) {
            this.rtiSynchronized = true;
        }
        this.rtiClient.registerFederatePortAction(federatePortID, federatePortAction);
    }

    /**
     * Send a message to a potentially remote federate's port via the RTI. This message
     * is untimed, and will be timestamped by the destination federate when it is received.
     * @param msg The message encoded as a Buffer.
     * @param destFederateID The ID of the federate intended to receive the message.
     * @param destPortID The ID of the federate's port intended to receive the message.
     */
    public sendRTIMessage<T extends Present>(msg: T, destFederateID: number, destPortID: number ) {
        Log.debug(this, () => {return `Sending RTI message to federate ID: ${destFederateID}`
            + ` port ID: ${destPortID}`});
        this.rtiClient.sendRTIMessage(msg, destFederateID, destPortID);
    }

    /**
     * Send a timed message to a potentially remote FederateInPort via the RTI.
     * This message is timed, meaning it carries the logical timestamp of this federate
     * when this function is called.
     * @param msg The message encoded as a Buffer.
     * @param destFederateID The ID of the Federate intended to receive the message.
     * @param destPortID The ID of the FederateInPort intended to receive the message.
     */
    public sendRTITimedMessage<T extends Present>(msg: T, destFederateID: number, destPortID: number ) {
        let time = this.util.getCurrentTag().toBinary();
        Log.debug(this, () => {return `Sending RTI timed message to federate ID: ${destFederateID}`
            + ` port ID: ${destPortID} and time: ${time.toString('hex')}`});
        this.rtiClient.sendRTITimedMessage(msg, destFederateID, destPortID, time);
    }

    /**
     * Send a logical time complete message to the RTI. This should be called whenever
     * this federate is ready to advance beyond the given logical time.
     * @param completeTimeValue The TimeValue that is now complete.
     */
    public sendRTILogicalTimeComplete(completeTag: Tag) {
        let binaryTag = completeTag.toBinary();
        Log.debug(this, () => {return `Sending RTI logical time complete with time: ${completeTag}`});
        this.rtiClient.sendRTILogicalTimeComplete(binaryTag)
    }

    /**
     * Send a resign message to the RTI. This message indicates this federated
     * app is shutting down, and should not be directed any new messages.
     */
    public sendRTIResign() {
        this.rtiClient.sendRTIResign();
    }

    /**
     * Send a next event time message to the RTI. This should be called
     * when this federated app is unable to advance logical time beause it
     * has not yet received a sufficiently large time advance grant.
     * @param nextTag The time to which this federate would like to
     * advance logical time.
     */
    public sendRTINextEventTime(nextTag: Tag) {
        Log.debug(this, () => {return `Sending RTI next event time with time: ${nextTag}`});
        let tag = nextTag.toBinary();
        this.rtiClient.sendRTINextEventTime(tag);
    }

    /**
     * Shutdown the RTI Client by closing its socket connection to
     * the RTI.
     */
    public shutdownRTIClient() {
        this.rtiClient.closeRTIConnection();
    }

    /**
     * @override
     * Register this federated app with the RTI and request a start time.
     * This function registers handlers for the events produced by the federated app's
     * rtiClient and connects to the RTI. The federated app cannot schedule
     * the start of the runtime until the rtiClient has received a start
     * time message from the RTI.
     */
    _start() {
        this._analyzeDependencies();

        this._loadStartupReactions();

        this.rtiClient.on('connected', () => {
            this.rtiClient.sendNeighborStructure(this.upstreamFedIDs, this.upstreamFedDelays, this.downstreamFedIDs);
            this.rtiClient.sendUDPPortNumToRTI(65535);
            this.rtiClient.requestStartTimeFromRTI(getCurrentPhysicalTime());
        });

        this.rtiClient.on('startTime', (startTime: TimeValue) => {
            if (startTime) {
                Log.info(this, () => Log.hr);
                Log.info(this, () => Log.hr);
                Log.info(this, () => {return `Scheduling federate start for ${startTime}`;});
                Log.info(this, () => Log.hr);

                // Set an alarm to start execution at the designated startTime
                let currentPhysTime = getCurrentPhysicalTime();
                let startDelay : TimeValue;
                if (startTime.isEarlierThan(currentPhysTime)) {
                    startDelay = TimeValue.secs(0);
                } else {
                    startDelay = startTime.subtract(currentPhysTime);
                }
                this._alarm.set(() => {
                    this._determineStartAndEndOfExecution(startTime);
                    this._startExecuting();
                }, startDelay);
            } else {
                throw Error("RTI start time is not known.")
            }
        });

        this.rtiClient.on('message', <T extends Present>(destPortAction: Action<T>, messageBuffer: Buffer) => {
            // Schedule this federate port's action.
            // This message is untimed, so schedule it immediately.
            Log.debug(this, () => {return `(Untimed) Message received from RTI.`})
            const value: T = JSON.parse(messageBuffer.toString());

            destPortAction.asSchedulable(this._getKey(destPortAction)).schedule(0, value);
        });

        this.rtiClient.on('timedMessage', <T extends Present>(destPortAction: Action<T>, messageBuffer: Buffer,
            tag: Tag) => {
            // Schedule this federate port's action.

            /**
             *  Definitions:
             * Ts = timestamp of message at the sending end.
             * A = after value on connection
             * Tr = timestamp assigned to the message at the receiving end.
             * r = physical time at the receiving end when message is received (when schedule() is called).
             * R = logical time at the receiving end when the message is received (when schedule() is called).

             * We assume that always R <= r.

             * Logical connection, centralized control: Tr = Ts + A
             * Logical connection, decentralized control: Tr = Ts + A or, if R > Ts + A, 
             *  ERROR triggers at a logical time >= R
             * Physical connection, centralized or decentralized control: Tr = max(r, R + A)
             * 
             */
           

            // FIXME: implement decentralized control.

            Log.debug(this, () => {return `Timed Message received from RTI with tag ${tag}.`})
            const value: T = JSON.parse(messageBuffer.toString());
            
            if (destPortAction.origin == Origin.logical) {
                destPortAction.asSchedulable(this._getKey(destPortAction)).schedule(0, value, tag);

            } else {
                // The schedule function for physical actions implements
                // Tr = max(r, R + A)
                destPortAction.asSchedulable(this._getKey(destPortAction)).schedule(0, value);
            }
        });

        this.rtiClient.on('timeAdvanceGrant', (tag: Tag) => {
            Log.debug(this, () => {return `Time Advance Grant received from RTI for ${tag}.`});
            if (this.greatestTimeAdvanceGrant === null || this.greatestTimeAdvanceGrant?.isSmallerThan(tag)) {
                // Update the greatest time advance grant and immediately 
                // wake up _next, in case it was blocked by the old time advance grant
                this.greatestTimeAdvanceGrant = tag;
                this._isLastTAGProvisional = false;
                this._requestImmediateInvocationOfNext();
            }
        });

        this.rtiClient.on('provisionalTimeAdvanceGrant', (tag: Tag) => {
            Log.debug(this, () => {return `Provisional Time Advance Grant received from RTI for ${tag}.`});
            if (this.greatestTimeAdvanceGrant === null || this.greatestTimeAdvanceGrant?.isSmallerThan(tag)) {
                // Update the greatest time advance grant and immediately 
                // wake up _next, in case it was blocked by the old time advance grant
                this.greatestTimeAdvanceGrant = tag;
                this._isLastTAGProvisional = true;
                this._requestImmediateInvocationOfNext();
                // FIXME: Add input control reaction handling.
            }
        });

        this.rtiClient.connectToRTI(this.rtiPort, this.rtiHost);
        Log.info(this, () => {return `Connecting to RTI on port: ${this.rtiPort}`});
    }
}

/**
 * A RemoteFederatePort represents a FederateInPort in another federate.
 * It contains the information needed to address RTI messages to the remote
 * port.
 */
export class RemoteFederatePort {
    constructor(public federateID: number, public portID: number) {}
}
