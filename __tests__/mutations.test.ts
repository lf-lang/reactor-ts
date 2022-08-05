import {Reactor, App, Triggers, Args, Timer, OutPort, InPort, TimeValue} from '../src/core/internal';

class Source extends Reactor {

    timer = new Timer(this, 0, TimeValue.secs(1))
    output = new OutPort<Array<number>>(this)
    constructor(parent: Reactor) {
        super(parent)
        this.addReaction(new Triggers(this.timer), new Args(this.writable(this.output)), function(this, out) {
            out.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        });
    }
    
}

class AddOne extends Reactor {
    input = new InPort<number[]>(this)
    output = new OutPort<number[]>(this)

    constructor(owner: Reactor, id: number) {
        super(owner)
        this.addReaction(new Triggers(this.input), new Args(this.input, this.writable(this.output)), function(this, input, output) {
            let val = input.get()
            if (val) {
                val[id] = val[id]+1
                output.set(val)
            }
            console.log("AddOne's reaction was invoked (id " + id + ")")
        })
    }
}

class Print extends Reactor {
    input = new InPort<number[]>(this)

    constructor(owner: Reactor) {
        super(owner)
        this.addReaction(new Triggers(this.input), new Args(this.input), function(this, input) {
            let val = input.get()
            console.log("Print reacting...")
            if (val !== undefined) {
                let expected = [2, 3, 4, 5, 6 ,7, 8, 9, 10, 11]
                for (let i = 0; i < 10; i++) {
                    if (val[i] != expected[i]) {
                        this.util.requestErrorStop("Expected: " + expected + " but got: " + val)
                        return        
                    }
                }
                console.log("Expected: " + expected + " and got: " + val)
            } else {
                this.util.requestErrorStop("Input undefined.")
            }
        })
    }
}

class Computer extends Reactor {

    in = new InPort<number[]>(this);
    out = new OutPort<number[]>(this);

    adder = new AddOne(this, 0)

    constructor(container: Reactor) {
        super(container)
        this._connect(this.in, this.adder.input)
        this.addMutation(new Triggers(this.in), new Args(this.in), function(this, src) {
            let vals = src.get()
            if (vals) {
                let skip = true
                for (let id of vals.keys()) {
                    if (skip) {
                        skip = false
                        continue
                    }
                    let x = new AddOne(this.getReactor(), id)
                    this.connect(src, x.input)
                }
            }
        })
        this.addReaction(new Triggers(this.adder.output), new Args(this.adder.output, this.writable(this.out)), function(this, adderout, out) {
            let arr = adderout.get()
            if (arr) {
                out.set(arr)
            }
        })
    }
}

class ScatterGather extends App {
    
    source = new Source(this)

    compute = new Computer(this)

    print = new Print(this)

    constructor(timeout: TimeValue,  success: () => void, fail: () => void) {
        super(timeout, false, false, success, fail);
        this._connect(this.source.output, this.compute.in)
        this._connect(this.compute.out, this.print.input)
        var self = this
        this.addReaction(new Triggers(this.shutdown), new Args(), function(this) {
            console.log(self._getPrecedenceGraph().toString())
        })
    }
}

class ZenoClock extends Reactor {
    tick:Timer;
    constructor(owner: Reactor, iteration: number) {
        super(owner)
        console.log("Creating ZenoClock " + iteration)
        this.tick = new Timer(this, 0, 0)
        this.addReaction(new Triggers(this.tick), new Args(this.tick), function(this, tick) {
            console.log("Tick at " + this.util.getElapsedLogicalTime())
        })
        this.addReaction(new Triggers(this.shutdown), new Args(), function(this) {
            console.log("Shutdown reaction of reactor " + iteration)
        })
        if (iteration < 5) {
            this.addMutation(new Triggers(this.tick), new Args(this.tick), function(this, tick) {
                new ZenoClock(this.getReactor(), iteration + 1)
            })
        } else {
            this.util.requestStop()
        }        
    }
}

class Zeno extends App {
    readonly zeno = new ZenoClock(this, 1)
    constructor(timeout: TimeValue,  success: () => void, fail: () => void) {
        super(timeout, false, false, success, fail);
        
        var self = this;
    
        this.addReaction(new Triggers(this.shutdown), new Args(), function(this) {
            console.log(self._getPrecedenceGraph().toString())
        })
    }
}

describe("Creating reactors at runtime", function () {

    jest.setTimeout(5000);

    it("Reactor with periodic timer", done => {
        //Log.global.level = LogLevel.DEBUG

        let app = new Zeno(TimeValue.secs(4),  done, () => {})

        app._start();
    });

});

// describe("Simple scatter gather", function () {

//     jest.setTimeout(5000);

//     it("Simple scatter gather", done => {
//         Log.global.level = LogLevel.DEBUG

//         let app = new ScatterGather(TimeValue.secs(5),  done, () => {})

//         app._start();
//     });

// });
