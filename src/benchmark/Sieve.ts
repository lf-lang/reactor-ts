import {Args, Parameter, InPort, OutPort, State, Triggers, Action, Reactor, App, TimeValue, Origin, Log, WritablePort} from "../core/internal";

Log.global.level = Log.levels.INFO;
class Ramp extends Reactor {
    next: Action<number>
    until: Parameter<number>
    value: OutPort<number> = new OutPort(this);
    constructor (parent:Reactor, until: number = 100000, period: TimeValue) {
        super(parent)
        this.until = new Parameter(until)
        this.next = new Action<number>(this, Origin.logical, period)
        this.addReaction(
            new Triggers(this.startup, this.next),
            new Args(this.schedulable(this.next), this.until, this.writable(this.value)),
            function (this, next, until, value) {
                let n = next.get()
                if (n === undefined) {
                    next.schedule(0, 2)
                } else {
                    if (n >= until.get()) {
                        this.util.requestStop()
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
    startPrime: Parameter<number>
    localPrimes: State<Array<number>>
    hasChild: State<boolean>
    constructor (parent:Reactor, startPrime: number, numberOfPrimes: number) {
        super(parent);
        //console.log("Created filter with prime: " + prime)
        this.startPrime = new Parameter(startPrime);
        this.localPrimes = new State(new Array<number>())
        this.hasChild = new State(false)
        this.addMutation(
            new Triggers(this.inp),
            new Args(this.inp, this.writable(this.out), this.startPrime, this.hasChild, this.localPrimes),
            function (this, inp, out, prime, hasChild, localPrimes) {
                let p = inp.get()
                if (p !== undefined) {            
                    let seen = localPrimes.get()
                    let size = seen.length
                    let div = false
                    for (let q of seen) {
                        if (Number.isInteger(p / q)) {
                            div = true
                            break                            
                        }
                    }
                    
                    if (!div) {
                        if (size < numberOfPrimes) {
                            seen.push(p)
                            console.log("Found new prime number " + p)
                        } else {
                            // Potential prime found.
                            if (!hasChild.get()) {                            
                                let n = new Filter(this.getReactor(), p, numberOfPrimes)
                                //this.start(n)
                                // console.log("CREATING...")
                                // let x = this.create(Filter, [this.getReactor(), p])
                                // console.log("CREATED: " + x._getFullyQualifiedName())
                                // FIXME: weird hack. Maybe just accept writable ports as well?
                                var port = (out as unknown as WritablePort<number>).getPort()
                                this.connect(port, n.inp)
                                // FIXME: this updates the dependency graph, but it doesn't redo the topological sort
                                // For a pipeline like this one, it is not necessary, but in general it is.
                                // Can we avoid redoing the entire sort?
                                hasChild.set(true)
                            } else {
                                out.set(p)
                            }
                        }  
                    }
                }
            }
        );
    }
}

class Sieve extends App {
    source: Ramp
    filter: Filter
    constructor (name: string, timeout: TimeValue | undefined = undefined, keepAlive: boolean = false, fast: boolean = false, success?: () => void, fail?: () => void) {
        super(timeout, keepAlive, fast, success, fail);
        this.source = new Ramp(this, 100000, TimeValue.nsec(1))
        this.filter = new Filter(this, 2, 1000)
        this._connect(this.source.value, this.filter.inp)
    }
}

let sieve = new Sieve('Sieve')
sieve._start();