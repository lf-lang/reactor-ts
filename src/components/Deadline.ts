'use strict';

import {Reactor, Trigger, Reaction, Timer, Deadline} from '../reactor';
import {TimeInterval, TimeUnit} from "../time"

// This test is supposed to violate this deadline.
export class Dead extends Deadline{
    
    success: () => void;
    fail: () => void;

    constructor(timeout: TimeInterval, success: ()=>void , fail: ()=>void  ){
        super(timeout);
        this.success = success;
        this.fail = fail;
    }
    
    // In this test the deadline is gauranteed to be violated so this handler should be
    // invoked. 
    handler(){
        this.success();
    }
}

// This test is supposed to not violate this deadline.
export class Alive extends Deadline{
    
    success: () => void;
    fail: () => void;

    constructor(timeout: TimeInterval, success: ()=>void , fail: ()=>void  ){
        super(timeout);
        this.success = success;
        this.fail = fail;
    }
    
    //  In this test the deadline is gauranteed to be violated so this handler should be
    //  invoked. 
    handler(){
        console.log("failing alive")
        this.fail();
    }
}

export class SoonDead extends Reaction{

    success:() => void;
    fail:() => void;

    constructor(state: Reactor, triggers: Trigger[],
                priority: number, success: () => void, fail: ()=>void){
        super(state, triggers, priority);
        this.success = success;
        this.fail = fail;
        this.deadline = new Dead(0, this.success, this.fail);
    }

    /**
     * This reaction should never be invoked because the deadline is gauranteed
     * too be broken.
     * @override
     */
    react(){
        console.log("failing soondead")
        this.fail();
    }
}

export class WasteTime extends Reaction{

    success:() => void;
    fail:() => void;

    constructor(state: Reactor, triggers: Trigger[],
        priority: number, success: () => void, fail: ()=>void){
        super(state, triggers, priority);
        this.success = success;
        this.fail = fail;

        //Something has to have failed somewhere if it takes more than 10 seconds
        //for the first reaction scheduled at time 0 to execute.
        this.deadline = new Alive([10, TimeUnit.sec], this.success, this.fail);
    }

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
    t: Timer = new Timer(0,0);

    waste: Reaction;
    soonDead: Reaction;

    constructor(success: () => void, fail: () => void, parent:Reactor | null, name?: string) {
        super(name);
        
        //Priorities are very important here
        this.waste = new WasteTime(this, [this.t], 0, success, fail);
        this.soonDead = new SoonDead(this, [this.t], 1, success, fail);
 
        this._reactions = [this.waste, this.soonDead];
    }

}
