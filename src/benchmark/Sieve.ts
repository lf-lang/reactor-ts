import {
  type WritablePort,
  Parameter,
  InPort,
  OutPort,
  State,
  Action,
  Reactor,
  App,
  TimeValue,
  Origin,
  Log,
  GraphDebugLogger
} from "../core/internal";

Log.global.level = Log.levels.INFO;
class Ramp extends Reactor {
  next: Action<number>;

  until: Parameter<number>;

  value = new OutPort<number>(this);

  constructor(parent: Reactor, until = 100000, period: TimeValue) {
    super(parent, "Ramp");
    this.until = new Parameter(until);
    this.next = new Action<number>(this, Origin.logical, period);
    this.addReaction(
      [this.startup, this.next],
      [this.schedulable(this.next), this.until, this.writable(this.value)],
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
    super(parent, `FilterFor${startPrime}`);
    // console.log("Created filter with prime: " + prime)
    this.startPrime = new Parameter(startPrime);
    this.localPrimes = new State(new Array<number>());
    this.hasChild = new State(false);
    this.addMutation(
      [this.inp],
      [
        this.inp,
        this.writable(this.out),
        this.startPrime,
        this.hasChild,
        this.localPrimes
      ],
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
              if (!primes.has(p)) {
                ;
              } else {
                primes.delete(p);
              }
            } else {
              // Potential prime found.
              if (!hasChild.get()) {
                const n = this.getReactor()._uncheckedAddSibling(Filter, p, numberOfPrimes);
                // this.start(n)
                // console.log("CREATING...")
                // let x = this.create(Filter, [this.getReactor(), p])
                // console.log("CREATED: " + x._getFullyQualifiedName())
                // FIXME: weird hack. Maybe just accept writable ports as well?
                const port = (out as unknown as WritablePort<number>).getPort();
                console.log("connecting......");
                this.connect(port, n.inp);
                printSieveGraph();
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
    super(timeout, keepAlive, fast, success, fail, name);
    this.source = new Ramp(this, 100000, TimeValue.nsec(1));
    this.filter = new Filter(this, 2, 1000);
    this._connect(this.source.value, this.filter.inp);
  }
}


const sieve = new Sieve("Sieve", undefined, undefined, undefined, ()=>{globalThis.graphDebugLogger?.write("debug0.json")});

const printSieveGraph = (): void => {
  const graph = sieve["_getPrecedenceGraph"]();
  const hierarchy = sieve._getNodeHierarchyLevels();
  const str = graph.toMermaidString(undefined, hierarchy);
  const time = sieve["util"].getElapsedLogicalTime();
  console.log(str);
  console.log(time);
}

globalThis.graphDebugLogger = new GraphDebugLogger(sieve);
globalThis.recording = false;

const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 9972, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997]);

sieve._start();
