'use strict';


import {App} from '../reactor';
import {TimeUnit, TimeInterval} from "../time"
import { ShowDeadline } from '../components/deadline';

class DeadlineTest extends App{
    showDeadline: ShowDeadline;

    constructor(timeout: TimeInterval, success: ()=> void, fail: ()=>void, name?:string ){
        super(timeout, name)
        this.showDeadline = new ShowDeadline(success, fail, this, "ShowDeadline");
    }
}


// This test shows the ShowDeadline reactor is able to trigger a reaction on
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

        var sDeadline = new DeadlineTest( [3, TimeUnit.secs], done, failReactor, "ShowDeadline");
        sDeadline.start(()=> null, failRuntime);
    })
});
