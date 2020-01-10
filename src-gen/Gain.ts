import {Variable, Priority, VarList, Mutations, Util, Readable, Schedulable, Writable, Named, Reaction, Deadline, Action, Startup, Scheduler, Timer, Reactor, Port, OutPort, InPort, App } from "./reactor";
import {TimeUnit,TimeInterval, UnitBasedTimeInterval, TimeInstant, Origin, getCurrentPhysicalTime } from "./time"
// Code generated by the Lingua Franca compiler for reactor Scale in Gain
// =============== START reactor class Scale
class Scale extends Reactor {
    scale: number; // Parameter
    x: InPort<number>;
    y: OutPort<number>;
    constructor(scale: number, parent:Reactor) {
        super(parent);
        this.scale = scale; // Parameter
        this.x = new InPort<number>(this);
        this.y = new OutPort<number>(this);
        this.addReaction(new class<T> extends Reaction<T> {
            //@ts-ignore
            react(x: Readable<number>, y: Writable<number>, ) {
                var self = this.parent as Scale;
                y.set((x.get() as number) * self.scale);
            }
        }(this, this.check(this.x, ), this.check(this.x, this.getWritable(this.y),)));
    }
}
// =============== END reactor class Scale

// Code generated by the Lingua Franca compiler for reactor Test in Gain
// =============== START reactor class Test
class Test extends Reactor {
    received_value: boolean; // State
    x: InPort<number>;
    constructor(parent:Reactor) {
        super(parent);
        this.received_value = false; // State
        this.x = new InPort<number>(this);
        this.addReaction(new class<T> extends Reaction<T> {
            //@ts-ignore
            react(x: Readable<number>, ) {
                var self = this.parent as Test;
                console.log("Received " + x.get() + ".");
                self.received_value = true;
                if ((x.get() as number) != 2) {
                    console.log("ERROR: Expected 2!");
                    self.util.failure();
                    //throw new Error("ERROR: Expected 2!");
                }
            }
        }(this, this.check(this.x, ), this.check(this.x, )));
        this.addReaction(new class<T> extends Reaction<T> {
            //@ts-ignore
            react() {
                var self = this.parent as Test;
                if (!self.received_value){
                    console.log("ERROR: No value received by Test reactor!");
                    self.util.failure();
                    //throw new Error("No value received by Test reactor!");
                } else {
                    console.log("Test passes");
                }
            }
        }(this, this.check(this.shutdown, ), this.check()));
    }
}
// =============== END reactor class Test

// Code generated by the Lingua Franca compiler for reactor Gain in Gain
// =============== START reactor class Gain
class Gain extends App {
    g: Scale
    d: Test
    constructor(name: string, timeout: TimeInterval | null, success?: ()=> void, fail?: ()=>void) {
        super(timeout, success, fail);
        this.g = new Scale(2, this)
        this.d = new Test(this)
        this._connect(this.g.y, this.d.x);
        this.addReaction(new class<T> extends Reaction<T> {
            //@ts-ignore
            react(g: { x: Writable,  }, ) {
                var self = this.parent as Gain;
                g.x.set(1);
            }
        }(this, this.check(this.startup, ), this.check({ x: this.getWritable(this.g.x),  }, )));
    }
}
// =============== END reactor class Gain

// ************* Instance Gain of class Gain
let _app = new Gain('Gain', null)
// ************* Starting Runtime for Gain of class Gain
_app._start();