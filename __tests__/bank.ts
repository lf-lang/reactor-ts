import { Bank } from "../src/core/bank";
import { Reactor, App, Timer, Triggers, Args, InPort, Present, OutPort} from "../src/core/reactor";
import { TimeValue } from "../src/core/time";

class Periodic extends Reactor {
    
    t: Timer = new Timer(this, 0, TimeValue.sec(1));
    o: OutPort<number> = new OutPort(this)
    constructor(parent: Reactor) {
        super(parent)
        this.addReaction(
            new Triggers(this.t),
            new Args(this.t),
            function (this) {
                console.log(this.getBankIndex());
            }
        );
    }
}

class Generic<T extends Present> extends Reactor {
    input: InPort<T> = new InPort(this);
}

describe('Check bank index', () => {
    
    class myApp extends App {
        b = new Bank(3, Periodic, this)
        c = new Bank<Generic<number>, [Reactor]>(2, Generic, this);
        constructor() {
            super();
            it('contained actor name', () => {
                        expect(this.b.get(0).getBankIndex()).toBe(0);
                        expect(this.b.get(1).getBankIndex()).toBe(1);
                        expect(this.b.get(2).getBankIndex()).toBe(2);
                    });
            
            it('generic bank', () => {
                this.c.all().forEach(r => expect(typeof r.input == "number"))
            });
            var foo = this.b.select((member) => member.o)
            var bar = [this.b.get(0).o, this.b.get(1).o, this.b.get(2).o]
            it('select port', () => {
                for (let i=0; i < foo.length; i++) {
                    expect(foo[i]).toBe(bar[i]);
                }
            });
        }
    }

    new myApp();

});
