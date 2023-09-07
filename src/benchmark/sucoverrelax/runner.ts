import { InMultiPort, InPort, MutationSandbox, OutMultiPort, OutPort, Parameter, Reactor, State, Variable, } from "../../core/internal";
import { SORActor } from "./actor";
import { SORPeer } from "./peer";
import { Message, MessageTypes, SORBootMessage, SORResultMessage, SorBorder, jacobi, omega } from "./sorutils";

export class SORRunner extends Reactor {
    protected s: State<number>;
    protected part: State<number>;

    protected sorActors: State<SORActor[]>;
    protected sorPeer: State<SORPeer | undefined>;

    protected portToSORActors: OutPort<Message>;
    protected portToSORPeer: OutPort<Message>;
    // Unsure if this would work, let's just try......
    protected portFromSORActor: InPort<Message>;
    protected portFromSORPeer: InPort<Message>;

    protected gTotal = new State(0.0);
    protected returned = new State(0);
    protected totalMsgRcv = new State(0);
    protected expectingBoot = new State(true);

    // In Savina, randoms is accessed directly from SucOverRelaxConfig.
    // Here we pass it in to the closure.
    constructor(parent: Reactor, size: number, _randoms: number[][]) {
        super(parent, "SORRunner");
        // These are in SorRunner; 
        this.s = new State(size);
        // In the scala implementation a simple /2 was used.
        // In JS we might need to enforce some sort of guarantee as it was used to calculate position
        this.part = new State(Math.floor(size / 2));
        /** These are from Savina. They should be rather irrelevant, actually. */
        this.sorActors = new State([]);
        this.sorPeer = new State(undefined);

        /** These are the actual messaging passing mechanism that are synonomous to that of Savina. */
        // This creates a bunch of ports.
        this.portToSORActors = new OutPort(this);
        this.portToSORPeer = new OutPort(this);
        this.portFromSORActor = new InPort(this);
        this.portFromSORPeer = new InPort(this);
        
        this.addMutation(
            [this.startup],
            [this.sorActors, this.sorPeer, this.portToSORActors, this.portToSORPeer],
            function (this, sorActors, sorPeer, portToSORActors, portToSORPeer) {
                // TODO: Add actual stuff
                ;
            }
        );
    }

    // This is to be used WITHIN mutation react functions.
    static process(this: MutationSandbox, message: Message, args: ProcessingArgs): void {
        switch (message.messageType) {
            case MessageTypes.sorBootMessage: {
                if (args.type !== MessageTypes.sorBootMessage) {
                    throw new Error("Wrong type of arguments passed.");
                }
                // expectingBoot is args[0]
                args.expectingBoot.set(false);
                SORRunner.boot.apply(this, [args]);
                break;
            }
            case MessageTypes.sorResultMessage: {
                if (args.type !== MessageTypes.sorResultMessage) {
                    throw new Error("Wrong type of arguments passed.");
                }

                const {mv, msgRcv} = message;
                const {expectingBoot, totalMsgRcv, returned, gTotal, s, part} = args;
                
                if (expectingBoot.get()) {
                    throw new Error("SORRunner not booted yet!");
                } 

                totalMsgRcv.set(totalMsgRcv.get() + msgRcv);
                returned.set(returned.get() + 1);
                gTotal.set(gTotal.get() + mv);

                if (returned.get() === (s.get() * part.get()) + 1) {
                    // TODO: validate
                    // TODO: exit
                    ;
                }
                break;
            }
            case MessageTypes.sorBorderMessage: {
                if (args.type !== MessageTypes.sorBorderMessage) {
                    throw new Error("Wrong type of arguments passed.");
                }

                const {mBorder} = message;
                const {expectingBoot, s, part, sorActors, portToSORActors} = args;

                if (expectingBoot.get()) {
                    throw new Error("SORRunner not booted yet!");
                } 
                const sorActorsValue = sorActors.get();
                for (let i = 0; i <= s.get(); ++i) {
                    sorActorsValue[(i + 1) * (part.get() + 1) - 1] = mBorder.borderActors[i];
                }
                sorActors.set(sorActorsValue);
                for (let i = 0; i <= s.get(); ++i) {
                    for (let j = 0; j <= part.get(); ++j) {
                        const pos = (i * (part.get() + 1)) + j;
                        // Ibidem, connect then disconnect to simulate 
                        // "fire and forget" in scala.
                        this.connect(portToSORActors, sorActorsValue[pos].portFromRunner);
                        this.getReactor().writable(portToSORActors).set(
                            {
                                messageType: MessageTypes.sorStartMessage,
                                mi: jacobi,
                                mActors: sorActorsValue
                            }
                        );
                        this.disconnect(portToSORActors, sorActorsValue[pos].portFromRunner);
                    }   
                }
                break;
            }
            default: {
                throw new Error("Received wrong message from port");
            }
        }
    }

