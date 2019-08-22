'use strict';

import {Reactor, InPort, OutPort, UnorderedReaction, Trigger, Reaction, Reaction2} from './reactor';

export class Adder extends Reactor {
 
    in1: InPort<number> = new InPort(this);
    in2: InPort<number> = new InPort(this);
    out: OutPort<number> = new OutPort(this);
    
    _reactions = [
        {triggers: [<Trigger>this.in1, <Trigger>this.in2], reaction: new AddTwo(), args: [this.in1, this.in2, this.out]},
        {triggers: [<Trigger>this.in1, <Trigger>this.in2], reaction: new AddN<number>(), args: [[this.in1, this.in2], this.out]},
    ];

    _triggerMap:Map<Trigger, Set<[UnorderedReaction, Array<any>]>>;

    constructor() {
        super(null, "Adder");
        new AddTwo2([this.in1, this.in2, this.in1]);
    }

    _checkTypes() {
        // Do not invoke any reactions; only show the 
        // type checker how it _would_ be done
        if (false) {
            for (let r of this._reactions) {
                r.reaction.react.apply(undefined, r.args);
            }
        }
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

class AddN<T> implements UnorderedReaction {
    react(src:Array<InPort<T>>, dst:OutPort<T>) {
        var sum;
        for (let i of src) {
            sum += i;
        }
        dst.set(sum);
    }
}


export class AddTwo2 implements Reaction2 {

    args;

    constructor(...args) {
        this.args = args;
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

    _checkTypes() {
        // Do not invoke any reactions; only show the 
        // type checker how it _would_ be done
        if (false) {
            this.react.apply(undefined, this.args);
        }
    }
}
