import {Reactor, App, InPort, OutPort, Triggers, Args} from "../src/core/internal";

class R1 extends Reactor {
    inp = new InPort<number>(this);

    out = new OutPort<number>(this);

    foo = new class extends InPort<number> {
        constructor (container: Reactor) {
            super(container)
            test("receive runtime object twice", () => {
                expect(() => {
                    this._receiveRuntimeObject(this.runtime)
                }).toThrowError("Can only establish link to runtime once. Name: " + this._getFullyQualifiedName())
            })
            test("make port writable with invalid key", () => {
                expect(() => {
                    this.asWritable(Symbol())
                }).toThrowError("Referenced port is out of scope: " + this._getFullyQualifiedName())
            })
            test("error on getting manager without valid key", () => {
                expect(() => {
                    this.getManager(Symbol())
                }).toThrowError("Unable to grant access to manager")
            })

        }
    } (this)

    constructor (parent: Reactor) {
        super(parent)
        let writer = this.writable(this.inp)
        test("check inactive during construction", () => {
            expect(this._active).toBe(false)
        })
        test ("to string", () => {
            expect(writer.toString()).toBe("myApp.x.inp")
        })
    }
}

class myApp extends App {
    x = new R1(this);

    constructor () {
        super();
    }
}

var app = new myApp();
app._start()