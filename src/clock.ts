'use strict';

import {Reactor, InPort, OutPort, Trigger, Reaction, Timer, TimeInterval, TimeUnit} from './reactor';

export class Tick extends Reaction{

    /**
     * Print tick.
     * @override
     */
    react(){
        console.log("Tick");
    }
}

export class Tock extends Reaction{

    /**
     * Print tock.
     * @override
     */
    react(){
        console.log("Tock");
    }
}

export class Cuckoo extends Reaction{

    /**
     * Print cuckoo.
     * @override
     */
    react(){
        console.log("Cuckoo");
    }
}


export class Clock extends Reactor {

    t1: Timer = new Timer( [1, TimeUnit.sec], [3, TimeUnit.sec]);
    t2: Timer = new Timer( [1500, TimeUnit.msec] , [3500, TimeUnit.msec] );

    constructor() {
        super(null, "Clock");

        const tickTriggers = new Array();
        tickTriggers.push(this.t1);
        const r1 = new Tick(this, tickTriggers, 0);

        const tockTriggers = new Array();
        tockTriggers.push(this.t2);
        const r2 = new Tock(this, tockTriggers, 1);

        //At time 5 seconds, this reaction should be triggered
        //simultaneosly by both timers, "Cuckoo" should only
        //print once.
        const cuckooTriggers = new Array();
        cuckooTriggers.push(this.t1);
        cuckooTriggers.push(this.t2);
        const r3 = new Cuckoo(this, cuckooTriggers, 2);

        this._reactions.push(r1);
        this._reactions.push(r2);
        this._reactions.push(r3);
    }
}
