'use strict';

import {Reactor, Trigger, Reaction, Timer, Action,  App} from '../reactor';
import {TimeInterval, TimeUnit, numericTimeSum } from "../time"

class Tick extends Reaction{

    /**
     * Print tick and schedule a1
     * @override
     */
    react(){
        (this.state as Clock).a1.schedule(0, 1);
        console.log("Tick");
    }
}

class Tock extends Reaction{

    /**
     * Print tock and schedule a2.
     * @override
     */
    react(){
        (this.state as Clock).a2.schedule(0, 2);
        console.log("Tock");
    }
}

class Cuckoo extends Reaction{

    /**
     * Print cuckoo and schedule a3.
     * @override
     */
    react(){
        (this.state as Clock).a3.schedule(0, 3);
        console.log("Cuckoo");
    }
}

class Test extends Reaction{

    success: () => void;
    fail: () => void;

    /**
     * @override
     */
    constructor(state: Reactor, triggers: Trigger[], priority: number, success: () => void, fail: ()=>void ){
        super(state, triggers, priority);
        this.success = success;
        this.fail = fail;

    }

    /**
     * If all the actions are available at logical time 5 seconds from start, the test is successful.
     * @override
     */
    react(){
        console.log("Before check in test");
        // console.log("does current logical time: " + globals.currentLogicalTime[0] + " equal " + numericTimeSum( globals.startingWallTime , [5, 0]));
                
        // All timers should fire simultaneously at logical time 5 seconds from the start of execution.
        // This should tricker tick, tock, and, cuckoo to simultanously schedule actions
        // 1,2, and 3. 
        if(this._getcurrentlogicaltime()[0][0] ==  numericTimeSum( this.state._app._getStartingWallTime() , [5, 0])[0]
            && this._getcurrentlogicaltime()[0][1] ==  numericTimeSum( this.state._app._getStartingWallTime() , [5, 0])[1]){
            console.log("reacting in Test");
                if( (this.state as Clock).a1.get() == 1 
                            && (this.state as Clock).a2.get() == 2
                            && (this.state as Clock).a3.get() == 3){
                this.success();
            } else {
                this.fail();
            }
        }
    }
}

/**
 * This app tests simultaneous events.
 * It creates two timers: t1 and t2 which should simultaneously have events at time
 * 5 seconds from the start of execution.
 * The timers trigger reactions: r1, r2, and r3. r1 is triggered by t1, r2 is triggered
 * by t2, and r3 is triggered by both t1 and t2.
 * Each reaction immediately schedules an action with a corresponding name (r1 schedules t1, etc.).
 * At time 5 seconds, the Test reaction r4 will be triggered and it will check that a1
 * a2, and a3 are all simultaneously present.
 */
export class Clock extends App {

    t1: Timer = new Timer(this, [1, TimeUnit.sec], [3, TimeUnit.sec]);
    t2: Timer = new Timer(this, [1500, TimeUnit.msec] , [3500, TimeUnit.msec] );

    a1: Action<number> = new Action<number>(this);
    a2: Action<number> = new Action<number>(this);
    a3: Action<number> = new Action<number>(this);

    r1: Reaction = new Tick(this, [this.t1], 0);
    r2: Reaction = new Tock(this, [this.t2], 1);

    //At time 5 seconds, this reaction should be triggered
    //simultaneosly by both timers, "Cuckoo" should only
    //print once.
    r3: Reaction = new Cuckoo(this, [this.t1, this.t2], 2);
    r4: Reaction;

    constructor(timeout: TimeInterval,  success: () => void, fail: () => void, name?: string) {
        super(timeout, name);
        this.r4 = new Test(this, [this.a1, this.a2, this.a3], 4, success, fail);
        this._reactions = [this.r1, this.r2, this.r3, this.r4];
    }
}
