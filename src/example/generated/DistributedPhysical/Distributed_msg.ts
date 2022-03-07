// Code generated by the Lingua Franca compiler from file:
// https://github.com/icyphy/lingua-franca/blob/master/example/DistributedTS/Distributed.lf

import {Args, Parameter, State, Read, Triggers, ReadWrite, Action, Sched, Timer, Reactor, OutPort, TimeUnit, TimeValue, Tag, Origin} from '../../../core/internal'
import {FederatedApp} from '../../../core/federation' // FIXME

// ************* App Parameters
let __timeout: TimeValue | undefined = TimeValue.withUnits(10, TimeUnit.secs);
let __keepAlive: boolean = true;
let __fast: boolean = false;

let __noStart = false; // If set to true, don't start the app.

// Assign custom command line arguments
// =============== START reactor class MessageGenerator
export class MessageGenerator extends Reactor {
    t: Timer;
    root: Parameter<string>;
    count: State<number>;
    message: OutPort<string>;
    constructor (
        parent: Reactor, 
        root: string = ""
    ) {
        super(parent);
        this.t = new Timer(this, TimeValue.withUnits(1, TimeUnit.sec), TimeValue.withUnits(1, TimeUnit.sec));
        this.root = new Parameter(root);
        this.count = new State(1);
        this.message = new OutPort<string>(this);
        this.addReaction(
            new Triggers(this.t),
            new Args(this.t, this.writable(this.message), this.root, this.count),
            function (this, __t: Read<Tag>, __message: ReadWrite<string>, __root: Parameter<string>, __count: State<number>) {
                // =============== START react prologue
                const util = this.util;
                let t = __t.get();
                let message = __message.get();
                let root = __root.get();
                let count = __count.get();
                // =============== END react prologue
                try {
                    message = root + " " + count++;    
                    console.log(`At time ${util.getElapsedLogicalTime()}, send message: ${message}`);
                } finally {
                    // =============== START react epilogue
                    if (message !== undefined) {
                        __message.set(message);
                    }
                    if (count !== undefined) {
                        __count.set(count);
                    }
                    // =============== END react epilogue
                }
            }
        );
    }
}
// =============== END reactor class MessageGenerator

// =============== START reactor class Distributed
export class Distributed extends FederatedApp {
    msg: MessageGenerator
    networkMessage: Action<string>;
    constructor (
        timeout: TimeValue | undefined = undefined, 
        keepAlive: boolean = false, 
        fast: boolean = false, 
        success?: () => void, 
        fail?: () => void
    ) {
        super("Unidentified Federation", 0, 15045, "localhost", timeout, keepAlive, fast, success, fail);
        this.addDownstreamFederate(1);
        this.msg = new MessageGenerator(this, "Hello World")
        this.networkMessage = new Action<string>(this, Origin.physical, TimeValue.withUnits(10, TimeUnit.msec));
        this.addReaction(
            new Triggers(this.msg.message),
            new Args(this.msg.message, this.schedulable(this.networkMessage)),
            function (this, __msg_message: Read<string>, __networkMessage: Sched<string>) {
                // =============== START react prologue
                const util = this.util;
                let networkMessage = __networkMessage.get();
                let actions = {networkMessage: __networkMessage};
                let msg = {message: __msg_message.get()}
                // =============== END react prologue
                try {
                    // FIXME: For now assume the data is a string, but this is not checked.
                    // Replace with ProtoBufs or MessagePack.
                    if (msg.message !== undefined) {
                        let buf = Buffer.from(msg.message)
                        this.util.sendRTITimedMessage(buf, 1, 0);
                    }
                } finally {
                    // =============== START react epilogue
                    
                    // =============== END react epilogue
                }
            }
        );
    }
}
// =============== END reactor class Distributed

// ************* Instance Distributed of class Distributed
let __app;
if (!__noStart) {
    __app = new Distributed(__timeout, __keepAlive, __fast, );
}
// ************* Starting Runtime for Distributed + of class Distributed.
if (!__noStart && __app) {
    __app._start();
}
