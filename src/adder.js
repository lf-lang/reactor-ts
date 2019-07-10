// @flow

'use strict';

import {Reactor, InPort, OutPort, UnorderedReaction} from './reactor';

export class Adder extends Reactor {
 
    in1: InPort<number> = new InPort(this);
    in2: InPort<number> = new InPort(this);
    out: OutPort<number> = new OutPort(this);
    
    _reactions = [
        [[this.in1, this.in2], new AddTwo(), [this.in1, this.in2, this.out]]
    ];

    constructor() {
        super();
        /** Type checking */
        let triggers = this._reactions[0][0];
        let reaction = this._reactions[0][1];
        let args = this._reactions[0][2];
        (undefined:
            $Call<typeof reaction.react, 
                $ElementType<typeof args, 0>, 
                $ElementType<typeof args, 1>, 
                $ElementType<typeof args, 2>
            >
        );
    }
}

class AddTwo implements UnorderedReaction {
    react(in1: InPort<number>, in2: InPort<number>, out:OutPort<number>):void {
        out.set(in1.get() + in2.get());
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