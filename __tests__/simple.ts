import {Reactor, App, InPort, OutPort} from "../src/core/reactor";

    class MyActor extends Reactor {
     
        a: InPort<{t: number}> = new InPort(this);
        out: OutPort<any> = new OutPort(this);

    }
 

    class MyActor2 extends Reactor {
 
        a: InPort<{t: number}> = new InPort(this);
        b: OutPort<{t: number, y: string}> = new OutPort(this);
        
        constructor(parent:Reactor, alias: string) {
            super(parent, alias)
        }
    }


describe('Test names for contained reactors', () => {
    
    class myApp extends App {
        port: InPort<any> = new InPort<any>(this);

        x = new MyActor(this);
        y = new MyActor2(this, "Foo");

        constructor(name: string, someParam: string) {
            super(undefined);
            this._setAlias(name);

            it('contained actor name', () => {
                expect(this.x._getName()).toBe("x");
            });

            it('contained actor Alias', () => {
                expect(this.x._getAlias()).toBe("");
            });

            it('contained actor FQN', () => {
                expect(this.x._getFullyQualifiedName()).toBe("Hello World/x");
            });

            it('contained actor toString', () => {
                expect(this.x.toString()).toBe("Hello World/x");
            });

            it('contained actor FQN', () => {
                expect(this.x.toString()).toBe("Hello World/x");
            });

            it('contained actor with alias FQN', () => {
                expect(this.y.toString()).toBe("Hello World/y (Foo)");
            });

            it('uncontained actor name', () => {
                expect(this.toString()).toBe("Hello World");
            });

            it('uncontained actor Alias', () => {
                expect(this._getAlias()).toBe(name);
            });

            it('check whehter App is not contained by itself', () => {
                expect(this._isContainedBy(this)).toBeFalsy();
            });

            it('check whether App is not contained by container of itself', () => {
                expect(this._isContainedByContainerOf(this)).toBeFalsy();
            });

            // it('connect two actors, one of which uncontained', () => {
            //     function connectDisjoint() {
            //         y.b.connect(xx.a);
            //     }
            //     expect(connectDisjoint).toThrowError(new Error("Unable to connect."));
            // });
            
            it('graph before connect', () => {
                expect(this._getPrecedenceGraph().toString()).toBe(
                    "digraph G {" + "\n" +
                    "\"Hello World/x[M0]\"->\"Hello World[M0]\";" + "\n" +
                    "\"Hello World/y (Foo)[M0]\"->\"Hello World[M0]\";" + "\n" +
                    "}");
             });

            it('connect two actors', () => {
                this._connect(this.y.b, this.x.a);  // should not throw an error at this point
            });

            // it('auto-indexing of actor names', () => {
            //    expect(xx._getFullyQualifiedName()).toBe("Hello World/MyActor(1)");
            // });
            
            // it('graph before disconnect', () => {
            //    expect(this._getGraph()).toBe("Hello World/MyActor2/b => [Hello World/MyActor/a, Hello World/MyActor(1)/a]");
            // });

            it('graph after connect and before disconnect', () => {
                expect(this._getPrecedenceGraph().toString()).toBe(
                     "digraph G {" + "\n" +
                     "\"Hello World/x/a\"->\"Hello World/y (Foo)/b\";" + "\n" +
                     "\"Hello World/x[M0]\"->\"Hello World[M0]\";" + "\n" +
                     "\"Hello World/y (Foo)[M0]\"->\"Hello World[M0]\";" + "\n" +
                     "}");
             });
 
 

            // it('graph after disconnect', () => {
            //    expect(this._getGraph()).toBe("");
            // });
        }
    }

    var app = new myApp("Hello World", "!");


});
