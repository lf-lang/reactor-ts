import { Args, Triggers, Reactor, App, InMultiPort, OutMultiPort } from "../src/core/internal";
class TwoInTwoOut extends Reactor {
    inp = new InMultiPort<number>(this, 2);
    out = new OutMultiPort<number>(this, 2);

    foo = new class extends InMultiPort<number> {
        constructor(container: Reactor) {

            test('create multiport with no container', () => {
                expect(
                    () => {
                        // @ts-ignore
                        super(null, 4)
                    }
                ).toThrowError("Cannot instantiate component without a parent.")
            })
            super(container, 4)
            test('make port writable with invalid key', () => {
                expect(
                    () => {
                        this.asWritable(Symbol())
                    }
                ).toThrowError(`Referenced port is out of scope: myApp.${container._getName()}.foo`)
            })
        }
    }(this)
    constructor(parent: Reactor) {
        super(parent)
        this.addReaction(
            new Triggers(this.inp),
            new Args(this.inp),
            function (this, inp) {
                test('check read values', () => {
                    expect(inp.channel(0).get()).toBe(42);
                    expect(inp.get(0)).toBe(42);
                    expect(inp.channel(1).get()).toBe(69);
                    expect(inp.get(1)).toBe(69);
                    expect(inp.values()).toEqual([42, 69])
                });
                test('print input port names', () => {
                    expect(inp._getName()).toBe("inp");
                    expect(inp.channel(0)._getName()).toBe("inp[0]");
                    expect(inp.channel(1)._getName()).toBe("inp[1]");
                    expect(inp.channel(0)._getFullyQualifiedName()).toBe("myApp.y.inp[0]");
                    expect(inp.channel(1)._getFullyQualifiedName()).toBe("myApp.y.inp[1]");
                });
            }
        );
        this.addReaction(
            new Triggers(this.startup),
            new Args(this.allWritable(this.out)),
            function (out) {
                test('start up reaction triggered', () => {
                    expect(true).toBe(true);
                });
                out.set(0, 42)
                out.set(1, 69)
                test('check written values', () => {
                    expect(out.get(0)).toBe(42);
                    expect(out.get(1)).toBe(69);
                });
            }
        );
    }
}


class myApp extends App {

    x = new TwoInTwoOut(this);
    y = new TwoInTwoOut(this);

    constructor() {
        super();
        this._connectMulti([this.x.out], [this.y.inp], false)
    }

}

var app = new myApp();
app._start()
