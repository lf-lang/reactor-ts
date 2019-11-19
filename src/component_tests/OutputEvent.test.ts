'use strict';

import {App} from '../reactor';
import {TimeUnit, TimeInterval} from "../time"
import { OutputResponder } from '../components/OutputEvent';

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

        // Tell the reactor runtime to successfully terminate after 3 seconds.
        var oEventTest = new OutputEventTest( [3, TimeUnit.secs], done, failReactor, "OutputEventTest");
        // Don't give the runtime the done callback because we don't care if it terminates
        oEventTest.start(()=> null, failRuntime);
    })
});