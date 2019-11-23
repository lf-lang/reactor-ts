'use strict';

import {Reactor, OutPort, App, Timer, Reaction, Trigger, InPort, Action} from '../reactor';
import { TimeUnit, TimeInterval} from "../time";

class OutputGetTest extends App{

    o: OutPort<number> = new OutPort<number>(this);
    t: Timer = new Timer(this, 0, 0);
    r: Reaction;
    
    constructor(timeout: TimeInterval, success: ()=> void, fail: ()=>void, name?:string ){
        super(timeout, name)
        this.r = new OutputGetter(this,[this.t], [], [this.o], success, fail);
        this._reactions = [this.r];
    }
}

class OutputGetter extends Reaction{

    success: () => void;
    fail: ()=>void;

    constructor(state: Reactor, triggers: Trigger[], uses: Array<InPort<any>>,
        effects: Array<OutPort<any> | Action<any>>,
        success: () => void, fail: ()=>void ){
        super(state,triggers, uses, effects );
        this.success = success;
        this.fail = fail;
    }

    react(){
        let state: OutputGetTest = this.state as OutputGetTest;
        if(state.o.get() != null){
            throw new Error("Calling get on an output before it has been set does not return null");
        }
        state.o.set(5);
        if(state.o.get() !== 5){
            throw new Error("Calling get on an output after it has been set does not return the set value");
        }
        this.success();
    }
}

// This test shows that a value may be obtained from an OutPort via get()
// once it has been set()
describe('OutputGetTest', function () {

    //Ensure the test will run for 5 seconds.
    jest.setTimeout(5000);

    it('start runtime', done => {
        console.log("starting test");

        function failRuntime(){
            // throw new Error("Runtime has failed.");
            console.log("Runtime has no more events on the queue");
        };

        function failReactor(){
            throw new Error("Reactor has failed.");
        };

        //Tell the reactor runtime to successfully terminate after 3 seconds.
        var oGetTest = new OutputGetTest( [3, TimeUnit.secs], done, failReactor, "OutputGetTest");
        
        //Don't give the runtime the done callback because we don't care if it terminates
        oGetTest._start(()=> null, failRuntime);
    })
});