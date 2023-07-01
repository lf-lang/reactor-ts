import {
  App,
  Timer,
  Tuple,
  OutPort,
  TimeValue,
  Log
} from "../src/core/internal";

class OutputGetTest extends App {
  o: OutPort<number> = new OutPort<number>(this);

  t: Timer = new Timer(this, 0, 0);

  constructor(
    timeout: TimeValue,
    name: string,
    success: () => void,
    failure: () => void
  ) {
    super(timeout, true, false, success, failure);
    Log.global.debug(">>>>>>>>----" + this.util);
    this.addReaction(
      new Tuple(this.t),
      new Tuple(this.writable(this.o)),
      function (this, o) {
        Log.global.debug(">>>>>>>>>>being triggered>>>>>>>>>>>");
        if (o.get() != null) {
          throw new Error(
            "Calling get on an output before it has been set does not return null"
          );
        }
        o.set(5);
        if (o.get() !== 5) {
          throw new Error(
            "Calling get on an output after it has been set does not return the set value"
          );
        }
      }
    );
  }
}

// This test shows that a value may be obtained from an OutPort via get()
// once it has been set()
describe("OutputGetTest", function () {
  // Ensure the test will run for 5 seconds.
  jest.setTimeout(5000);

  it("start runtime", (done) => {
    console.log("starting test");

    function fail() {
      throw new Error("Test has failed.");
    }

    // Tell the reactor runtime to successfully terminate after 3 seconds.
    var oGetTest = new OutputGetTest(
      TimeValue.secs(1),
      "OutputGetTest",
      done,
      fail
    );

    oGetTest._start();
  });
});
