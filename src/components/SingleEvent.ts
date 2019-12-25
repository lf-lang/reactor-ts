'use strict';

import {Reactor, InPort, OutPort, Trigger, Reaction, Timer, Trigs, Args, Writable, ArgType} from '../reactor';
export class ProduceOutput<T, S> extends Reaction<T> {

    constructor(parent: Reactor, trigs:Trigger[], args: ArgType<T>, private payload:S) {
        super(parent, trigs, args);
    }

    /**
     * Produce an output event
     * @override
     */
    //@ts-ignore
    react(o: Writable<S>) {
        o.set(this.payload);

        // FIXME: create a test that actually tests double sets.
        // It's confusing to have SingleEvent be a DoubleEvent.
        // Duplicate sets for the same port is bad form,
        // but its worth checking that the correct value (from the last set)
        // is delivered.
        console.log("Writing payload to SingleEvent's output.");
    }
}

export class SingleEvent<T> extends Reactor {

    o: OutPort<T> = new OutPort<T>(this);
    t1: Timer = new Timer(this, 0, 0);

    constructor(parent:Reactor, private payload:T) {
        super(parent);
        this.addReaction(new ProduceOutput(this, Trigs(this.t1), Args(this.getWritable(this.o)), payload));
    }
}



