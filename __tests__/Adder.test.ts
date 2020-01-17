
import {App, Port, Reactor, InPort, OutPort, Reaction, Present, Writable, Args, Timer, Action, Triggers} from '../src/core/reactor';
import { TimeInterval, Origin} from '../src/core/time';

export class Adder extends Reactor {    
    
    in1: InPort<number> = new InPort(this);
    in2: InPort<number> = new InPort(this);
    out: OutPort<number> = new OutPort(this);
    
    constructor(parent:Reactor) {
        super(parent);
        
        this.addReaction(new class<T> extends Reaction<T> {
            
            //@ts-ignore
            react(in1: Port<number>, in2: Port<number>, out:Writable<number>):void {
                let a = in1.get();
                let b = in2.get();
                if (a == null) {
                    a = 0;
                }
                if (b == null) {
                    b = 0;
                }
                out.set(a + b);
            }
        }(this, new Triggers(this.in1, this.in2), new Args(this.in1, this.in2, this.getWritable(this.out))));
    }
}

class MyAdder extends Adder {
    public fire() {
        for (let r of this._reactions) {
            r.doReact();
        }
    }

    public getWriter(port: Port<Present>) {
        return this.getWritable(port);
    }
}

var app = new App();

describe('adder', function () {
    
    var adder = new MyAdder(app);

    it('2 + 1 = 3', function () {

        expect(adder).toBeInstanceOf(Adder);
        adder.getWriter(adder.in1).set(2);
        adder.getWriter(adder.in2).set(1);
        adder.fire();
        expect(adder.out.get()).toBe(3);
    });
});

