'use strict';


import {Reactor} from './reactor';
import * as globals from './globals';
import { SingleEvent } from './SingleEvent';

describe('SingleEvent', function () {
    var singleEvent = new SingleEvent();
    //Tell the reactor runtime to successfully terminate after 3 seconds.
    globals.setExecutionTimeout([3, "sec"]);
    //Ensure the test will run for 5 seconds.
    jest.setTimeout(5000);

    it('SingleEvent create test', function () {
        
        expect(expect(singleEvent).toBeInstanceOf(SingleEvent));

    });

    it('start runtime', done => {

        function fail(){
            throw new Error("Runtime has failed.");
        };

        globals.startRuntime(done, fail);

    })
});