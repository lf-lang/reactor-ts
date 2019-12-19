'use strict';

import {App} from '../reactor';
import {TimeUnit, TimeInterval} from "../time"
import { SingleEvent } from '../components/SingleEvent';
import { Logger } from '../components/Logger';

class SETest extends App{
    singleEvent: SingleEvent;
    logger: Logger;

    constructor(timeout: TimeInterval, success: ()=> void, fail: ()=>void, name?:string ){
        super(timeout, name)

        this.singleEvent = new SingleEvent("foo", this, "SingleEvent");
        this.logger = new Logger(success, fail, "foo", this, "Logger");

        //Connect output of singleEvent to input of logger.
        this.singleEvent.o.connect(this.logger.i);
    }
}

describe('SingleEvent', function () {

    //Ensure the test will run for no more than 5 seconds.
    jest.setTimeout(5000);

    it('start runtime with input.connect to output', done => {

        function emptyQueue(){
            console.log("Runtime has ended with an empty event queue.");
            // throw new Error("Runtime has failed.");
        };

        function failReactor(){
            throw new Error("Reactor has failed.");
        };

        // Tell the reactor runtime to successfully terminate after 3 seconds.
        let seTest = new SETest([3, TimeUnit.secs], done, failReactor, "SingleEventTesterApp");

        expect(expect(seTest.singleEvent).toBeInstanceOf(SingleEvent));
        expect(expect(seTest.logger).toBeInstanceOf(Logger));

        expect(seTest.singleEvent.o.canConnect(seTest.logger.i)).toBe(true);
        expect(seTest.logger.i.canConnect(seTest.singleEvent.o)).toBe(false);

        seTest._start(()=> null, emptyQueue);
    })
});