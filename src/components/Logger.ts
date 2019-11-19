import {Reactor, InPort, Trigger, Reaction, } from '../reactor';

export class Print extends Reaction{

    success:() => void;
    fail:() => void;
    expected: any;

    constructor(state: Reactor, triggers: Trigger[],
                priority: number, success: () => void, fail: ()=>void, expected:any){
        super(state, triggers, priority);
        this.success = success;
        this.fail = fail;
        this.expected = expected;
    }

    /**
     * Call console.log on the input, and test if it matches expected.
     * @override
     */
    react(){
        const received = (this.state as any).i.get();
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

    constructor(success: () => void, fail: () => void, expected:any ,parent:Reactor | null, name?: string) {
        super(name);
        
        const r = new Print(this, [this.i], 0, success, fail, expected);
        this._reactions.push(r);
    }

}