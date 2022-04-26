import { Reactor, State, Bank, App, Triggers, Args, Timer, OutPort, InPort, TimeUnit, TimeValue, Origin, Log, LogLevel, Action } from '../src/core/internal';

class Starter extends Reactor {
    public out = new OutPort<number>(this);

    constructor(parent: Reactor|null) {
        super(parent);
        this.addReaction(
            new Triggers(this.startup),
            new Args(this.writable(this.out)),
            function(this, __out) {
                __out.set(Math.random());

            }
        );
    }
}

class Proliferator extends Reactor {
    public inStart = new InPort<number>(this);
    public collect = new InPort<number>(this);
    public random = new InPort<number>(this);
    public outRandom = new OutPort<number>(this);
    public out = new OutPort<number>(this);
    public sum = new State<number>(0);
    
    constructor(parent: Reactor|null) {
        super(parent);

        // this Mutation mimics a fork join pattern.  A Bank of 10 reactors are created, connections are made,
        // and a 'Collector' Reactor is instantiated to collect all the random numbers each reator creates
        this.addMutation(
            new Triggers(this.inStart),
            new Args(this.inStart, this.writable(this.outRandom)),
            function(this, __in, __out) {
                let b = new Bank(this.getReactor(), 10, Proliferator, this.getReactor())
                let collector = new Proliferator(this.getReactor())
                //FIXME: User Multiports?
                this.connect(b.get(0).out, collector.collect)
                this.connect(b.get(1).out, collector.collect)
                this.connect(b.get(2).out, collector.collect)
                this.connect(b.get(3).out, collector.collect)
                this.connect(b.get(4).out, collector.collect)
                this.connect(b.get(5).out, collector.collect)
                this.connect(b.get(6).out, collector.collect)
                this.connect(b.get(7).out, collector.collect)
                this.connect(b.get(8).out, collector.collect)
                this.connect(b.get(9).out, collector.collect)
                this.connect(__out.getPort(), b.get(0).random)
                this.connect(__out.getPort(), b.get(1).random)
                this.connect(__out.getPort(), b.get(2).random)
                this.connect(__out.getPort(), b.get(3).random)
                this.connect(__out.getPort(), b.get(4).random)
                this.connect(__out.getPort(), b.get(5).random)
                this.connect(__out.getPort(), b.get(6).random)
                this.connect(__out.getPort(), b.get(7).random)
                this.connect(__out.getPort(), b.get(8).random)
                this.connect(__out.getPort(), b.get(9).random)
                console.log('Mutation connections completed!')
                __out.set(1)

            }
        )

        // This reaction creates a random number which is sent to the Collector
        this.addReaction(
            new Triggers(this.random),
            new Args(this.random, this.writable(this.out)),
            function(this, __in, __out) {
                let r = Math.random()
                console.log('Reactor ' + this.getBankIndex + ' sent random number: ' + r);
                __out.set(r);
            }
        )

        // This reaction collects all the 10 random number sent from each member of the Bank
        this.addReaction(
            new Triggers(this.collect),
            new Args(this.collect, this.sum),
            function(this, __in, __out) {
                let v = __in.get()
                if (v) {
                    console.log('Received random number: ' + v)
                    let s = __out.get()
                    __out.set(s+v)
                }
                
            }
        )
    }
}

class TestApp extends App {
    start: Starter
    proliferator: Proliferator;

    constructor() {
        super()
        this.start = new Starter(this)
        this.proliferator = new Proliferator(this);
        this._connect(this.start.out, this.proliferator.inStart)
    }
    
}


describe("Creating ForkJoin pattern at runtime", function () {

    jest.setTimeout(100000);

    it("Check for success", done => {
        //Log.global.level = LogLevel.DEBUG

        let app = new TestApp()

        app._start();
    });

});
