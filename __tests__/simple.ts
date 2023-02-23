import {Reactor, App, InPort, OutPort, StringUtil} from "../src/core/internal";

    class MyActor extends Reactor {
     
        a: InPort<{t: number}> = new InPort(this);
        out: OutPort<any> = new OutPort(this);

    }
 

    class MyActor2 extends Reactor {
 
        a: InPort<{t: number}> = new InPort(this);
        b: OutPort<{t: number, y: string}> = new OutPort(this);
        
        constructor(parent:Reactor) {
            super(parent)
        }
    }


describe('Test names for contained reactors', () => {
    
    class myApp extends App {
        port: InPort<any> = new InPort<any>(this);

        x = new MyActor(this);
        y = new MyActor2(this);

        constructor() {
            super(undefined);

            it('contained actor name', () => {
                expect(this.x._getName()).toBe("x");
            });

            it('contained actor FQN', () => {
                expect(this.x._getFullyQualifiedName()).toBe("myApp.x");
            });

            it('contained actor toString', () => {
                expect(this.x.toString()).toBe("myApp.x");
            });

            it('contained actor FQN', () => {
                expect(this.x.toString()).toBe("myApp.x");
            });

            it('contained actor with alias FQN', () => {
                expect(this.y.toString()).toBe("myApp.y");
            });

            it('uncontained actor name', () => {
                expect(this.toString()).toBe("myApp");
            });

            it('check whether App is not contained by itself', () => {
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
                    "\"myApp.x[M0]\"->\"myApp[M0]\";" + "\n" +
                    "\"myApp.y[M0]\"->\"myApp[M0]\";" + "\n" +
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
                StringUtil.dontIndent
                `digraph G {
                "myApp.x.a"->"myApp.y.b";
                "myApp.x[M0]"->"myApp[M0]";
                "myApp.y[M0]"->"myApp[M0]";
                }`);
             });
             
            it('graph after disconnect', () => {
                this._disconnect(this.y.b, this.x.a)
                expect(this._getPrecedenceGraph().toString()).toBe(
                StringUtil.dontIndent
                `digraph G {
                "myApp.x[M0]"->"myApp[M0]";
                "myApp.y[M0]"->"myApp[M0]";
                }`);
             });
 

            // it('graph after disconnect', () => {
            //    expect(this._getGraph()).toBe("");
            // });
        }
    }

    var app = new myApp();

});
