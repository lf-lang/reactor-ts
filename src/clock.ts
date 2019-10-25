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

    constructor() {
        super(null, "Clock");

        const t1 = new Timer( [1, TimeUnit.sec], [3, TimeUnit.sec]);
        const t2 = new Timer( [1.5, TimeUnit.sec] , [3.5, TimeUnit.sec] );
        this.addTimer(t1);
        this.addTimer(t2);
        
        const tickTriggers = new Array();
        tickTriggers.push(t1);
        const r1 = new Tick(this, tickTriggers, 0);

        const tockTriggers = new Array();
        tockTriggers.push(t2);
        const r2 = new Tock(this, tockTriggers, 0);

        //At time 5 seconds, this reaction should be triggered
        //simultaneosly by both timers, "Cuckoo" should only
        //print once.
        const cuckooTriggers = new Array();
        cuckooTriggers.push(t1);
        cuckooTriggers.push(t2);
        const r3 = new Cuckoo(this, cuckooTriggers, 0);

        this._reactions.push(r1);
        this._reactions.push(r2);
        this._reactions.push(r3);
    }
}
