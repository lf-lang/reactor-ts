import {App, InPort, OutPort, Reactor} from "../src/core/internal";

// Readers might wonder why this test case exist;
// This is mainly because in the past, we assume direct feedthrough is forbidden, and will not establish the connection if we try to do so. However, it is possible that such a thing happen without introducing any causality issue.
describe("Direct feedthrough without causality issue", () => {
  class BigReactor extends App {
    public children: SmallReactor;

    constructor() {
      super(undefined, false, false);
      this.children = new SmallReactor(this);
    }
  }

  class SmallReactor extends Reactor {
    public inp: InPort<number>;
    public outp: OutPort<number>;

    constructor(parent: Reactor) {
      super(parent);
      this.inp = new InPort(this);
      this.outp = new OutPort(this);
      this.addMutation(
        [this.startup],
        [this.inp, this.outp],
        function (this, inp, outp) {
          it("test", () => {
            expect(this.getReactor().canConnect(inp, outp)).toBeFalsy();
          });
        }
      );
    }
  }

  const root = new BigReactor();
  root._start();
});

describe("Causality loop that can't be detected by only checking local graph", () => {
  class FeedThrougher extends Reactor {
    public inp = new InPort(this);
    public outp = new OutPort(this);

    constructor(parent: Reactor) {
      super(parent);
      this.addReaction(
        [this.inp],
        [this.inp, this.writable(this.outp)],
        function (this, inp, outp) {
          // nop troll
        }
      );
    }
  }

  class Looper extends Reactor {
    public leftChild = new FeedThrougher(this);
    public rightChild = new FeedThrougher(this);

    public inp = new InPort(this);
    public outp = new OutPort(this);

    constructor(parent: Reactor) {
      super(parent);
      this.addMutation(
        [this.startup],
        [
          this.inp.asConnectable(),
          this.outp.asConnectable(),
          this.leftChild.inp.asConnectable(),
          this.leftChild.outp.asConnectable(),
          this.rightChild.inp.asConnectable(),
          this.rightChild.outp.asConnectable()
        ],
        function (this, inp, outp, inp_lc, outp_lc, inp_rc, outp_rc) {
          this.connect(inp, inp_lc);
          this.connect(outp_rc, outp);
        }
      );
    }
  }

  class TestApp extends App {
    public child = new Looper(this);

    constructor() {
      super(undefined, undefined, undefined, () => {});
      this._connect(this.child.outp, this.child.inp);
      it("Test a connection that would create zero delay loop cannot be made", () => {
        expect(
          this.canConnect(this.child.leftChild.outp, this.child.rightChild.inp)
        ).toBeTruthy();
      });
    }
  }

  const app = new TestApp();
  app._start();
});
