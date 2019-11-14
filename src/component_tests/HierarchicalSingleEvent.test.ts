'use strict';


import {Reactor, OutPort, InPort, App} from '../reactor';
import {TimeUnit, TimeInterval} from "../time"
import { SingleEvent } from '../components/SingleEvent';
import { Logger } from '../components/Logger';


class SEContainer extends Reactor{

    o: OutPort<any>= new OutPort<any>(this);
}

class LogContainer extends Reactor{

    i: InPort<any>= new InPort<any>(this);
}

class SETest extends App{
    seContainer: SEContainer;
    logContainer: LogContainer;
    singleEvent: SingleEvent;
    logger: Logger;

    constructor(timeout: TimeInterval, success: ()=> void, fail: ()=>void, name?:string ){
        super(timeout, name)

        this.seContainer = new SEContainer(this, "SEContainer");
        this.logContainer = new LogContainer(this, "LogContainer");
        this.singleEvent = new SingleEvent("foo", this.seContainer, "SingleEvent");
        this.logger = new Logger(success, fail, "foo", this.logContainer, "Logger");

        //Connect output of singleEvent to input of logger through hierarchy.
        this.singleEvent.o.connect(this.seContainer.o);
        this.seContainer.o.connect(this.logContainer.i);
        this.logContainer.i.connect(this.logger.i);

    }
}

//This test is just like SingleEvent.test.ts, only the singleEvent and the logger are
//contained by other reactors.
describe('HierarchicalSingleEvent', function () {

    //Tell the reactor runtime to successfully terminate after 3 seconds.
    // globals.setExecutionTimeout([3, TimeUnit.secs]);
    //Ensure the test will run for 5 seconds.
    jest.setTimeout(5000);

    it('start runtime with input.connect to output', done => {

        function failRuntime(){
            console.log("Runtime has ended.");
            // throw new Error("Runtime has failed.");
        };

        function failReactor(){
            throw new Error("Reactor has failed.");
        };

        let seTest = new SETest([3, TimeUnit.secs], done, failReactor, "SingleEventTesterApp");
        // console.log(seTest);

        expect(expect(seTest.singleEvent).toBeInstanceOf(SingleEvent));
        expect(expect(seTest.logger).toBeInstanceOf(Logger));

        expect(seTest.singleEvent.o.canConnect(seTest.logger.i)).toBe(false);
        // expect(seTest.logger.i.canConnect(seTest.singleEvent.o)).toBe(false);

        seTest.start(()=> null, failRuntime);

    // it('start runtime with input.connect to output', done => {
    //     console.log("starting test");

    //     function failRuntime(){
    //         throw new Error("Runtime has failed.");
    //     };

    //     function failReactor(){
    //         throw new Error("Reactor has failed.");
    //     };

    //     var seContainer = new SEContainer(null, "SingleEventContainer");
    //     var logContainer = new LogContainer(null, "LogContainer");

    //     var singleEvent = new SingleEvent("foo",seContainer, "SingleEvent");
    //     var logger = new Logger(done, failReactor, "foo", logContainer, "Logger");

    //     expect(expect(singleEvent).toBeInstanceOf(SingleEvent));
    //     expect(expect(logger).toBeInstanceOf(Logger));

    //     expect(singleEvent.o.canConnect(logger.i)).toBe(false);
    //     console.log("past expects...");
    //     //expect(logger.i.canConnect(singleEvent.o)).toBe(false);

    //     //Connect output of singleEvent to input of logger.

    //     singleEvent.o.connect(seContainer.o);
    //     seContainer.o.connect(logContainer.i);
    //     logContainer.i.connect(logger.i);
    //     // logger.i.connect(singleEvent.o);
    //     console.log("starting runtime in hierarch single event");

    //     globals.startRuntime(()=>null, failRuntime);
    // })
    });
});