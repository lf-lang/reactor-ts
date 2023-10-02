import {Reactor, App, OutPort, InPort} from "../src/core/internal";

class Starter extends Reactor {
  public out = new OutPort<number>(this);

  constructor(parent: Reactor | null) {
    super(parent);
    this.addReaction(
      [this.startup],
      [this.writable(this.out)],
      function (this, __out) {
        __out.set(4);
      }
    );
  }
}

class R1 extends Reactor {
  public in1 = new InPort<number>(this);

  public in2 = new InPort<number>(this);

  public out1 = new OutPort<number>(this);

  public out2 = new OutPort<number>(this);

  constructor(parent: Reactor | null) {
    super(parent);
    this.addReaction(
      [this.in1],
      [this.in1, this.writable(this.out1)],
      function (this, __in, __out) {
        __out.set(4);
      }
    );

    this.addMutation(
      [this.in1],
      [this.in1, this.in2, this.out1, this.out2],
      function (this, __in1, __in2, __out1, __out2) {
        test("expect error when creating connection outside container", () => {
          expect(() => {
            this.connect(__out2.asConnectable(), __in2.asConnectable());
          }).toThrowError("New connection is outside of container.");
        });
        const R2 = new R1(this.getReactor());
        test("expect error on mutation creating race condition on an output port", () => {
          expect(() => {
            this.connect(R2.out1.asConnectable(), __out1.asConnectable());
          }).toThrowError("Destination port is already occupied.");
        });
        test("expect error on spawning and creating loop within a reactor", () => {
          expect(() => {
            this.connect(R2.out1.asConnectable(), R2.in1.asConnectable());
          }).toThrowError("New connection introduces cycle.");
        });
      }
    );
  }
}

class testApp extends App {
  start: Starter;

  reactor1: R1;

  constructor() {
    super();
    this.start = new Starter(this);
    this.reactor1 = new R1(this);
    this._connect(this.start.out, this.reactor1.in1);
  }
}

var app = new testApp();
app._start();
