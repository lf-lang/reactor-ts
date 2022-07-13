'use strict';

import { Action,Timer, App, Sched, Triggers, Args,TimeValue, TimeUnit, Origin } from '../src/core/internal';

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

    t1: Timer = new Timer(this, TimeValue.secs(3), TimeValue.secs(1));
    t2: Timer = new Timer(this, TimeValue.withUnits(3500, TimeUnit.msec), 
                                TimeValue.withUnits(1500, TimeUnit.msec));

    a1 = new Action<number>(this, Origin.logical);
    a2 = new Action<number>(this, Origin.logical);
    a3 = new Action<number>(this, Origin.logical);

    constructor(timeout: TimeValue,  success: () => void, fail: () => void) {
        super(timeout, false, false, undefined, success, fail);
        this.addReaction(
            new Triggers(this.t1),
            new Args(this.schedulable(this.a1)),
            /**
             * Print tick and schedule a1
             */
            function(this, a1){
                a1.schedule(0, 1);
                console.log("Tick");
            }
        );
        this.addReaction(
            new Triggers(this.t2), 
            new Args(this.schedulable(this.a2)),
            /**
             * Print tock and schedule a2.
             */
            function(this, a2){
                a2.schedule(0, 2);
                console.log("Tock");
            }
        );
        //At time 5 seconds, this reaction should be triggered
        //simultaneosly by both timers, "Cuckoo" should only
        //print once.
        this.addReaction(
            new Triggers(this.t1, this.t2), 
            new Args(this.schedulable(this.a3)),
            /**
             * Print cuckoo and schedule a3.
             */
            function(this, a3: Sched<number>) {
                a3.schedule(0, 3);
                console.log("Cuckoo");
            }
        );
        this.addReaction(
            new Triggers(this.a1, this.a2, this.a3),
            new Args(this.a1, this.a2, this.a3),
            /**
             * If all the actions are available at logical time 5 seconds from start, the test is successful.
             */
            function(this, a1: Action<number>, a2: Action<number>, a3: Action<number>) {
                console.log("Before check in test");
                // console.log("does current logical time: " + globals.currentLogicalTime[0] + " equal " + numericTimeSum( globals.startingWallTime , [5, 0]));
                        
                // All timers should fire simultaneously at logical time 5 seconds from the start of execution.
                // This should tricker tick, tock, and, cuckoo to simultanously schedule actions
                // 1,2, and 3. 
                if (this.util.getElapsedLogicalTime().isEqualTo(TimeValue.secs(5))) {
                    console.log("reacting in Test");
                    if(a1.get() == 1 && a2.get() == 2 && a3.get() == 3) {
                        this.util.requestStop();
                    } else {
                        console.log("a1: " + a1.get());
                        console.log("a2: " + a2.get());
                        console.log("a3: " + a3.get());
                        this.util.requestErrorStop();
                    }
                }
            }
        );
    }
}

describe('clock', function () {
     //Ensure the test will run for no more than 7 seconds.
    jest.setTimeout(7000);

    it('start runtime', done => {

        function fail() {
            throw new Error("Test has failed.");
        };

        //Tell the reactor runtime to successfully terminate after 6 seconds.
        var clock = new Clock(TimeValue.secs(6), done, fail);

        //Don't give the runtime the done callback because we don't care if it terminates
        clock._start();
    })
});

