'use strict';


import {Reactor, TimeUnit} from './reactor';
import * as globals from './globals';
import { ActionTrigger } from './actionTrigger';

describe('ActionTrigger', function () {
    var actionTrigger = new ActionTrigger();
    //Tell the reactor runtime to successfully terminate after 3 seconds.
    globals.setExecutionTimeout([3, TimeUnit.secs]);
    //Ensure the test will run for 5 seconds.
    jest.setTimeout(5000);

    it('ActionTrigger create test', function () {
        expect(expect(actionTrigger).toBeInstanceOf(ActionTrigger));

    });

    it('start runtime', done => {

        function fail(){
            throw new Error("Runtime has failed.");
        };

        globals.startRuntime(done, fail);

    })
});