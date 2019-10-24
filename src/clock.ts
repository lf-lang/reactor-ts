'use strict';

import {Reactor, InPort, OutPort, Trigger, Reaction, Timer, TimeInterval} from './reactor';

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


export class Clock extends Reactor {

    constructor() {
        super(null, "Clock");

        const t1 = new Timer( [1, "sec"], [3, "sec"]);
        const t2 = new Timer( [1.5, "sec"] , [3.5, "sec"] );
        this.addTimer(t1);
        this.addTimer(t2);
        
        const tickTriggers = new Array();
        tickTriggers.push(t1);
        const r1 = new Tick(this, tickTriggers, 0);

        const tockTriggers = new Array();
        tockTriggers.push(t2);
        const r2 = new Tock(this, tockTriggers, 0);

        this._reactions.push(r1);
        this._reactions.push(r2);
    }
}
