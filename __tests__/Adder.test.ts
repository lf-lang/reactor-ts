
import {App, Port, Reactor, InPort, OutPort, Reaction, Readable, Writable} from '../src/core/reactor';
export class Adder extends Reactor {    
    
    in1: InPort<number> = new InPort(this);
    in2: InPort<number> = new InPort(this);
    out: OutPort<number> = new OutPort(this);

    constructor(parent:Reactor) {
        super(parent);
        this.addReaction(new class<T> extends Reaction<T> {
            //@ts-ignore
            react(in1: Readable<number>, in2: Readable<number>, out:Writable<number>):void {
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
        }(this, [this.in1, this.in2], this.check(this.in1, this.in2, this.getWritable(this.out))));
    }
}

class MyAdder extends Adder {
    public fire() {
        for (let r of this._reactions) {
            r.doReact();
        }
    }

    public getWriter(port: Port<unknown>) {
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

