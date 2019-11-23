'use strict';

import {Reactor, InPort, OutPort, Reaction} from '../reactor';

export class Adder extends Reactor {
 
    in1: InPort<number> = new InPort(this);
    in2: InPort<number> = new InPort(this);
    out: OutPort<number> = new OutPort(this);

    constructor(parent: Reactor | null) {
        super(parent, "Adder");

        const r1 = new AddTwo(this, [this.in1, this.in2], [this.in1, this.in2], [this.out]);
        const r2 = new AddN(this, [this.in1, this.in2], [this.in1, this.in2], [this.out]);
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

class AddTwo extends Reaction {

    // state: Object;
    // triggers: Array<Trigger>;

    // constructor(state: Reactor, triggers: Array<Trigger>){
    //     this.state = state;
    //     this.triggers = triggers;
    // }

    react = function () {
        let a = this.state.in1.get();
        let b = this.state.in2.get(); // FIXME: this looks a little clumsy
        if (a == null) {
            a = 0;
        }
        if (b == null) {
            b = 0;
        }
        this.state.out.set(a + b);
    }
}
//FIXME: do the typechecking to ensure addition is valid here.
class AddN extends Reaction {
    react = function () {
        let sum = 0;
        for (let i of this.state._inputs) {
            sum += i;
        }
        this.state.out.set(sum);
    }
}