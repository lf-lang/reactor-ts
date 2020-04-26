import {Reactor, Reaction, Priority, App, Triggers, InPort, Args, ArgList, Startup, Shutdown, CalleePort, CallerPort} from '../src/core/reactor';
import { UnitBasedTimeValue, TimeUnit } from '../src/core/time';
import { Log, LogLevel, PrecedenceGraph, PrecedenceGraphNode } from '../src/core/util';
import { writer } from 'repl';


class R extends Reactor {

    public calleep = new CalleePort(this)
    public callerp = new CallerPort(this);

    constructor(parent: Reactor|null) {
        super(parent);
        this.callerp.remotePort = this.calleep;
        this.addReaction(
            new Triggers(this.calleep),
            new Args(), 
            function(this) {
                throw new Error("Method not implemented.");
            },
            new UnitBasedTimeValue(10,TimeUnit.msec),
        )

        this.addReaction(
            new Triggers(this.callerp),
            new Args(), 
            function(this) {
                throw new Error("Method not implemented.");
            },
            new UnitBasedTimeValue(10,TimeUnit.msec),
        )

        
    }

    start() {
        this.callerp.set(4)
    }

    getNodes() {
        return this._getReactions();
    }
}


describe("Testing Reactor Cases", function () {

    Log.global.level = LogLevel.DEBUG

    it("Deadline miss", function(){
        var parent = new App();       
        var reactor1 = new R(parent);
        var trigger = new Triggers(reactor1.calleep);
        

        reactor1.addReaction(
            trigger,
            new Args(),
            function(this) {
                throw new Error("Method not implemented.");
            },
            new UnitBasedTimeValue(1,TimeUnit.usec) // Deliberately small deadline
        );

        reactor1.start();

        
    });


    
    it("Multiple triggers", function(){

        var parent = new App();
        var reactor1 = new R(parent);
        var trigger = new Triggers(reactor1.calleep, new CalleePort(reactor1));

        expect( () => { reactor1.addReaction(
            trigger,
            new Args(),
            function(this) {
                throw new Error("Method not implemented.");
            },
            new UnitBasedTimeValue(1,TimeUnit.usec) // Deliberately small deadline
        );} ).toThrowError("Procedure has multiple triggers.")

        
    });


    it("Bad Parents", function(){

        var parent = new App();
        var reactor1 = new R(parent);
        var cport = new CalleePort(new R(new App()));
        var trigger = new Triggers(cport);
        reactor1.callerp.remotePort = cport;

        reactor1.addReaction(
            trigger,
            new Args(),
            function(this) {
                throw new Error("Method not implemented.");
            },
            new UnitBasedTimeValue(1,TimeUnit.usec) // Deliberately small deadline
        );
        
        console.log(reactor1.getPrecedenceGraph().toString());
        
        reactor1.start();
    });


});