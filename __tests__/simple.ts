import {Reactor, App, InPort, OutPort, dontIndent} from "../src/core/internal";

class MyActor extends Reactor {
  a = new InPort<{t: number}>(this);

  out = new OutPort<any>(this);
}

class MyActor2 extends Reactor {
  a = new InPort<{t: number}>(this);

  b = new OutPort<{t: number; y: string}>(this);

  constructor(parent: Reactor) {
    super(parent);
  }
}

describe("Test names for contained reactors", () => {
  class myApp extends App {
    port: InPort<unknown> = new InPort(this);

    x = new MyActor(this);

    y = new MyActor2(this);

    constructor() {
      super(undefined);

      it("contained actor name", () => {
        expect(this.x._getName()).toBe("x");
      });

      it("contained actor FQN", () => {
        expect(this.x._getFullyQualifiedName()).toBe("myApp.x");
      });

      it("contained actor toString", () => {
        expect(this.x.toString()).toBe("myApp.x");
      });

      it("contained actor FQN", () => {
        expect(this.x.toString()).toBe("myApp.x");
      });

      it("contained actor with alias FQN", () => {
        expect(this.y.toString()).toBe("myApp.y");
      });

      it("uncontained actor name", () => {
        expect(this.toString()).toBe("myApp");
      });

      it("check whether App is not contained by itself", () => {
        expect(this._isContainedBy(this)).toBeFalsy();
      });

      it("check whether App is not contained by container of itself", () => {
        expect(this._isContainedByContainerOf(this)).toBeFalsy();
      });

      // it('connect two actors, one of which uncontained', () => {
      //     function connectDisjoint() {
      //         y.b.connect(xx.a);
      //     }
      //     expect(connectDisjoint).toThrowError(new Error("Unable to connect."));
      // });

      it("graph before connect", () => {
        expect(this._getPrecedenceGraph().toString()).toBe(
          dontIndent`graph
          0["myApp.x[M0]"]
          1["myApp[M0]"]
          2["myApp.y[M0]"]
          1 --> 0
          1 --> 2`
        );
      });

      it("connect two actors", () => {
        this._connect(this.y.b, this.x.a); // should not throw an error at this point
      });

      // it('auto-indexing of actor names', () => {
      //    expect(xx._getFullyQualifiedName()).toBe("Hello World/MyActor(1)");
      // });

      // it('graph before disconnect', () => {
      //    expect(this._getGraph()).toBe("Hello World/MyActor2/b => [Hello World/MyActor/a, Hello World/MyActor(1)/a]");
      // });

      it("graph after connect and before disconnect", () => {
        expect(this._getPrecedenceGraph().toString()).toBe(
          dontIndent`graph
            0["myApp.x.a"]
            1["myApp.y.b"]
            2["myApp.x[M0]"]
            3["myApp[M0]"]
            4["myApp.y[M0]"]
            1 --> 0
            3 --> 2
            3 --> 4`
        );
      });

      it("graph after disconnect", () => {
        this._disconnect(this.y.b, this.x.a);
        expect(this._getPrecedenceGraph().toString()).toBe(
          dontIndent`graph
            0["myApp.x.a"]
            1["myApp.y.b"]
            2["myApp.x[M0]"]
            3["myApp[M0]"]
            4["myApp.y[M0]"]
            3 --> 2
            3 --> 4`
        );
      });

      // it('graph after disconnect', () => {
      //    expect(this._getGraph()).toBe("");
      // });
    }
  }

  var app = new myApp();
});
