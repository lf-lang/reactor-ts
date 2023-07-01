import {
  Reactor,
  App,
  CalleePort,
  CallerPort,
  InPort,
  TimeUnit,
  TimeValue,
  Log,
  LogLevel
} from "../src/core/internal";

class R extends Reactor {
  public inp = new InPort(this);

  public calleep = new CalleePort(this);

  public callerp = new CallerPort(this);

  constructor(parent: Reactor | null) {
    super(parent);
    this.callerp.remotePort = this.calleep;
    this.addReaction(
      [this.calleep],
      [],
      function (this) {
        throw new Error("Method not implemented.");
      },
      TimeValue.withUnits(10, TimeUnit.msec)
    );

    this.addReaction(
      [this.inp],
      [this.callerp],
      function (this) {
        throw new Error("Method not implemented.");
      },
      TimeValue.withUnits(10, TimeUnit.msec)
    );
  }

  start() {
    this.callerp.set(4);
  }

  getNodes() {
    return this._getReactions();
  }
}

describe("Testing Error Cases", function () {
  Log.global.level = LogLevel.DEBUG;

  it("Multiple reactions for a callee port", () => {
    var parent = new App();
    var reactor1 = new R(parent);
    var trigger = [reactor1.calleep];

    /* expect(() => { reactor1.addReaction(
            trigger,
            new Args(),
            function(this) {
                reactor1.callerp.set(4);
            }
        );}).toThrowError("Each callee port can trigger only a single reaction, but two or more are found.")
            */
  });

  it("Multiple triggers", function () {
    var parent = new App();
    var reactor1 = new R(parent);
    var trigger = [reactor1.calleep, new CalleePort(reactor1)];

    /* expect( () => { reactor1.addReaction(
            trigger,
            new Args(),
            function(this) {
                throw new Error("Method not implemented.");
            }
        );} ).toThrowError("Procedure has multiple triggers.") */
  });

  it("Bad Parents", function () {
    var parent = new App();

    expect(() => {
      var reactor1 = new R(null);
    }).toThrowError("Cannot instantiate component without a parent.");

    expect(() => {
      var cport = new CalleePort(new R(null));
    }).toThrowError("Cannot instantiate component without a parent.");

    var reactor = new R(new App());
    var reactor2 = new R(new App());

    /* var trigger = new Triggers(new TP(reactor));

        expect ( () => { reactor2.addReaction(
            trigger,
            new Args(),
            function(this) {
                throw new Error("Method not implemented.");
            }
        );}).toThrowError("Port App/R/TP is a trigger for reaction App/R[R2] but is neither a child of the reactor containing the reaction or that reactor's children.")
         */
  });
});
