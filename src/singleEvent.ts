'use strict';

import {Reactor, InPort, OutPort, Trigger, Reaction, Timer, TimeInterval} from './reactor';

export class ProduceOutput extends Reaction{

    /**
     * Produce an output event
     * @override
     */
    react(){
        console.log("FIXME: SingleEvent does not yet produce an output");
    }
}

//Upon initialization, this reactor should produce an
//output event
export class SingleEvent extends Reactor {

    constructor() {
        super(null, "SingleEvent");

        //FIXME: create and add an outPort, so the reaction
        //can write to it.

        const t1 = new Timer(0, 0);
        this.addTimer(t1);
        
        const produceOutputTriggers = new Array();
        produceOutputTriggers.push(t1);
        const r = new ProduceOutput(this, produceOutputTriggers, 0);
        this._reactions.push(r);
    }
}
