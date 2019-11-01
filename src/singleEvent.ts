'use strict';

import {Reactor, InPort, OutPort, Trigger, Reaction, Timer, TimeInterval} from './reactor';

export class ProduceOutput extends Reaction{

    outputPayload:any;

    constructor(a, b, c, outputPayload:any ){
        super(a,b,c);
        this.outputPayload = outputPayload
    }

    /**
     * Produce an output event
     * @override
     */
    react(){
        (this.state as any).o.set(this.outputPayload);
        console.log("Writing null to SingleEvent's output.");

        // var output = this.state.getOutputs().get("out");
        // if(output){
        //     console.log("Writing null to SingleEvent's output.");
            
        // } else {
        //     throw new Error("OutPort 'out' has not been declared for this reactor");
        // }

        // console.log("FIXME: SingleEvent does not yet produce an output");
    }
}

//Upon initialization, this reactor should produce an
//output event
export class SingleEvent extends Reactor {

    o: OutPort<any> = new OutPort<any>(this);
    t1: Timer = new Timer(0, 0);

    constructor( outputPayload) {
        super(null, "SingleEvent");
        
        const produceOutputTriggers = new Array();
        produceOutputTriggers.push(this.t1);
        const r = new ProduceOutput(this, produceOutputTriggers, 0, outputPayload);
        this._reactions.push(r);
    }
}



