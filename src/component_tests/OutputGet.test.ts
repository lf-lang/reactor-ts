'use strict';

import {Reactor, OutPort, App, Timer, Reaction, Trigger} from '../reactor';
import { TimeUnit, TimeInterval} from "../time";

class OutputGetTest extends App{

    o: OutPort<number> = new OutPort<number>(this);
    t: Timer = new Timer(this, 0, 0);
    r: Reaction;
    
    constructor(timeout: TimeInterval, success: ()=> void, fail: ()=>void, name?:string ){
        super(timeout, name)
        this.r = new OutputGetter(this,[this.t], 0, success, fail);
        this._reactions = [this.r];
    }
}

class OutputGetter extends Reaction{

    success: () => void;
    fail: ()=>void;

    constructor(state: Reactor, triggers: Trigger[], priority: number,
        success: () => void, fail: ()=>void ){
        super(state,triggers, priority );
        this.success = success;
        this.fail = fail;
    }

    react(){
        let state: any = this.state as any;
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

    //Tell the reactor runtime to successfully terminate after 3 seconds.
    // globals.setExecutionTimeout([3, TimeUnit.secs]);
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

        var oGetTest = new OutputGetTest( [3, TimeUnit.secs], done, failReactor, "OutputGetTest");
        //Don't give the runtime the done callback because we don't care if it terminates
        oGetTest.start(()=> null, failRuntime);
    })
});