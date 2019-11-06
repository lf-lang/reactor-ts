'use strict';


import {Reactor, TimeUnit, OutPort, InPort} from './reactor';
import * as globals from './globals';
import { SingleEvent } from './singleEvent';
import { Logger } from './logger';


class SEContainer extends Reactor{

    o: OutPort<any>= new OutPort<any>(this);
}

class LogContainer extends Reactor{

    i: InPort<any>= new InPort<any>(this);
}

//This test is just like SingleEvent.test.ts, only the singleEvent and the logger are
//contained by other reactors.
describe('HierarchicalSingleEvent', function () {

    //Tell the reactor runtime to successfully terminate after 3 seconds.
    globals.setExecutionTimeout([3, TimeUnit.secs]);
    //Ensure the test will run for 5 seconds.
    jest.setTimeout(5000);

    it('start runtime with input.connect to output', done => {
        console.log("starting test");

        function failRuntime(){
            throw new Error("Runtime has failed.");
        };

        function failReactor(){
            throw new Error("Reactor has failed.");
        };

        var seContainer = new SEContainer(null, "SingleEventContainer");
        var logContainer = new LogContainer(null, "LogContainer");

        var singleEvent = new SingleEvent("foo",seContainer, "SingleEvent");
        var logger = new Logger(done, failReactor, "foo", logContainer, "Logger");

        expect(expect(singleEvent).toBeInstanceOf(SingleEvent));
        expect(expect(logger).toBeInstanceOf(Logger));

        expect(singleEvent.o.canConnect(logger.i)).toBe(false);
        console.log("past expects...");
        //expect(logger.i.canConnect(singleEvent.o)).toBe(false);

        //Connect output of singleEvent to input of logger.

        singleEvent.o.connect(seContainer.o);
        seContainer.o.connect(logContainer.i);
        logContainer.i.connect(logger.i);
        // logger.i.connect(singleEvent.o);
        console.log("starting runtime in hierarch single event");

        globals.startRuntime(()=>null, failRuntime);
    })
});