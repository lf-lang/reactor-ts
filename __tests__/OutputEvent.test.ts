import {
  App,
  Reactor,
  Parameter,
  Tuple,
  TimeValue
} from "../src/core/internal";
import {SingleEvent} from "../src/share/SingleEvent";

/**
 * This reactor calls the success callback if it triggers a reaction in response
 * to a value being set to a contained reactor's output port.
 */
export class OutputResponder extends Reactor {
  se = new SingleEvent<string>(this, new Parameter("ContainedSingleEvent"));

  constructor(__parent__: Reactor) {
    super(__parent__);
    this.addReaction(
      new Tuple(this.se.o),
      new Tuple(),
      /**
       * If this reaction is triggered by an output event from the contained reactor,
       * succeed the test.
       */
      function (this) {
        this.util.requestStop();
      }
    );
  }
}

class OutputEventTest extends App {
  oResponder: OutputResponder = new OutputResponder(this);
}

// This test shows the OutputEvent reactor is able to trigger a reaction on
// a contained reactor's output.
describe("OutputEventTest", function () {
  // Ensure the test will run for 5 seconds.
  jest.setTimeout(5000);

  it("start runtime", (done) => {
    console.log("starting test");

    function fail() {
      throw new Error("Test has failed.");
    }

    // Tell the reactor runtime to successfully terminate after 3 seconds.
    var oEventTest = new OutputEventTest(
      TimeValue.secs(3),
      false,
      false,
      done,
      fail
    );
    // Don't give the runtime the done callback because we don't care if it terminates
    oEventTest._start();
  });
});
