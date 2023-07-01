import {Tuple, WritablePort} from "../core/internal";
import {
  Parameter,
  InPort,
  OutPort,
  State,
  Action,
  Reactor,
  App,
  TimeValue,
  Origin,
  Log
} from "../core/internal";

Log.global.level = Log.levels.INFO;
class Ramp extends Reactor {
  next: Action<number>;

  until: Parameter<number>;

  value = new OutPort<number>(this);

  constructor(parent: Reactor, until = 100000, period: TimeValue) {
    super(parent);
    this.until = new Parameter(until);
    this.next = new Action<number>(this, Origin.logical, period);
    this.addReaction(
      new Tuple(this.startup, this.next),
      new Tuple(
        this.schedulable(this.next),
        this.until,
        this.writable(this.value)
      ),
      function (this, next, until, value) {
        const n = next.get();
        if (n === undefined) {
          next.schedule(0, 2);
        } else {
          if (n >= until.get()) {
            this.util.requestStop();
          } else {
            next.schedule(0, n + 1);
            value.set(n);
          }
        }
      }
    );
  }
}

class Filter extends Reactor {
  inp = new InPort<number>(this);

  out = new OutPort<number>(this);

  startPrime: Parameter<number>;

  localPrimes: State<number[]>;

  hasChild: State<boolean>;

  constructor(parent: Reactor, startPrime: number, numberOfPrimes: number) {
    super(parent);
    // console.log("Created filter with prime: " + prime)
    this.startPrime = new Parameter(startPrime);
    this.localPrimes = new State(new Array<number>());
    this.hasChild = new State(false);
    this.addMutation(
      new Tuple(this.inp),
      new Tuple(
        this.inp,
        this.writable(this.out),
        this.startPrime,
        this.hasChild,
        this.localPrimes
      ),
      function (this, inp, out, prime, hasChild, localPrimes) {
        const p = inp.get();
        if (p !== undefined) {
          const seen = localPrimes.get();
          const size = seen.length;
          let div = false;
          for (const q of seen) {
            if (Number.isInteger(p / q)) {
              div = true;
              break;
            }
          }

          if (!div) {
            if (size < numberOfPrimes) {
              seen.push(p);
              console.log(`Found new prime number ${p}`);
            } else {
              // Potential prime found.
              if (!hasChild.get()) {
                const n = new Filter(this.getReactor(), p, numberOfPrimes);
                // this.start(n)
                // console.log("CREATING...")
                // let x = this.create(Filter, [this.getReactor(), p])
                // console.log("CREATED: " + x._getFullyQualifiedName())
                // FIXME: weird hack. Maybe just accept writable ports as well?
                const port = (out as unknown as WritablePort<number>).getPort();
                this.connect(port, n.inp);
                // FIXME: this updates the dependency graph, but it doesn't redo the topological sort
                // For a pipeline like this one, it is not necessary, but in general it is.
                // Can we avoid redoing the entire sort?
                hasChild.set(true);
              } else {
                out.set(p);
              }
            }
          }
        }
      }
    );
  }
}

class Sieve extends App {
  source: Ramp;

  filter: Filter;

  constructor(
    name: string,
    timeout: TimeValue | undefined = undefined,
    keepAlive = false,
    fast = false,
    success?: () => void,
    fail?: () => void
  ) {
    super(timeout, keepAlive, fast, success, fail);
    this.source = new Ramp(this, 100000, TimeValue.nsec(1));
    this.filter = new Filter(this, 2, 1000);
    this._connect(this.source.value, this.filter.inp);
  }
}

const sieve = new Sieve("Sieve");
sieve._start();
