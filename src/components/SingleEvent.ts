'use strict';

import {Reactor, OutPort, Trigger, Reaction, Timer} from '../reactor';

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

        // FIXME: create a test that actually tests double sets.
        // It's confusing to have SingleEvent be a DoubleEvent.
        
        // Duplicate sets for the same port like this is bad form,
        // but its worth checking that the correct value (from the last set)
        // is delivered.
        
        (this.state as any).o.set(this.outputPayload);
        console.log("Writing payload to SingleEvent's output.");
    }
}

//Upon initialization, this reactor produces the outputPayload given in its constructor
//on its output port.
export class SingleEvent extends Reactor {

    o: OutPort<string> = new OutPort<string>(this);
    t1: Timer = new Timer(this, 0, 0);
    r: Reaction;

    constructor(outputPayload:any, parent: Reactor | null, name?:string ) {
        super(parent, name);
        
        this.r = new ProduceOutput(this, [this.t1], 0, outputPayload);
        this._reactions.push(this.r);
    }
}



