'use strict';

import {Reactor, InPort, OutPort, Trigger, Reaction} from './reactor';

export class Adder extends Reactor {

    in1: InPort<number> = new InPort(this);
    in2: InPort<number> = new InPort(this);
    out: OutPort<number> = new OutPort(this);

    _reactions = [
        {   triggers: [this.in1, this.in2], 
            reaction: new AddTwo(this), 
            args: [<InPort<number>>this.in1, <InPort<number>>this.in2, <OutPort<number>>this.out]
        }
    ];
    
    constructor() {
        super(null, "Adder");
    }

    check() {
        for (let r of this._reactions) {
               r.reaction.react.apply(undefined, r.args);                      
        }
    }

    register() {
        var previous: Reaction | null = null;
        for (let r of this._reactions) {
            this.app.triggerMap.registerReaction(previous, r.reaction, r.triggers, r.args);
            previous = r.reaction;
        }
    }
}

class AddTwo extends Reaction {
    react(in1: InPort<number>, in2: InPort<number>, out:OutPort<number>):void {
        let a = in1.get();
        let b = in2.get();
        if (a == null) {
            a = 0;
        }
        if (b == null) {
            b = 0;
        }
        out.set(a + b);
    }
}

// class AddN<T> implements UnorderedReaction {
//     react(src:Array<Readable<T>>, dst:Writeable<T>) {
//         var sum;
//         for (let i of src) {
//             sum += i;
//         }
//         dst.set(sum);
//     }