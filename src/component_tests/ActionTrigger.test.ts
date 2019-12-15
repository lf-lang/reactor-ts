'use strict';

import {App} from '../reactor';
import {TimeUnit, TimeInterval} from "../time"
import { ActionTrigger } from '../components/ActionTrigger';

class ActionTriggerTest extends App {
    aTrigger: ActionTrigger;

    constructor(timeout: TimeInterval, name?: string, success?: ()=> void, fail?: ()=>void){
        super(timeout, name, success, fail);
        this.aTrigger = new ActionTrigger(this);
    }
}

describe('ActionTrigger', function () {

    // Ensure the test will run for no more than 5 seconds.
    jest.setTimeout(5000);

    it('start runtime', done => {

        function failRuntime(){
            // throw new Error("Runtime has failed.");
            console.log("Runtime has no more events on the queue.");
        };
        function failReactor(){
            throw new Error("Reactor has failed.");
        };

        //Tell the reactor runtime to successfully terminate after 3 seconds.
        var aTriggerTest = new ActionTriggerTest( [3, TimeUnit.secs], "ActionTriggerTest", done, failReactor);
        //Don't give the runtime the done callback because we don't care if it terminates
        aTriggerTest._start(()=> null, failRuntime);

    })
});