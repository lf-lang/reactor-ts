import {Reactor, Reaction, Priority, App, Triggers, InPort, Args, ArgList, Startup, Shutdown, CalleePort, CallerPort} from '../src/core/reactor';
import { UnitBasedTimeValue, TimeUnit } from '../src/core/time';
import { Log } from '../src/core/util';
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

    var parent = new App();
    var reactor1 = new R(parent);

    it("Deadline miss", function(){
        
        var trigger = new Triggers(reactor1.calleep);
        

        reactor1.addReaction(
            trigger,
            new Args(),
            function(this) {
                throw new Error("Method not implemented.");
            },
            new UnitBasedTimeValue(1,TimeUnit.usec) // Deliberately small deadline
        );

        reactor1.start()

        

    });

});