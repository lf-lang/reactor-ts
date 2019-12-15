import {Reactor, InPort, Trigger, Reaction, OutPort, Action, ArgType, } from '../reactor';

export class Print<T> extends Reaction<T> {

    success:() => void;
    fail:() => void;
    expected: any;

    constructor(parent: Reactor, triggers: Trigger[], args:ArgType<T>, expected:any) {
        super(parent, triggers, args);
        this.expected = expected;
    }

    /**
     * Call console.log on the input, and test if it matches expected.
     * @override
     */
    react(){
        const received = (this.state as Logger).i.get();
        if( received ){
            console.log("Logging: " + received);
            if(received === this.expected){
                this.success();
            } else {
                this.fail();
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
        
        const r = new Print(this, [this.i], [this.i], expected);
        //this._reactions.push(r);
    }

}