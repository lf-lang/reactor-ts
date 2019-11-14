'use strict';


import {App} from '../reactor';
import {TimeUnit, TimeInterval} from "../time"
// import * as globals from './globals';
import { ActionTrigger } from '../components/ActionTrigger';

class ActionTriggerTest extends App{
    aTrigger: ActionTrigger;

    constructor(timeout: TimeInterval, success: ()=> void, fail: ()=>void, name?:string ){
        super(timeout, name)
        this.aTrigger = new ActionTrigger(success, fail, this, "ActionTrigger");
    }
}

describe('ActionTrigger', function () {

    //Tell the reactor runtime to successfully terminate after 3 seconds.
    // globals.setExecutionTimeout([3, TimeUnit.secs]);
    //Ensure the test will run for 5 seconds.
    jest.setTimeout(5000);

    // it('ActionTrigger create test', function () {
    //     expect(expect(actionTrigger).toBeInstanceOf(ActionTrigger));

    // });

    it('start runtime', done => {

        function failRuntime(){
            // throw new Error("Runtime has failed.");
            console.log("Runtime has no more events on the queue.");
        };
        function failReactor(){
            throw new Error("Reactor has failed.");
        };

        var aTriggerTest = new ActionTriggerTest( [3, TimeUnit.secs], done, failReactor, "ActionTriggerTest");
        //Don't give the runtime the done callback because we don't care if it terminates
        aTriggerTest.start(()=> null, failRuntime);

    })
});