'use strict';


import {Reactor, TimeUnit} from './reactor';
import * as globals from './globals';
import { SingleEvent } from './singleEvent';
import { Logger } from './logger';

describe('SingleEvent', function () {

    //Tell the reactor runtime to successfully terminate after 3 seconds.
    globals.setExecutionTimeout([3, TimeUnit.secs]);
    //Ensure the test will run for 5 seconds.
    jest.setTimeout(5000);

    it('start runtime with input.connect to output', done => {

        function failRuntime(){
            throw new Error("Runtime has failed.");
        };

        function failReactor(){
            throw new Error("Reactor has failed.");
        };

        var singleEvent = new SingleEvent("foo", null, "SingleEvent");
        var logger = new Logger(done, failReactor, "foo", null, "Logger");

        expect(expect(singleEvent).toBeInstanceOf(SingleEvent));
        expect(expect(logger).toBeInstanceOf(Logger));

        expect(singleEvent.o.canConnect(logger.i)).toBe(true);
        expect(logger.i.canConnect(singleEvent.o)).toBe(false);

        //Connect output of singleEvent to input of logger.
        singleEvent.o.connect(logger.i);
        // logger.i.connect(singleEvent.o);

        globals.startRuntime(()=>null, failRuntime);
    })
});