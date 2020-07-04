/* file: __tests__/types/basic-type-tests.ts */
import { TimeValue } from '../../src/core/time';
import { App, Parameter, Reactor, Triggers, Present, Args, State, InPort, ReactionSandbox, Write, OutPort, Timer, Read } from '../../src/core/reactor';
import { SingleEvent } from '../../src/share/SingleEvent';

function print(this: ReactionSandbox, i: Read<unknown>, expected: State<unknown>) {
    const received = i.get();
    if (received) {
        console.log("Logging: " + received);
        if (received === expected.get()) {
            this.util.success();
        } else {
            this.util.failure();
        }
    } else {
        throw new Error("Log had no input available. This shouldn't happen because the logging reaction is triggered by the input");
    }
}

/* Logger class with explicit type */
class Logger<T extends Present>  extends Reactor {
    i = new InPort<T>(this);
    constructor(parent: Reactor, expected: Present) {
        super(parent);
        this.addReaction(new Triggers(this.i), new Args(this.i, new State(expected)), print);
    }
}

class SETest extends App {
    singleEvent: SingleEvent<string>;
    logger: Logger<number>; // Type mismatched with SingleEvent on purpose

    constructor(timeout: TimeValue, success: () => void, failure: () => void) {
        super(timeout, false, false, success, failure);
        this._setAlias("SETest");
        this.singleEvent = new SingleEvent(this, new Parameter("foo"));
        this.logger = new Logger(this, Number(4));

        // Connect output of singleEvent to input of logger.
        // @ts-expect-error
        this._connect(this.singleEvent.o, this.logger.i);
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
        // @ts-expect-error
        seTest.canConnect(seTest.singleEvent.o, seTest.logger.i);
        // @ts-expect-error
        seTest.canConnect(seTest.logger.i, seTest.singleEvent.o);

        seTest._start();
    });
});
