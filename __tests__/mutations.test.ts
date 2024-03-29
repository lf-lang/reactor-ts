import {
  Reactor,
  App,
  Timer,
  OutPort,
  InPort,
  TimeValue
} from "../src/core/internal";

class Source extends Reactor {
  timer = new Timer(this, 0, TimeValue.secs(1));

  output = new OutPort<Array<number>>(this);

  constructor(parent: Reactor) {
    super(parent);
    this.addReaction(
      [this.timer],
      [this.writable(this.output)],
      function (this, out) {
        out.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      }
    );
  }
}

class AddOne extends Reactor {
  input = new InPort<number[]>(this);

  output = new OutPort<number[]>(this);

  constructor(owner: Reactor, id: number) {
    super(owner);
    this.addReaction(
      [this.input],
      [this.input, this.writable(this.output)],
      function (this, input, output) {
        const val = input.get();
        if (val) {
          val[id] = val[id] + 1;
          output.set(val);
        }
        console.log("AddOne's reaction was invoked (id " + id + ")");
      }
    );
  }
}

class Print extends Reactor {
  input = new InPort<number[]>(this);

  constructor(owner: Reactor) {
    super(owner);
    this.addReaction([this.input], [this.input], function (this, input) {
      const val = input.get();
      console.log("Print reacting...");
      if (val !== undefined) {
        const expected = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        for (let i = 0; i < 10; i++) {
          if (val[i] != expected[i]) {
            this.util.requestErrorStop(
              "Expected: " + expected + " but got: " + val
            );
            return;
          }
        }
        console.log("Expected: " + expected + " and got: " + val);
      } else {
        this.util.requestErrorStop("Input undefined.");
      }
    });
  }
}

class Computer extends Reactor {
  in = new InPort<number[]>(this);

  out = new OutPort<number[]>(this);

  adder = new AddOne(this, 0);

  constructor(container: Reactor) {
    super(container);
    this._connect(this.in, this.adder.input);
    this.addMutation([this.in], [this.in], function (this, src) {
      const vals = src.get();
      if (vals) {
        let skip = true;
        for (const id of vals.keys()) {
          if (skip) {
            skip = false;
            continue;
          }
          const x = new AddOne(this.getReactor(), id);
          this.connect(src, x.input);
        }
      }
    });
    this.addReaction(
      [this.adder.output],
      [this.adder.output, this.writable(this.out)],
      function (this, adderout, out) {
        const arr = adderout.get();
        if (arr) {
          out.set(arr);
        }
      }
    );
  }
}

class ScatterGather extends App {
  source = new Source(this);

  compute = new Computer(this);

  print = new Print(this);

  constructor(timeout: TimeValue, success: () => void, fail: () => void) {
    super(timeout, false, false, success, fail);
    this._connect(this.source.output, this.compute.in);
    this._connect(this.compute.out, this.print.input);
    var self = this;
    this.addReaction([this.shutdown], [], function (this) {
      console.log(self._getPrecedenceGraph().toString());
    });
  }
}

class ZenoClock extends Reactor {
  tick: Timer;

  constructor(owner: Reactor, iteration: number) {
    super(owner);
    console.log("Creating ZenoClock " + iteration);
    this.tick = new Timer(this, 0, 0);
    this.addReaction([this.tick], [this.tick], function (this, tick) {
      console.log("Tick at " + this.util.getElapsedLogicalTime());
    });
    this.addReaction([this.shutdown], [], function (this) {
      console.log("Shutdown reaction of reactor " + iteration);
    });
    if (iteration < 5) {
      this.addMutation([this.tick], [this.tick], function (this, tick) {
        new ZenoClock(this.getReactor(), iteration + 1);
      });
    } else {
      this.util.requestStop();
    }
  }
}

class Zeno extends App {
  readonly zeno = new ZenoClock(this, 1);

  constructor(timeout: TimeValue, success: () => void, fail: () => void) {
    super(timeout, false, false, success, fail);

    var self = this;

    this.addReaction([this.shutdown], [], function (this) {
      console.log(self._getPrecedenceGraph().toString());
    });
  }
}

describe("Creating reactors at runtime", function () {
  jest.setTimeout(5000);

  it("Reactor with periodic timer", (done) => {
    // Log.global.level = Log.LogLevel.DEBUG

    const app = new Zeno(TimeValue.secs(4), done, () => {});

    app._start();
  });
});

// describe("Simple scatter gather", function () {

//     jest.setTimeout(5000);

//     it("Simple scatter gather", done => {
//         Log.global.level = Log.LogLevel.DEBUG

//         let app = new ScatterGather(TimeValue.secs(5),  done, () => {})

//         app._start();
//     });

// });
