import {Reactor, App, Triggers, InPort, Args, OutPort, Timer} from '../src/core/reactor';
import {TimeValue} from '../src/core/time';
import {Log, LogLevel} from '../src/core/util';


class Source extends Reactor {

    timer = new Timer(this, 0, new TimeValue(1000))
    output = new OutPort<null>(this)
    constructor(parent: Reactor) {
        super(parent)
        // this.addReaction(new Triggers(this.timer), new Args(this.writable(this.output)), function(this, out, state) {
        //     out.set(null)
        // });
    }
    
}

class AddOne extends Reactor {
    input = new InPort<number[]>(this)
    output = new OutPort<number[]>(this)

    constructor(owner: Reactor) {
        super(owner)
        this.addMutation(new Triggers(this.input), new Args(this.input), function(this, input) {
            let arr = input.get()
            //new AddOne(this.getReactor())
            if (arr !== undefined) {
                // for (let elem of arr) {
                //     let instance = this.newChild(this, (parent:Reactor) => {new AddOne(parent)})
                // }
            }  
            
        })
    }
}

class Print extends Reactor {
    input = new InPort<number[]>(this)
}

/* Set a port in startup to get thing going */
class ScatterGather extends App {
    
    source = new Source(this)

    adder = new AddOne(this)

    print = new Print(this)

    constructor() {
        super()
        //this._connect(this.source.output, this.adder.input)
        this._connect(this.adder.output, this.print.input)
    }
    
}

class ZenoClock extends Reactor {
    tick:Timer;
    constructor(owner: Reactor, iteration: number) {
        super(owner, "ZenoClock(" + iteration + ")")
        console.log("Creating ZenoClock " + iteration)
        this.tick = new Timer(this, 0, 0)
        this.addReaction(new Triggers(this.tick), new Args(this.tick), function(this, tick) {
            console.log("Tick at " + this.util.getElapsedLogicalTime())
        })
        this.addReaction(new Triggers(this.shutdown), new Args(), function(this) {
            console.log("Shutdown reaction of reactor " + iteration)
        })
        if (iteration < 100) {
            this.addMutation(new Triggers(this.tick), new Args(this.tick), function(this, tick) {
                new ZenoClock(this.getReactor(), iteration + 1)
            })
        } else {
            this.util.requestShutdown(true)
        }        
    }
}

class Zeno extends App {
    start = new ZenoClock(this, 1)
    constructor(timeout: TimeValue,  success: () => void, fail: () => void) {
        super(timeout, false, false, success, fail);
    }
}

describe("Creating reactors at runtime", function () {

    jest.setTimeout(5000);

    it("Reactor with periodic timer", done => {
        Log.global.level = LogLevel.DEBUG

        let app = new Zeno(new TimeValue(5),  done, () => {})

        app._start();
    });

});


// describe("Building connections at runtime", function () {

//     jest.setTimeout(5000);

//     it("Missed reaction deadline on InPort", done => {
//         Log.global.level = LogLevel.WARN

//         function fail() {
//             throw new Error("Test has failed.");
//         };
        
//         let app = new ScatterGather()

//         // spyOn(app, '_start').and.callThrough

//         // expect(() => {app._start()}).toThrowError("Deadline violation occurred!");

//         /* FIXME: Deadlines are not working */
//         app._start();
//     });

// });