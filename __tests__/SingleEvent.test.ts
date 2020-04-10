import {App, Parameter} from '../src/core/reactor';
import {TimeValue} from "../src/core/time"
import {SingleEvent} from '../src/share/SingleEvent';
import {Logger} from '../src/share/Logger';

// Prevent any of Jest's command line arguments from reaching the tested code.
process.argv = process.argv.slice(0,2);

class SETest extends App {
    singleEvent: SingleEvent<any>;
    logger: Logger;

    constructor(timeout: TimeValue, success: ()=> void, failure: ()=>void ) {
        super(timeout, false, false, success, failure);
        this.setAlias("SETest");
        this.singleEvent = new SingleEvent(this, new Parameter("foo"));
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
        let seTest = new SETest(new TimeValue(3), done, failure);

        expect(expect(seTest.singleEvent).toBeInstanceOf(SingleEvent));
        expect(expect(seTest.logger).toBeInstanceOf(Logger));
        
        expect(seTest.canConnect(seTest.singleEvent.o, seTest.logger.i)).toBe(false);
        expect(seTest.canConnect(seTest.logger.i, seTest.singleEvent.o)).toBe(false);

        seTest._start();
    })
});