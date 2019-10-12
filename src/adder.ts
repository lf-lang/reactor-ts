'use strict';

import {Reactor, InPort, OutPort, PrioritizedReaction, Trigger, Reaction, Reaction2} from './reactor';

export class Adder extends Reactor {
 
    in1: InPort<number> = new InPort(this);
    in2: InPort<number> = new InPort(this);
    out: OutPort<number> = new OutPort(this);
    
    _reactions = [
        new AddTwo(this, [this.in1, this.in2]),
        new AddN<number>(this, [this.in1, this.in2])
    ];
    //     new Reaction(this,[<Trigger>this.in1, <Trigger>this.in2], this.reactionID1, ),
    //      new Reaction(this,[<Trigger>this.in1, <Trigger>this.in2], )
    //     {triggers: [<Trigger>this.in1, <Trigger>this.in2], reaction: new AddTwo(), args: [this.in1, this.in2, this.out]},
    //     {triggers: [<Trigger>this.in1, <Trigger>this.in2], reaction: new AddN<number>(), args: [[this.in1, this.in2], this.out]},
    // ];

    _triggerMap:Map<Trigger, Set<[Reaction, Array<any>]>>;

    constructor() {
        super(null, "Adder");
        //new AddTwo2([this.in1, this.in2, this.in1]);
    }

    //FIXME: the if statement never runs.
    _checkTypes() {
        // Do not invoke any reactions; only show the 
        // type checker how it _would_ be done
        if (false) {
            for (let r of this._reactions) {
                //r.react.apply(undefined, r.args);
            }
        }
    }
}

export class AddTwo extends Reaction {

    // state: Object;
    // triggers: Array<Trigger>;

    // constructor(state: Reactor, triggers: Array<Trigger>){
    //     this.state = state;
    //     this.triggers = triggers;
    // }

    react = (in1: InPort<number>, in2: InPort<number>, out:OutPort<number>):void {
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

class AddN<T> implements extends Reaction {
    react = (src:Array<InPort<T>>, dst:OutPort<T>) {
        var sum;
        for (let i of src) {
            sum += i;
        }
        dst.set(sum);
    }
}

//FIXME: reaction2 has been deleted from reactor.ts
// export class AddTwo2 extends Reaction {

//     args;

//     constructor(...args) {
//         this.args = args;
//     }

//     react(in1: InPort<number>, in2: InPort<number>, out:OutPort<number>):void {
//         let a = in1.get();
//         let b = in2.get(); // FIXME: this looks a little clumsy
//         if (a == null) {
//             a = 0;
//         }
//         if (b == null) {
//             b = 0;
//         }
//         out.set(a + b);
//     }

//     _checkTypes() {
//         // Do not invoke any reactions; only show the 
//         // type checker how it _would_ be done
//         if (false) {
//             this.react.apply(undefined, this.args);
//         }
//     }
// }
