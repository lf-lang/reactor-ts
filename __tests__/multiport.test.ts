import { Args, Triggers, Reactor, App, InMultiPort, InPort, OutMultiPort } from "../src/core/internal";

//describe('Connect two multiports and check values', () => {

    class TwoInTwoOut extends Reactor {
        inp = new InMultiPort<number>(this, 2);
        out = new OutMultiPort<number>(this, 2);

        constructor(parent: Reactor) {
            super(parent)
            this.addReaction(
                new Triggers(this.inp), 
                new Args(this.inp),
                function (this, inp) {
                    console.log("Getting triggered")
                    test('check read values', () => {
                        expect(inp.channel(0).get()).toBe(42);
                        expect(inp.channel(1).get()).toBe(69);
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
            //this._connect(this.x.out.channel(0), this.y.inp.channel(0))
            //this._connect(this.x.out.channel(1), this.y.inp.channel(1))
        }

    }

    var app = new myApp();
    app._start()

//});
