// @flow
import {Reactor, OutPort, InPort, PureEvent, App, Executable} from "../src/reactor.js";

   /**
     * An actor implementation is a reactive component with ports as properties.
     */
    class MyActor extends Reactor {
     
        a: InPort<{t: number}> = new InPort(this);
        out: OutPort<*> = new OutPort(this);

    }
 

    class MyActor2 extends Reactor {
 
        a: InPort<{t: number}> = new InPort(this);
        b: OutPort<{t: number, y: string}> = new OutPort(this);

    }

describe('connecting/disconnecting actors', () => {
    
    class MyApp extends App {
        port = new InPort(this);
        constructor(name: string, someParam: string) {
            super(name);
            let x = new MyActor(this);
            let xx = new MyActor(); // Uncontained actor
            let y = new MyActor2(this);
            
            // NOTE: the following line demonstrates type checking ability:
            // this.connect(x.a, y.b);
            //y.b.connect(x.a);

           // x.a.connect(y.b);
            //this.connect(y.b, x.a);
            // this.connect(y.a, y.b);
            it('contained actor name', () => {
                expect(x._getName()).toBe("MyActor");
            });
            it('contained actor FQN', () => {
                expect(x._getFullyQualifiedName()).toBe("Hello World/MyActor");
            });

            it('uncontained actor name', () => {
                expect(xx._getFullyQualifiedName()).toBe("MyActor");
            });
            it('uncontained actor FQN', () => {
                expect(xx._getFullyQualifiedName()).toBe("MyActor");
            });

            // it('connect two actors, one of which uncontained', () => {
            //     function connectDisjoint() {
            //         y.b.connect(xx.a);
            //     }
            //     expect(connectDisjoint).toThrowError(new Error("Unable to connect."));
            // });
            // it('connect two actors', () => {
            //     this._add(xx);
            //     y.b.connect(xx.a) // should not throw an error at this point
            // });
            
            // it('auto-indexing of actor names', () => {
            //    expect(xx._getFullyQualifiedName()).toBe("Hello World/MyActor(1)");
            // });
            
            // it('graph before disconnect', () => {
            //    expect(this._getGraph()).toBe("Hello World/MyActor2/b => [Hello World/MyActor/a, Hello World/MyActor(1)/a]");
            // });

            // it('disconnect downstream', () => {
            //    y.b.disconnect();
            // });

            // it('graph after disconnect', () => {
            //    expect(this._getGraph()).toBe("");
            // });

        }
    }

    var app = new MyApp("Hello World", "!");

});
