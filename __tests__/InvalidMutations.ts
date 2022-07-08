import { Reactor, State, Bank, App, Triggers, Args, Timer, OutPort, InPort, TimeUnit, TimeValue, Origin, Log, LogLevel, Action } from '../src/core/internal';

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
    public in1 = new InPort<number>(this);
    public in2 = new InPort<number>(this);
    public out1 = new OutPort<number>(this);
    public out2 = new OutPort<number>(this);

    constructor(parent: Reactor|null) {
        super(parent);
        this.addReaction(
            new Triggers(this.in1),
            new Args(this.in1, this.writable(this.out1)),
            function(this, __in, __out) {
                __out.set(4)
            }
        )
        this.addReaction(
            new Triggers(this.in2),
            new Args(this.in2, this.writable(this.out2)),
            function(this, __in, __out) {
                __out.set(4)
            }
        )

        this.addMutation(
            new Triggers(this.in1),
            new Args(this.in1, this.out2),
            function(this, __in1, __out2) {
                test('expect error to be thrown on mutation creating loop', () => { 
                    expect(() => {
                        this.connect(__out2, __in1)
                    }).toThrowError("New connection introduces cycle.")
                    expect(() => {
                        this.connect(__in1, __out2)
                    }).toThrowError("New connection introduces direct feed through.") // dist port already in use
                    
                    // let R2 = new R1(this.getReactor())
                    // expect(() => {
                    //     // this.connect(R2.out1, R2.in1)
                    //     // this.connect(R2.in1, R2.out1)
                    //     // this.connect(R2.in1, R2.out1)
                    //     this.connect(R2.out1, R2.in1)
                    // }).toThrowError("New connection introduces cycle.")
                })
                // console.log("TEST START!")
                // test('expect error on mutation creating race condition', () => {
                //     expect(() => {
                //         //this.canConnect(__in1)
                //         // console.log("Can Connect: ", this.getReactor().canConnect(__in1, __out2))
                        
                //         this.connect(__in1, __out2)
                //     }).toThrowError("New connection introduces direct feed through.")
                // })
                // let R2 = new R1(this.getReactor())
                // test('expect error on spawning and creating loop within a reactor', () => {
                //     expect(() => {
                //         this.connect(__out2, __in1)
                //     }).toThrowError("New connection introduces cycle.")
                // })
                test('expect error on mutation creating race condition', () => {
                    expect(() => {
                        this.connect(__in1, __out2)
                    }).toThrowError("New connection introduces direct feed through.")
                })
                let R2 = new R1(this.getReactor())
                test('expect error on spawning and creating loop within a reactor', () => {
                    expect(() => {
                        this.connect(R2.in1, R2.out1)
                        this.connect(R2.out1, R2.in1)
                    }).toThrowError("New connection introduces cycle.")
                })
            }   
        )
    }

}

class testApp extends App {
    start: Starter
    reactor1: R1;

    constructor () {
        super();
        this.start = new Starter(this);
        this.reactor1 = new R1(this);
        this._connect(this.start.out, this.reactor1.in1)
        this._connect(this.reactor1.out1, this.reactor1.in2)
    }
}

var app = new testApp()
app._start()
