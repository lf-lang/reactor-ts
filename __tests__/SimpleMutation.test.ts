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
                __out.set(4)
            }
        )
    }



}

class R2 extends Reactor {
    public in = new InPort<number>(this);
    public out = new OutPort<number>(this);

    constructor(parent: Reactor|null) {
        super(parent);
        this.addMutation(
            new Triggers(this.in),
            new Args(this.in, this.out),
            function(this, __in, __out) {
                test('expect error to be thrown', () => { 
                    expect(() => {
                        this.connect(__out, __in)
                    }).toThrowError("ERROR connecting " + __out + " to " + __in)
                })
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
    }
}

var app = new testApp()
app._start()