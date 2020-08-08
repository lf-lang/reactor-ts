import {Args, Parameter, InPort, OutPort, State, Triggers, Action, Reactor, App, Present} from "../core/reactor";
import {TimeValue, Origin} from "../core/time"
import {Log} from "../core/util"

Log.global.level = Log.levels.ERROR;

class Ramp extends Reactor {
    next = new Action<number>(this, Origin.logical)
    until: Parameter<number>;
    value: OutPort<number>;
    constructor (parent:Reactor, until: number = 100000) {
        super(parent);
        this.until = new Parameter(until);
        this.addReaction(
            new Triggers(this.startup, this.next),
            new Args(this.schedulable(this.next), this.until, this.writable(this.value)),
            function (this, next, until, value) {
                if (next.get() !== undefined) {
                    value.set(1)
                } else {
                    let n = next.get()
                    if (n > until.get()) {
                        this.util.requestShutdown()
                    } else {
                        value.set(n)
                        
                    }
                }
            }
        );
    }
}

class Filter extends Reactor {
    inp: InPort<number>
    out: OutPort<number>
    prime: Parameter<number>
    hasSibling: State<boolean>
    constructor (parent:Reactor, prime: number) {
        super(parent);
        this.prime = new Parameter(prime);
        this.hasSibling = new State(false)
        this.addMutation(
            new Triggers(this.inp),
            new Args(this.inp, this.writable(this.out), this.prime, this.hasSibling),
            function (this, inp, out, prime, hasSibling) {
                let p = inp.get()
                if (!Number.isInteger(inp.get() / prime.get())) {
                    if (!hasSibling) {
                        //this.newSibling()
                        //this.disconnect()
                        //this.connect()
                        hasSibling.set(true)
                    }
                    out.set(p)
                }
            }
        );
    }
}

class Print<T extends Present> extends Reactor {
    inp: InPort<T>
    constructor(parent: Reactor) {
        super(parent)
        this.addReaction(
            new Triggers(this.inp),
            new Args(this.inp),
            function (this, inp) {
                console.log(inp.get())
            }
        );
    }
}

class Sieve extends App {
    source: Ramp
    filter: Filter
    print: Print<number>
    constructor (name: string, timeout: TimeValue | undefined = undefined, keepAlive: boolean = false, fast: boolean = false, success?: () => void, fail?: () => void) {
        super(timeout, keepAlive, fast, success, fail);
        this.source = new Ramp(this, 1000000)
        this.filter = new Filter(this, 2)
        this.print = new Print(this)
        this._connect(this.source.value, this.filter.inp)
        this._connect(this.filter.out, this.print.inp)
    }
}

// Also see "Operational Semantics of a Parallel Object-Oriented Language" by Pierre America, Jaco de Bakker, Joost N. Kok, and Jan Rutten

let sieve = new Sieve('Sieve')
// ************* Starting Runtime for PingPong of class PingPong
sieve._start();
