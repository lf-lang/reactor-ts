'use strict';

import {Reactor, InPort, OutPort, Trigger, Reaction, Timer, TimeInterval, TimeUnit, Action, numericTimeSum, timeInstantsAreEqual} from './reactor';
import * as globals from './globals'

class Tick extends Reaction{

    /**
     * Print tick and schedule a1
     * @override
     */
    react(){
        (this.state as any).a1.schedule(0, 1);
        console.log("Tick");
    }
}

class Tock extends Reaction{

    /**
     * Print tock and schedule a2.
     * @override
     */
    react(){
        (this.state as any).a2.schedule(0, 2);
        console.log("Tock");
    }
}

class Cuckoo extends Reaction{

    /**
     * Print cuckoo and schedule a3.
     * @override
     */
    react(){
        (this.state as any).a3.schedule(0, 3);
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
        // console.log("does current logical time: " + globals.currentLogicalTime[0] + " equal " + numericTimeSum( globals.startingWallTime , [5, 0]));
                
        //All timers should fire simultaneously at logical time 5 seconds from the start of execution.
        //This should tricker tick, tock, and, cuckoo to simultanously schedule actions
        //1,2, and 3. 
        if(globals.currentLogicalTime[0][0] ==  numericTimeSum( globals.startingWallTime , [5, 0])[0]
            && globals.currentLogicalTime[0][1] ==  numericTimeSum( globals.startingWallTime , [5, 0])[1]){
            if( (this.state as any).a1.get() == 1 
                            && (this.state as any).a2.get() == 2
                            && (this.state as any).a3.get() == 3){
                this.success();
            } else {
                this.fail();
            }
        }
    }
}


export class Clock extends Reactor {

    t1: Timer = new Timer( [1, TimeUnit.sec], [3, TimeUnit.sec]);
    t2: Timer = new Timer( [1500, TimeUnit.msec] , [3500, TimeUnit.msec] );

    a1: Action<number> = new Action<number>();
    a2: Action<number> = new Action<number>();
    a3: Action<number> = new Action<number>();

    constructor(success: () => void, fail: () => void, parent:Reactor | null, name?: string) {
        super(parent, name);

        const r1 = new Tick(this, [this.t1], 0);
        const r2 = new Tock(this, [this.t2], 1);

        //At time 5 seconds, this reaction should be triggered
        //simultaneosly by both timers, "Cuckoo" should only
        //print once.
        const r3 = new Cuckoo(this, [this.t1, this.t2], 2);

        const r4 = new Test(this, [this.a1, this.a2, this.a3], 4, success, fail);

        this._reactions = [r1, r2, r3, r4];
    }
}
