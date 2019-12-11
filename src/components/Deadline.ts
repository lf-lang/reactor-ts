'use strict';

import {Reactor, Trigger, Reaction, Timer, Deadline, InPort, OutPort, Action} from '../reactor';
import {TimeInterval, TimeUnit} from "../time"

// This test is supposed to violate this deadline.
export class Dead extends Deadline{
    
    // In this test the deadline is gauranteed to be violated so this handler should be
    // invoked. 
    handler(){
        (this.state as any).success();
    }
}

// This test is supposed to not violate this deadline.
export class Alive extends Deadline{

    //  In this test the deadline is gauranteed to be violated so this handler should be
    //  invoked. 
    handler(){
        console.log("failing alive");
        (this.state as any).fail();
    }
}

export class SoonDead extends Reaction{

    /**
     * This reaction should never be invoked because the deadline is gauranteed
     * too be broken.
     * @override
     */
    react(){
        console.log("failing soondead");
        (this.state as any).fail();
    }
}

export class WasteTime extends Reaction{

    /**
     * This reaction has higher priority than SoonDead and wastes time,
     * guaranteeing the deadline will be violated.
     * @override
     */
    react(){
        for(let i = 0; i < 1000000000; i++ );
    }
}

/**
 * This reactor demonstrates the deadline component.
 * The soonDead reaction has a deadline that should be missed.
 */
export class ShowDeadline extends Reactor {

    //Triggers immediatedly
    t: Timer = new Timer(this, 0,0);

    waste: Reaction;
    soonDead: Reaction;

    success: () => void
    fail: () => void

    constructor(success: () => void, fail: () => void, parent:Reactor | null, name?: string) {
        super(parent, name);
        this.success = success;
        this.fail = fail;
        
        
        this.waste = new WasteTime(this, [this.t], [], []);
        this.waste.setDeadline(new Alive(this,[10, TimeUnit.sec]));
        this.soonDead = new SoonDead(this, [this.t], [], []);
        this.soonDead.setDeadline(new Dead(this, 0));
 
        // Priorities are very important here
        this._reactions = [this.waste, this.soonDead];
    }

}
