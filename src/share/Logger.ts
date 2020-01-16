import {Reactor, InPort, Reaction, Variable, VarList, Readable} from '../core/reactor';

class Print<T> extends Reaction<T> {

    expected: T;

    constructor(parent: Reactor, triggers: Variable[], args:VarList<T>, expected:T) {
        super(parent, triggers, args);
        this.expected = expected;
    }

    /**
     * Call console.log on the input, and test if it matches expected.
     * @override
     */
    //@ts-ignore
    react(i: Readable<T> ) {
        const received = i.get();
        if(received) {
            console.log("Logging: " + received);
            if(received == this.expected){
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

    i: InPort<any> = new InPort<any>(this);

    constructor(parent:Reactor, expected:any) {
        super(parent);
        this.addReaction(new Print(this, [this.i], this.check(this.i), expected));
    }

}