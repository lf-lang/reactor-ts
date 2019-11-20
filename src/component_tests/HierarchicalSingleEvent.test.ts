'use strict';

import {Reactor, OutPort, InPort, App} from '../reactor';
import {TimeUnit, TimeInterval} from "../time"
import { SingleEvent } from '../components/SingleEvent';
import { Logger } from '../components/Logger';

class SEContainer extends Reactor{

    o: OutPort<any>= new OutPort<any>(this);
    child: SingleEvent;
}

class LogContainer extends Reactor{

    i: InPort<any>= new InPort<any>(this);
    child: Logger;
}

class SETest extends App{
    seContainer: SEContainer;
    logContainer: LogContainer;

    constructor(timeout: TimeInterval, success: ()=> void, fail: ()=>void, name?:string ){
        super(timeout, name)

        this.seContainer = new SEContainer(this, "SEContainer");
        this.logContainer = new LogContainer(this, "LogContainer");
        
        this.seContainer.child = new SingleEvent("foo", this.seContainer, "SingleEvent");
        this.logContainer.child = new Logger(success, fail, "foo", this.logContainer, "Logger");

        //Connect output of singleEvent to input of logger through hierarchy.
        this.seContainer.child.o.connect(this.seContainer.o);
        this.seContainer.o.connect(this.logContainer.i);
        this.logContainer.i.connect(this.logContainer.child.i);
    }
}

//This test is just like SingleEvent.test.ts, only the singleEvent and the logger are
//contained by other reactors.
describe('HierarchicalSingleEvent', function () {

    // Ensure the test will run for no more than 5 seconds.
    jest.setTimeout(5000);

    it('start runtime with input.connect to output', done => {

        function failRuntime(){
            console.log("Runtime has ended.");
            // throw new Error("Runtime has failed.");
        };

        function failReactor(){
            throw new Error("Reactor has failed.");
        };

        // Tell the reactor runtime to successfully terminate after 3 seconds.
        let seTest = new SETest([3, TimeUnit.secs], done, failReactor, "SingleEventTesterApp");

        // Normally _setAllParents would be called as part of the initialization
        // process for starting an app, but we call it directly here to set
        // parent attributes needed for this test.
        seTest._setAllParents(null);

        expect(expect(seTest.seContainer.child).toBeInstanceOf(SingleEvent));
        expect(expect(seTest.logContainer.child).toBeInstanceOf(Logger));

        expect(seTest.seContainer.child.o.canConnect(seTest.logContainer.child.i)).toBe(false);

        seTest._start(()=> null, failRuntime);
    });
});