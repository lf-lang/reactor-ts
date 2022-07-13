import { Reactor, App, Triggers, Args, State, OutPort, InPort, TimeUnit, TimeValue } from '../src/core/internal';

describe('Check canConnect', () => {
    class Source extends Reactor {
        out: OutPort<number> = new OutPort(this)
    }
    class Destination extends Reactor {
        in: InPort<number> = new InPort(this)
        out: InPort<number> = new InPort(this)
    }

    class TestApp extends App {
        source: Source
        destination: Destination
    
        constructor() {
            super()
            this.source = new Source(this)
            this.destination = new Destination(this)
            
            it('canConnect success out->in', () => {
                expect(this.canConnect(this.source.out, this.destination.in)).toBe(true)
            })
            
            it('canConnect success out->out', () => {
                expect(this.canConnect(this.source.out, this.destination.out)).toBe(true)
            })
            
            it('canConnect failure', () => {
                expect(this.canConnect(this.destination.in, this.source.out)).toBe(false)
            })
        }
    }
    var testApp = new TestApp()
})

describe('Check _connect', () => {
    jest.setTimeout(5000);

    class Source extends Reactor {
        out: OutPort<number> = new OutPort(this)
        constructor(container: Reactor) {
            super(container);
            this.addReaction(
                new Triggers(this.startup),
                new Args(this.writable(this.out)),
                function(this, __out) {
                    __out.set(100);
    
                }
            );
        }
    }
    class Destination extends Reactor {
        in: InPort<number> = new InPort(this)
        received: State<number> = new State(0)
        constructor(container: Reactor) {
            super(container)
            this.addReaction(
                new Triggers(this.in),
                new Args(this.in, this.received),
                function(this, __in, __received) {
                    let tmp = __in.get();
                    try
                    {            
                        if(tmp)
                        {
                            __received.set(tmp)
                        }
                    } finally {
    
                    }
                }
            )
        }
    }
    
    class TestApp extends App {
        source: Source
        destination: Destination
    
        constructor(timeout: TimeValue, success?: () => void, fail?: () => void) {
            super(timeout, false, false, TimeValue.secs(1), success, fail)
            this.source = new Source(this)
            this.destination = new Destination(this)
            this._connect(this.source.out, this.destination.in)
        }
    }

    it("_connect success", done => {
        function fail() {
            throw new Error("Test has failed.");
        };
        
        let testApp = new TestApp(TimeValue.withUnits(1,TimeUnit.nsec), done, fail)
        testApp._start()
        expect(testApp.destination.received.get()).toBe(100)
    })
})
