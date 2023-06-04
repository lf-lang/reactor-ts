import type {IOPort, Present} from "../src/core/internal";
import {
  App,
  Reactor,
  Args,
  Triggers,
  InPort,
  OutPort
} from "../src/core/internal";

export class Adder extends Reactor {
  in1 = new InPort<number>(this);

  in2 = new InPort<number>(this);

  out = new OutPort<number>(this);

  constructor(parent: Reactor) {
    super(parent);

    this.addReaction(
      new Triggers(this.in1, this.in2),
      new Args(this.in1, this.in2, this.writable(this.out)),
      function (this, in1, in2, out) {
        // Type assertions allow coercion of null to 0.
        out.set((in1.get() as number) + (in2.get() as number));
      }
    );
  }
}

class MyAdder extends Adder {
  public fire() {
    for (const r of this._getReactions()) {
      r.doReact();
    }
  }

  public getProxy(port: IOPort<Present>) {
    return this.writable(port);
  }
}

var app = new App();

describe("adder", function () {
  var adder = new MyAdder(app);

  it("2 + 1 = 3", function () {
    expect(adder).toBeInstanceOf(Adder);
    adder.getProxy(adder.in1).set(2);
    adder.getProxy(adder.in2).set(1);
    adder.fire();
    expect(adder.out.get()).toBe(3);
  });
});
