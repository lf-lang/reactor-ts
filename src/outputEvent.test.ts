'use strict';


import {Reactor, TimeUnit, OutPort, InPort, App, TimeInterval} from './reactor';
// import * as globals from './globals';
import { OutputResponder } from './outputEvent';
import { Logger } from './logger';

class OutputEventTest extends App{
    oResponder: OutputResponder;

    constructor(timeout: TimeInterval, success: ()=> void, fail: ()=>void, name?:string ){
        super(timeout, name)
        this.oResponder = new OutputResponder(success, fail, this, "OutputResponder");
    }
}

// This test shows the OutputEvent reactor is able to trigger a reaction on
// a contained reactor's output.
describe('OutputEventTest', function () {

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


        var oEventTest = new OutputEventTest( [3, TimeUnit.secs], done, failReactor, "OutputEventTest");
        //Don't give the runtime the done callback because we don't care if it terminates
        oEventTest.start(()=> null, failRuntime);
        // var oEvent = new OutputResponder( done, failReactor, null, "OutputResponder");
    
        // globals.startRuntime(()=>null, failRuntime);
    })
});