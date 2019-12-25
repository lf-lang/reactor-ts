'use strict';

import {Reactor, OutPort, InPort, App} from '../reactor';
import {TimeUnit, TimeInterval, UnitBasedTimeInterval} from "../time"
import { SingleEvent } from '../components/SingleEvent';
import { Logger } from '../components/Logger';

class SEContainer extends Reactor{
    // Made these public to accommodate the test below.
    public o: OutPort<any>= new OutPort<any>(this);
    public child: SingleEvent<string> = new SingleEvent(this, "SingleEvent");

    constructor(parent: Reactor) {
        super(parent);
        this._connect(this.child.o, this.o);
    }
}

class LogContainer extends Reactor{

    // Made these public to accommodate the test below.
    public i: InPort<any>= new InPort<any>(this);
    public child: Logger = new Logger(this, "foo");

    constructor(parent: Reactor) {
        super(parent);
        this._connect(this.i, this.child.i);
    }

}

class SETest extends App {
    seContainer: SEContainer;
    logContainer: LogContainer;

    constructor(timeout: TimeInterval, name:string, success: ()=> void, fail: ()=>void ){
        super(timeout, name, success, fail)

        this.seContainer = new SEContainer(this);
        this.logContainer = new LogContainer(this);

        // Connect output of singleEvent to input of logger through hierarchy.
        this._connect(this.seContainer.o, this.logContainer.i);
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
        let seTest = new SETest(new TimeInterval(3), "SingleEventTesterApp", done, failReactor);

        // Normally _setAllParents would be called as part of the initialization
        // process for starting an app, but we call it directly here to set
        // parent attributes needed for this test.
        // seTest._setAllParents(null);

        expect(expect(seTest.seContainer.child).toBeInstanceOf(SingleEvent));
        expect(expect(seTest.logContainer.child).toBeInstanceOf(Logger));

        expect(seTest.seContainer.canConnect(seTest.seContainer.child.o, seTest.logContainer.child.i)).toBe(false);

        seTest._start();
    });
});