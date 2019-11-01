'use strict';


import {Reactor, TimeUnit} from './reactor';
import * as globals from './globals';
import { SingleEvent } from './singleEvent';
import { Logger } from './logger';

describe('SingleEvent', function () {
    var singleEvent = new SingleEvent("foo");
    var logger = new Logger();


    //Tell the reactor runtime to successfully terminate after 3 seconds.
    globals.setExecutionTimeout([3, TimeUnit.secs]);
    //Ensure the test will run for 5 seconds.
    jest.setTimeout(5000);

    it('SingleEvent and Logger create test', function () {
        
        expect(expect(singleEvent).toBeInstanceOf(SingleEvent));
        expect(expect(logger).toBeInstanceOf(Logger));

    });

    it('Topology test', function () {
        
        expect(singleEvent.o.canConnect(logger.i)).toBe(true);
        expect(logger.i.canConnect(singleEvent.o)).toBe(true);

    });

    it('start runtime with input.connect to output', done => {

        //Connect output of singleEvent to input of logger.
         singleEvent.o.connect(logger.i);
        // logger.i.connect(singleEvent.o);

        function fail(){
            throw new Error("Runtime has failed.");
        };

        globals.startRuntime(done, fail);

    })
});