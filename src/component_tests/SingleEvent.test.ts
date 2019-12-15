'use strict';

import {App} from '../reactor';
import {TimeUnit, TimeInterval} from "../time"
import { SingleEvent } from '../components/SingleEvent';
import { Logger } from '../components/Logger';

class SETest extends App{
    singleEvent: SingleEvent<any>;
    logger: Logger;

    constructor(timeout: TimeInterval, success: ()=> void, fail: ()=>void ){
        super(timeout)

        this.singleEvent = new SingleEvent(this, "SingleEvent");
        this.logger = new Logger(this, "foo");

        //Connect output of singleEvent to input of logger.
        this._connect(this.singleEvent.o, this.logger.i);
    }
}

describe('SingleEvent', function () {

    //Ensure the test will run for no more than 5 seconds.
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
        let seTest = new SETest([3, TimeUnit.secs], done, failReactor);

        expect(expect(seTest.singleEvent).toBeInstanceOf(SingleEvent));
        expect(expect(seTest.logger).toBeInstanceOf(Logger));
        
        expect(seTest.canConnect(seTest.singleEvent.o, seTest.logger.i)).toBe(true);
        expect(seTest.canConnect(seTest.logger.i, seTest.singleEvent.o)).toBe(false);

        seTest._start(()=> null, failRuntime);
    })
});