import { Reactor, App, Triggers, Args, Timer, OutPort, InPort, TimeUnit, TimeValue, Origin, Log, LogLevel, Action } from '../src/core/internal';

/* Set a port in startup to get thing going */
class Starter extends Reactor {
    public out = new OutPort<number>(this);

    constructor(parent: Reactor|null) {
        super(parent);
        this.addReaction(
            new Triggers(this.startup),
            new Args(this.writable(this.out)),
            function(this, __out) {
                __out.set(4);

            }
        );
    }
}

class R1 extends Reactor {
    public in = new InPort<number>(this);
    public out = new OutPort<number>(this);

    constructor(parent: Reactor|null) {
        super(parent);
        this.addReaction(
            new Triggers(this.in),
            new Args(this.in, this.writable(this.out)),
            function(this, __in, __out) {
                let tmp = __in.get()
                let out:number = 0
                if (tmp) {
                    out = tmp - 1;
                }
                if (out) {
                    __out.set(out)
                }
            }
        )
    }
}

class R2 extends Reactor {
    public in = new InPort<number>(this);
    public out = new OutPort<number>(this);

    constructor(parent: Reactor|null) {
        super(parent);
        this.addReaction(
            new Triggers(this.in),
            new Args(this.in, this.writable(this.out)),
            function(this, __in, __out) {
                let tmp = __in.get()
                let out:number = 0;
                if(tmp && tmp == 0) {
                    this.util.requestStop
                } else {
                    if (tmp) {
                        __out.set(tmp - 1)
                    }
                }
            }
        )
    }
}

class testApp extends App {
    start: Starter
    reactor1: R1;
    reactor2: R2;

    constructor () {
        super();
        this.start = new Starter(this);
        this.reactor1 = new R1(this);
        this.reactor2 = new R2(this);
        this._connect(this.start.out, this.reactor1.in)
        this._connect(this.reactor1.out, this.reactor2.in)
        // this tests the accuracy of the CausalityGraph used in the connect function 
        test('test if adding cyclic dependency is caught', () => {
            expect(() => {
                this._connect(this.reactor2.in, this.reactor1.out)
            }).toThrowError("New connection introduces cycle.")
        })
    }
}

var app = new testApp()
app._start()