    // SorRunner::boot()
    static boot(this: MutationSandbox,
            args: BootProcessingArgs
            ): void {
                const {_randoms, _s, _part, sorActors, sorPeer, portToSORPeer} = args;

                const myBorder: SORActor[] = [];
                const randoms = _randoms;
                const s = _s.get();
                const part = _part.get();
                // In scala, (i <- 0 until s) is a loop excluding s.
                const sorActorsValue = sorActors.get();
                for (let i = 0; i < s; ++i) {
                    let c = i % 2;
                    for (let j = 0; j < part; ++j) {
                        const pos = i * (part + 1) + j;
                        c = 1 - c;
                        // We modify them in bulk, then update the state.
                        // Unlike in Scala we do not need to initialise the array here, JS supports sparse array.
                        // I have absolutely no idea why these parametres are called as such......
                        sorActorsValue[pos] = this.getReactor()._uncheckedAddSibling(
                            SORActor,
                            pos, randoms[i][j], c, s, part + 1, omega, this.getReactor(), false
                        );

                        if (j === (part - 1)) {
                            myBorder[i] = sorActorsValue[pos];
                        }

                    }
                }
                sorActors.set(sorActorsValue);

                const partialMatrix: number[][] = [];
                for (let i = 0; i < s; ++i) {
                    for (let j = 0; j < s - part; ++j) {
                        partialMatrix[i][j] = randoms[i][j + part];
                    }
                }

                const sorPeerValue = this.getReactor()._uncheckedAddSibling(
                    SORPeer,
                    s, part, partialMatrix, new SorBorder(myBorder),
                    // A dirty hack. Maybe this will be removed as ports get added.
                    this.getReactor() as SORRunner
                );
                sorPeer.set(sorPeerValue);
                // Pass message.
                // This is similar to Scala's !; but it looks pretty...... interesting in LF.
                // If node is concurrent or parallel, this might be a problem, so direct copy-pastaing to C++ runtime might not work.
                this.connect(portToSORPeer, sorPeerValue.portFromSORRunner);
                this.getReactor().writable(portToSORPeer).set({messageType: MessageTypes.sorBootMessage});
                // Disconnect immediately.
                this.disconnect(portToSORPeer, sorPeerValue.portFromSORRunner);
    }
}


interface BootProcessingArgs {
    type: MessageTypes.sorBootMessage,
    expectingBoot: State<boolean>,            
     _randoms: number[][],
    _s: State<number>,
    _part: State<number>,
    sorActors: State<SORActor[]>,
    sorPeer: State<SORPeer>,
    portToSORPeer: OutPort<Message>
}

interface ResultProcessingArgs {
    type: MessageTypes.sorResultMessage,
    expectingBoot: State<boolean>,
    totalMsgRcv: State<number>,
    returned: State<number>,
    gTotal: State<number>,
    s: State<number>,
    part: State<number>
}

interface BorderProcessingArgs {
    type: MessageTypes.sorBorderMessage,
    expectingBoot: State<boolean>,
    s: State<number>,
    part: State<number>,
    sorActors: State<SORActor[]>,
    portToSORActors: OutPort<Message>
}

type ProcessingArgs = BootProcessingArgs | ResultProcessingArgs | BorderProcessingArgs;