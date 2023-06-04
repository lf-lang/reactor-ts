import {
  Args,
  Triggers,
  Reactor,
  App,
  InMultiPort,
  OutMultiPort,
  IOPort,
  OutPort,
  InPort
} from "../src/core/internal";
class TwoInTwoOut extends Reactor {
  inp = new InMultiPort<number>(this, 2);

  out = new OutMultiPort<number>(this, 2);

  foo = new (class extends InMultiPort<number> {
    constructor(container: Reactor) {
      test("create multiport with no container", () => {
        expect(() => {
          // @ts-ignore
          super(null, 4);
        }).toThrowError("Cannot instantiate component without a parent.");
      });
      super(container, 4);
      test("make port writable with invalid key", () => {
        expect(() => {
          this.asWritable(Symbol());
        }).toThrowError(
          `Referenced port is out of scope: myApp.${container._getName()}.foo`
        );
      });
      test("receive runtime object", () => {
        expect(this._receiveRuntimeObject).toThrowError(
          "Multiports do not request to be linked to the" +
            " runtime object, hence this method shall not be invoked."
        );
      });
    }
  })(this);

  constructor(parent: Reactor) {
    super(parent);
    const writer = this.allWritable(this.inp);
    test("check inactive during construction", () => {
      expect(this._active).toBe(false);
    });
    test("check multiport width", () => {
      expect(this.inp.width()).toBe(2);
      expect(writer.width()).toBe(2);
    });
    this.addReaction(
      new Triggers(this.inp),
      new Args(this.inp),
      function (this, inp) {
        test("check read values", () => {
          expect(inp.channel(0).get()).toBe(42);
          expect(inp.get(0)).toBe(42);
          expect(inp.channel(1).get()).toBe(69);
          expect(inp.get(1)).toBe(69);
          expect(inp.values()).toEqual([42, 69]);
        });
        test("print input port names", () => {
          expect(inp._getName()).toBe("inp");
          expect(inp.channel(0)._getName()).toBe("inp[0]");
          expect(inp.channel(1)._getName()).toBe("inp[1]");
          expect(inp.channel(0)._getFullyQualifiedName()).toBe(
            "myApp.y.inp[0]"
          );
          expect(inp.channel(1)._getFullyQualifiedName()).toBe(
            "myApp.y.inp[1]"
          );
        });
      }
    );
    this.addReaction(
      new Triggers(this.startup),
      new Args(this.allWritable(this.out)),
      function (out) {
        test("start up reaction triggered", () => {
          expect(true).toBe(true);
        });
        test("check multiport values before and after writing", () => {
          expect(out.values()).toEqual([undefined, undefined]);
          out.set(0, 42);
          out.set(1, 69);
          expect(out.get(0)).toBe(42);
          expect(out.get(1)).toBe(69);
          expect(out.values()).toEqual([42, 69]);
        });
      }
    );
    test("throw error on invalid access to manager", () => {
      expect(() => {
        this.inp.getManager(Symbol());
      }).toThrowError("Unable to grant access to manager.");
    });
    test("test for present channels prior to running", () => {
      expect(this.inp.isPresent()).toBe(false);
    });
    test("to string", () => {
      expect(this.inp.toString()).toMatch(new RegExp("myApp.*inp"));
    });
    test("get", () => {
      expect(this.inp.get(0)).toBeUndefined();
    });
    test("values", () => {
      expect(this.inp.values()).toEqual([undefined, undefined]);
    });
  }
}

class myApp extends App {
  x = new TwoInTwoOut(this);

  y = new TwoInTwoOut(this);

  constructor() {
    super();
    this._connectMulti([this.x.out], [this.y.inp], false);
  }
}

var app = new myApp();
app._start();
test("test for present port after startup", () => {
  expect(app.x.out.isPresent()).toBe(true);
});
test("get channel on multiport", () => {
  expect(app.x.out.channel(0) instanceof OutPort);
  expect(app.x.out.channel(1) instanceof OutPort);
  expect(app.x.out.channel(0).isPresent()).toBe(true);
  expect(app.x.out.channel(0).isPresent()).toBe(true);
  expect(app.y.inp.channel(0) instanceof InPort);
});
