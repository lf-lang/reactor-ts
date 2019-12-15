'use strict';

import {Reactor, OutPort, App, Timer, Reaction, Variable, Args, ArgType} from '../reactor';
import { TimeUnit, TimeInterval} from "../time";

class OutputGetTest extends App {

    o: OutPort<number> = new OutPort<number>(this);
    t: Timer = new Timer(this, 0, 0);
    
    constructor(timeout: TimeInterval, name:string, success: ()=> void, fail: ()=>void ){
        super(timeout);
        this.addReaction(new OutputGetter(this, [this.t], Args(this.o), success, fail));
    }
}

class OutputGetter<T> extends Reaction<T> {

    success: () => void;
    fail: () => void;

    constructor(parent: Reactor, trigs:Variable<unknown>[], args:ArgType<T>, success, fail) {
        super(parent, trigs, args);
        this.success = success;
        this.fail = fail;
    }

    //@ts-ignore
    react(o: OutPort<number>) {
        if(o.get() != null){
            throw new Error("Calling get on an output before it has been set does not return null");
        }
        o.set(5);
        if(o.get() !== 5){
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
        var oGetTest = new OutputGetTest( [3, TimeUnit.secs], "OutputGetTest", done, failReactor);
        
        //Don't give the runtime the done callback because we don't care if it terminates
        oGetTest._start(()=> null, failRuntime);
    })
});