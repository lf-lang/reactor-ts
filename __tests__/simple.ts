import {Reactor, OutPort, InPort, App} from "../src/reactor";

    class MyActor extends Reactor {
     
        a: InPort<{t: number}> = new InPort(this);
        out: OutPort<any> = new OutPort(this);

    }
 

    class MyActor2 extends Reactor {
 
        a: InPort<{t: number}> = new InPort(this);
        b: OutPort<{t: number, y: string}> = new OutPort(this);

    }


describe('Test names for contained reactors', () => {
    
    
    class myApp extends App {
        port: InPort<any> = new InPort<any>(this);

        x = new MyActor();
        y = new MyActor2();


        constructor(name: string, someParam: string) {
            super(null, name);

            // Normally _setAllParents would be called as part of the initialization
            // process for starting an app, but we call it directly here to set
            // parent attributes needed for this test.
            this._setAllParents(null);

            // it('contained actor name', () => {
            //     expect(this.x._getName()).toBe("MyActor");
            // });
            it('contained actor FQN', () => {
                expect(this.x.toString()).toBe("Hello World/MyActor");
            });

            it('uncontained actor name', () => {
                expect(this.toString()).toBe("Hello World");
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

    var app = new myApp("Hello World", "!");


});
