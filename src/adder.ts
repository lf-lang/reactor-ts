'use strict';

import {Reactor, InPort, OutPort, UnorderedReaction, Trigger, Reaction} from './reactor';

export class Adder extends Reactor {
 
    in1: InPort<number> = new InPort(this);
    in2: InPort<number> = new InPort(this);
    out: OutPort<number> = new OutPort(this);
    
    _reactions = [
        {triggers: [<Trigger>this.in1, <Trigger>this.in2], reaction: new AddTwo(), args: [this.in1, this.in2, this.out]}
    ];


        // for (let r of this._reactions) {
        //     r.reaction.react.apply(undefined, r.args);
        // }

    _foo() {
        return this._reactions[0].reaction.react.apply(undefined, this._reactions[0].args);
    }
}

export class AddTwo implements UnorderedReaction {

    constructor() {
        
    }

    react(in1: InPort<number>, in2: InPort<number>, out:OutPort<number>):void {
        let a = in1.get();
        let b = in2.get(); // FIXME: this looks a little clumsy
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
// }