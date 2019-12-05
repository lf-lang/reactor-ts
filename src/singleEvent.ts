'use strict';

import {Reactor, InPort, OutPort, Trigger, Reaction, Timer, TimeInterval} from './reactor';
export class ProduceOutput<T> extends Reaction {

    payload:T;
    constructor (parent:Reactor, payload:T) {
        super(parent);
        this.payload = payload;
    }

    /**
     * Produce an output event
     * @override
     */
    react(o: OutPort<T>){
        o.set(this.payload);
        console.log("Writing payload to SingleEvent's output.");
    }
}

export class SingleEvent<T> extends Reactor {

    o: OutPort<number> = new OutPort<number>(this);
    t1: Timer = new Timer(this, 0, 0);

    private _reactions =    [   {   triggers: [this.t1], 
                                    reaction: new ProduceOutput(this, 3), // "3"
                                    args: [<OutPort<number>>this.o]
                                }
                            ];

    constructor(outputPayload:any, parent: Reactor | null, name?:string ) {
        super(parent, name);                    
    }

    private check() {
        //if (false) {
            for (let r of this._reactions) {
                r.reaction.react.apply(undefined, r.args);                      
            }
        //}
    }
}



