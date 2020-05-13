/* file: __tests__/types/basic-type-tests.ts */
import { TimeValue } from '../../src/core/time';
import { App, Parameter, Reactor, Triggers, Present, Args, State, InPort, ReactionSandbox, Write, OutPort, Timer } from '../../src/core/reactor';

class Logger extends Reactor {
    i = new InPort<number>(this);
    constructor(parent: Reactor, expected: Present) {
        super(parent);
        this.addReaction(new Triggers(this.i), new Args(this.i, new State(expected)), print);
    }
}

class SETest extends App {
    singleEvent: SingleEvent;
    logger: Logger;

    constructor(timeout: TimeValue, success: () => void, failure: () => void) {
        super(timeout, false, false, success, failure);
        this.setAlias("SETest");
        this.singleEvent = new SingleEvent(this, new Parameter("foo"));
        this.logger = new Logger(this, Number(4));

        // Connect output of singleEvent to input of logger.
        // $ExpectError
        this._connect(this.singleEvent.o, this.logger.i);
    }
}

function produceOutput(this: ReactionSandbox, o: Write<string>, payload: Parameter<string>) {
    o.set(payload.get());
        // FIXME: create a test that actually tests double sets.
    // It's confusing to have SingleEvent be a DoubleEvent.
    // Duplicate sets for the same port is bad form,
    // but its worth checking that the correct value (from the last set)
    // is delivered.
    console.log("Writing payload to SingleEvent's output.");
}

class SingleEvent extends Reactor {
    o: OutPort<string> = new OutPort<string>(this);
    t1: Timer = new Timer(this, 0, 0);
    constructor(parent: Reactor, private readonly payload: Parameter<string>) {
        super(parent);
        this.addReaction(
            new Triggers(this.t1),
            new Args(this.getWriter(this.o), this.payload),
            produceOutput
        );
    }
}

describe('SingleEvent', () => {
    // Ensure the test will run for no more than 5 seconds.
    jest.setTimeout(5000);

    it('start runtime with input.connect to output', done => {
        function failure() {
            throw new Error("Test has failed.");
        }

        // Tell the reactor runtime to successfully terminate after 3 seconds.
        const seTest = new SETest(new TimeValue(3), done, failure);
        // expect(expect(seTest.singleEvent).toBeInstanceOf(SingleEvent));
        // expect(expect(seTest.logger).toBeInstanceOf(Logger));
        // $ExpectError
        seTest.canConnect(seTest.singleEvent.o, seTest.logger.i);
        // $ExpectError
        seTest.canConnect(seTest.logger.i, seTest.singleEvent.o);

        seTest._start();
    });
});
