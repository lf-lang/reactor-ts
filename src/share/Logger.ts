import {Reactor, InPort, Reaction, Variable, VarList} from '../core/reactor';

class Print<T> extends Reaction<T> {

    expected: any;

    constructor(parent: Reactor, triggers: Variable[], args:VarList<T>, expected:any) {
        super(parent, triggers, args);
        this.expected = expected;
    }

    /**
     * Call console.log on the input, and test if it matches expected.
     * @override
     */
    react() {
        const received = (this.state as Logger).i.get();
        if(received) {
            console.log("Logging: " + received);
            if(received == this.expected){
                this.parent.util.success();
            } else {
                this.parent.util.failure();
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