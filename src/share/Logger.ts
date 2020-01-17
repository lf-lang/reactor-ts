import {Reactor, InPort, Reaction, Readable, Triggers, Args, State, Present} from '../core/reactor';

class Print<T> extends Reaction<T> {

    /**
     * Call console.log on the input, and test if it matches expected.
     * @override
     */
    //@ts-ignore
    react(i: Readable<unknown>, expected: State<unknown>) {
        const received = i.get();
        if (received) {
            console.log("Logging: " + received);
            if(received == expected.get()) {
                this.util.exec.success();
            } else {
                this.util.exec.failure();
            }
        } else {
            throw new Error("Log had no input available. This shouldn't happen because the logging reaction is triggered by the input");
        }
    }
}


export class Logger extends Reactor {

    i = new InPort(this);

    constructor(parent:Reactor, expected:Present) {
        super(parent);
        this.addReaction(new Print(this, new Triggers(this.i), new Args(this.i, new State(expected))));
    }

}