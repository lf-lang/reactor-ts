import {
  Reactor,
  App,
  OutPort,
  InPort,
} from "../src/core/internal";

/* Set a port in startup to get thing going */
class Starter extends Reactor {
  public in = new InPort<number>(this);

  public out = new OutPort<number>(this);

  constructor(parent: Reactor | null) {
    super(parent);
    this.addReaction(
      [this.in],
      [this.in, this.writable(this.out]),
      function (this, __in, __out) {
        __out.set(4);
      }
    );
  }
}

class R1 extends Reactor {
  public in = new InPort<number>(this);

  public out = new OutPort<number>(this);

  constructor(parent: Reactor | null) {
    super(parent);
    this.addReaction(
      [this.in],
      [this.in, this.writable(this.out]),
      function (this, __in, __out) {
        const tmp = __in.get();
        let out = 0;
        if (tmp) {
          out = tmp - 1;
        }
        if (out) {
          __out.set(out);
        }
      }
    );
  }
}

class R2 extends Reactor {
  public in = new InPort<number>(this);

  public out = new OutPort<number>(this);

  constructor(parent: Reactor | null) {
    super(parent);
    this.addReaction(
      [this.in],
      [this.in, this.writable(this.out]),
      function (this, __in, __out) {
        const tmp = __in.get();
        const out = 0;
        if (tmp && tmp == 0) {
          this.util.requestStop;
        } else {
          if (tmp) {
            __out.set(tmp - 1);
          }
        }
      }
    );
  }
}

class testApp extends App {
  start: Starter;

  reactor1: R1;

  reactor2: R2;

  constructor() {
    super();
    this.start = new Starter(this);
    this.reactor1 = new R1(this);
    this.reactor2 = new R2(this);
    this._connect(this.start.out, this.reactor1.in);
    this._connect(this.reactor1.out, this.reactor2.in);
    // this tests the accuracy of the CausalityGraph used in the connect function
    test("test if adding cyclic dependency is caught", () => {
      expect(() => {
        this._connect(this.reactor2.out, this.start.in);
      }).toThrowError("New connection introduces cycle.");
    });
  }
}

var app = new testApp();
app._start();
