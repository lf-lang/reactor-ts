'use strict';

import {App} from '../reactor';
import {TimeInterval} from "../time"
import {SingleEvent} from '../components/SingleEvent';
import {Logger} from '../components/Logger';

class SETest extends App {
    singleEvent: SingleEvent<any>;
    logger: Logger;

    constructor(timeout: TimeInterval, success: ()=> void, failure: ()=>void ) {
        super(timeout, "SETest", success, failure);

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

        function failure(){
            throw new Error("Test has failed.");
        };

        // Tell the reactor runtime to successfully terminate after 3 seconds.
        let seTest = new SETest(new TimeInterval(3), done, failure);

        expect(expect(seTest.singleEvent).toBeInstanceOf(SingleEvent));
        expect(expect(seTest.logger).toBeInstanceOf(Logger));
        
        expect(seTest.canConnect(seTest.singleEvent.o, seTest.logger.i)).toBe(false);
        expect(seTest.canConnect(seTest.logger.i, seTest.singleEvent.o)).toBe(false);

        seTest._start();
    })
});