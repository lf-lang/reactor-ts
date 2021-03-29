import {Args, Parameter, InPort, OutPort, State, Triggers, Action, Reactor, App, Present, WritablePort} from "../core/reactor";
import {TimeValue, Origin} from "../core/time"
import {Log} from "../core/util"

Log.global.level = Log.levels.INFO;

var primes: Array<boolean> = new Array(100000)

class Ramp extends Reactor {
    next = new Action<number>(this, Origin.logical)
    until: Parameter<number>;
    value: OutPort<number> = new OutPort(this);
    constructor (parent:Reactor, until: number = 100000) {
        super(parent);
        this.until = new Parameter(until);
        this.addReaction(
            new Triggers(this.startup, this.next),
            new Args(this.schedulable(this.next), this.until, this.writable(this.value)),
            function (this, next, until, value) {
                let n = next.get()
                if (n === undefined) {
                    primes[2] = true
                    next.schedule(0, 2)
                } else {
                    if (n >= until.get()) {
                        this.util.requestStop()
                        primes.filter((v, i) => v? console.log(i) : {})
                    } else {
                        next.schedule(0, n+1)
                        value.set(n)
                    }
                }
            }
        );
    }
}

class Filter extends Reactor {
    inp: InPort<number> = new InPort(this)
    out: OutPort<number> = new OutPort(this)
    prime: Parameter<number>
    hasSibling: State<boolean>
    constructor (parent:Reactor, prime: number) {
        super(parent);
        //console.log("Created filter with prime: " + prime)
        this.prime = new Parameter(prime);
        this.hasSibling = new State(false)
        this.addMutation(
            new Triggers(this.inp),
            new Args(this.inp, this.writable(this.out), this.prime, this.hasSibling),
            function (this, inp, out, prime, hasSibling) {
                let p = inp.get()
                if (p !== undefined) {                
                    let q = prime.get()
                    if (!Number.isInteger(p / q)) {
                        if (!hasSibling.get()) {
                            let n = new Filter(this.getReactor(), p)
                            //this.start(n)
                            // console.log("CREATING...")
                            // let x = this.create(Filter, [this.getReactor(), p])
                            // console.log("CREATED: " + x._getFullyQualifiedName())
                            // FIXME: weird hack. Maybe just accept writable ports as well?
                            var port = (out as unknown as WritablePort<number>).getPort()
                            this.connect(port, n.inp)
                            hasSibling.set(true)
                            primes[p] = true
                        } else {
                            out.set(p)
                        }
                    }
                }
            }
        );
    }
}

// class Print<T extends Present> extends Reactor {
//     inp = new InPort<T>(this)
//     constructor(parent: Reactor) {
//         super(parent)
//         this.addReaction(
//             new Triggers(this.inp),
//             new Args(this.inp),
//             function (this, inp) {
//                 console.log(inp.get())
//             }
//         );
//     }
// }

class Sieve extends App {
    source: Ramp
    filter: Filter
    constructor (name: string, timeout: TimeValue | undefined = undefined, keepAlive: boolean = false, fast: boolean = false, success?: () => void, fail?: () => void) {
        super(timeout, keepAlive, fast, success, fail);
        this.source = new Ramp(this, 100000)
        this.filter = new Filter(this, 2)
        this._connect(this.source.value, this.filter.inp)
    }
}

// Also see "Operational Semantics of a Parallel Object-Oriented Language" by Pierre America, Jaco de Bakker, Joost N. Kok, and Jan Rutten

let sieve = new Sieve('Sieve')
// ************* Starting Runtime for PingPong of class PingPong
sieve._start();