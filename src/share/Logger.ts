import {Reactor, InPort, Read, Triggers, Args, State, Present, ReactionSandbox} from '../core/reactor';

function print(this:ReactionSandbox, i: Read<unknown>, expected: State<unknown>) {
    const received = i.get();
    if (received) {
        console.log("Logging: " + received);
        if(received == expected.get()) {
            this.util.requestShutdown(true);
        } else {
            this.util.requestShutdown(false, "Expected" + expected.get() + " but got " + received);
        }
    } else {
        throw new Error("Log had no input available. This shouldn't happen because the logging reaction is triggered by the input");
    }
}

export class Logger extends Reactor {

    i = new InPort(this);

    constructor(parent:Reactor, expected:Present) {
        super(parent);
        this.addReaction(new Triggers(this.i), new Args(this.i, new State(expected)), print);
    }

}