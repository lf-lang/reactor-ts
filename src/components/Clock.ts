'use strict';

<<<<<<< HEAD
import {Reactor, Trigger, Reaction, Timer, Action,  App, InPort, OutPort, Trigs, Args, ArgType} from '../reactor';
import {TimeInterval, TimeUnit, numericTimeSum } from "../time"
=======
import {Reactor, Trigger, Reaction, Timer, Action,  App, InPort, OutPort} from '../reactor';
import {TimeInterval, TimeUnit, numericTimeSum, TimelineClass } from "../time"
>>>>>>> 2cc768aebd78ed51659f0caa298744ff36d1551f

class Tick<T> extends Reaction<T> {

    /**
     * Print tick and schedule a1
     * @override
     *
     */
    //@ts-ignore
    react(a1: Action<number>){
        a1.schedule(0, 1);
        console.log("Tick");
    }
}

class Tock<T> extends Reaction<T> {

    /**
     * Print tock and schedule a2.
     * @override
     */
    //@ts-ignore
    react(a2: Action<number>){
        a2.schedule(0, 2);
        console.log("Tock");
    }
}

class Cuckoo<T> extends Reaction<T> {

    /**
     * Print cuckoo and schedule a3.
     * @override
     */
    //@ts-ignore
    react(a3: Action<number>) {
        a3.schedule(0, 3);
        console.log("Cuckoo");
    }
}

class Test<T> extends Reaction<T> {

    success: () => void;
    fail: () => void;

    /**
     * @override
     */
    constructor(parent: Reactor, trigs, args: ArgType<T>, success: () => void, fail: () => void ) {
        super(parent, trigs, args);
        this.success = success;
        this.fail = fail;
    }

    /**
     * If all the actions are available at logical time 5 seconds from start, the test is successful.
     * @override
     */
    //@ts-ignore
    react(a1: Action<number>, a2: Action<number>, a3: Action<number>) {
        console.log("Before check in test");
        // console.log("does current logical time: " + globals.currentLogicalTime[0] + " equal " + numericTimeSum( globals.startingWallTime , [5, 0]));
                
        // All timers should fire simultaneously at logical time 5 seconds from the start of execution.
        // This should tricker tick, tock, and, cuckoo to simultanously schedule actions
        // 1,2, and 3. 
<<<<<<< HEAD
        if(this.parent._app._getcurrentlogicaltime()[0][0] ==  numericTimeSum( this.parent._app._getStartingWallTime() , [5, 0])[0]
            && this.parent._app._getcurrentlogicaltime()[0][1] ==  numericTimeSum( this.parent._app._getStartingWallTime() , [5, 0])[1]){
=======
        if(this._getCurrentLogicalTime()[0][0] ==  numericTimeSum( this.state._app._getStartingWallTime() , [5, 0])[0]
            && this._getCurrentLogicalTime()[0][1] ==  numericTimeSum( this.state._app._getStartingWallTime() , [5, 0])[1]){
>>>>>>> 2cc768aebd78ed51659f0caa298744ff36d1551f
            console.log("reacting in Test");
                if(a1.get() == 1 && a2.get() == 2 && a3.get() == 3){
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

    t1: Timer = new Timer(this, [3, TimeUnit.sec], [1, TimeUnit.sec]);
    t2: Timer = new Timer(this, [3500, TimeUnit.msec], [1500, TimeUnit.msec] );

<<<<<<< HEAD
    a1 = new Action<number>(this);
    a2 = new Action<number>(this);
    a3 = new Action<number>(this);
=======
    a1: Action<number> = new Action<number>(this, TimelineClass.logical);
    a2: Action<number> = new Action<number>(this, TimelineClass.logical);
    a3: Action<number> = new Action<number>(this, TimelineClass.logical);

    r1: Reaction = new Tick(this, [this.t1], [], [this.a1]);
    r2: Reaction = new Tock(this, [this.t2], [], [this.a2]);
>>>>>>> 2cc768aebd78ed51659f0caa298744ff36d1551f

    //At time 5 seconds, this reaction should be triggered
    //simultaneosly by both timers, "Cuckoo" should only
    //print once.

    constructor(timeout: TimeInterval,  success: () => void, fail: () => void, name?: string) {
        super(timeout, name);
        this.addReaction(new Tick(this, Trigs(this.t1), Args(this.a1)));
        this.addReaction(new Cuckoo(this, Trigs(this.t1, this.t2), Args(this.a3)));
        this.addReaction(new Test(this, Trigs(this.a1, this.a2, this.a3), Args(this.a1, this.a2, this.a3), success, fail));
        this.addReaction(new Tock(this, Trigs(this.t2), Args(this.a2)));
        this.addReaction(new Cuckoo(this, Trigs(this.t1, this.t2), Args(this.a3)));
    }
}
