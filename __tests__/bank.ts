import type { Present} from "../src/core/internal";
import {Bank , Reactor, App, Timer, Triggers, Args, OutPort, InPort, TimeValue, OutMultiPort, Port} from "../src/core/internal";

class Periodic extends Reactor {
    
    t: Timer = new Timer(this, 0, TimeValue.sec(1));

    o = new OutPort<number>(this)

    constructor (parent: Reactor) {
        super(parent)
        const writer = this.writable(this.o);
        this.addReaction(
            new Triggers(this.t),
            new Args(this.t),
            function (this) {
                console.log(this.getBankIndex());
            }
        );
    }
}

class MultiPeriodic extends Reactor {
    
    t: Timer = new Timer(this, 0, TimeValue.sec(1));

    o = new OutMultiPort<number>(this, 2)

    constructor (parent: Reactor) {
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
    input = new InPort<T>(this);
}

describe("Check bank index", () => {
    
    class myApp extends App {
        b = new Bank(this, 3, Periodic, this)

        c = new Bank<Generic<number>, [Reactor]>(this, 2, Generic, this);

        d = new Bank(this, 3, MultiPeriodic, this)

        constructor () {
            super();
            const ports = new Array<OutPort<number>>()
            const multiPorts = new Array<OutMultiPort<number>>()
            test("throw error on mismatch in lenght of ports", () => {
                expect(() => this.b.writable(ports)).toThrowError("Length of ports does not match length of reactors.")
                expect(() => this.b.allWritable(multiPorts)).toThrowError("Length of ports does not match length of reactors.")
            })

            const allWriter = this.d.allWritable(this.d.port((member) => (member.o)));            
            const writer = this.b.writable(this.b.port((member) => (member.o)));
            test("check multiport width", () => {
                expect(allWriter[0].width()).toBe(2);
            }) 
            test("check ioport width", () => {
                expect(writer[0].getPort.length).toBe(0);
            })
            test("contained bank member name", () => {
                expect(this.b.get(0)._getFullyQualifiedName()).toBe("myApp.b[0]")
                expect(this.b.get(1)._getFullyQualifiedName()).toBe("myApp.b[1]")
                expect(this.b.get(2)._getFullyQualifiedName()).toBe("myApp.b[2]")
            })
            it("contained bank member index", () => {
                expect(this.b.get(0).getBankIndex()).toBe(0);
                expect(this.b.get(1).getBankIndex()).toBe(1);
                expect(this.b.get(2).getBankIndex()).toBe(2);
            });
            
            it("generic bank", () => {
                this.c.all().forEach(r => expect(typeof r.input == "number"))
            });
            var foo = this.b.port((member) => member.o)
            var bar = [this.b.get(0).o, this.b.get(1).o, this.b.get(2).o]
            it("select port", () => {
                for (let i=0; i < foo.length; i++) {
                    expect(foo[i]).toBe(bar[i]);
                }
            });
            it("to string", () => {
                expect(this.b.toString()).toBe("bank(3)")
            })
        }
    }

    new myApp();

});
