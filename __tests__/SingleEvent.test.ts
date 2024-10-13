import {App, Parameter, TimeValue} from "../src/core/internal";
import {SingleEvent} from "../src/share/SingleEvent";
import {Logger} from "../src/share/Logger";

class SETest extends App {
  singleEvent: SingleEvent<string>;

  logger: Logger;

  constructor(timeout: TimeValue, success: () => void, failure: () => void) {
    super(timeout, false, false, success, failure);
    this.singleEvent = new SingleEvent(this, new Parameter("foo"));
    this.logger = new Logger(this, "foo");

    // Connect output of singleEvent to input of logger.
    this._connect(this.singleEvent.o, this.logger.i);
  }
}

describe("SingleEvent", function () {
  // Ensure the test will run for no more than 5 seconds.
  jest.setTimeout(5000);

  it("start runtime with input.connect to output", (done) => {
    function failure() {
      throw new Error("Test has failed.");
    }

    // Tell the reactor runtime to successfully terminate after 3 seconds.
    const seTest = new SETest(TimeValue.secs(3), done, failure);

    expect(expect(seTest.singleEvent).toBeInstanceOf(SingleEvent));
    expect(expect(seTest.logger).toBeInstanceOf(Logger));

    expect(seTest.canConnect(seTest.singleEvent.o, seTest.logger.i)).toBeTruthy();
    expect(seTest.canConnect(seTest.logger.i, seTest.singleEvent.o)).toBeTruthy();

    seTest._start();
  });
});
