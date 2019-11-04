'use strict';

import {Reactor, InPort, OutPort, Trigger, Reaction, Timer, TimeInterval} from './reactor';

export class ProduceOutput extends Reaction{

    outputPayload:any;

    constructor(state: Reactor, triggers: Trigger[], priority: number, outputPayload:any ){
        super(state,triggers,priority);
        this.outputPayload = outputPayload
    }

    /**
     * Produce an output event
     * @override
     */
    react(){
        (this.state as any).o.set(this.outputPayload);
        console.log("Writing payload to SingleEvent's output.");
    }
}

//Upon initialization, this reactor produces the outputPayload given in its constructor
//on its output port.
export class SingleEvent extends Reactor {

    o: OutPort<any> = new OutPort<any>(this);
    t1: Timer = new Timer(0, 0);

    constructor(outputPayload:any, parent: Reactor | null, name?:string ) {
        super(parent, name);
        
        const r = new ProduceOutput(this, [this.t1], 0, outputPayload);
        this._reactions.push(r);
    }
}



