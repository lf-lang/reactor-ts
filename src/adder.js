// @flow

'use strict';

import {Composite, Actor, Reactive, InPort, OutPort} from './actor';

class Adder extends Actor implements Reactive {
 
    in1: InPort<number> = new InPort(this);
    in2: InPort<number> = new InPort(this);
    out: OutPort<number> = new OutPort(this);

    _reactions = [
        [[this.in1, this.in2], this.add]
    ];

    add = function() {
        this.out.send(this.in1._value + this.in2._value); // FIXME: we should probably use get instead
    }

}