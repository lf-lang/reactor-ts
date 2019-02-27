// @flow

'use strict';

import {Component, Actor, InPort, OutPort, Reaction} from './actor';

export class Adder extends Component implements Actor {
 
    in1: InPort<number> = new InPort(this);
    in2: InPort<number> = new InPort(this);
    out: OutPort<number> = new OutPort(this);
    
    _init() {};
    _wrapup() {};

    _reactions = [
        [[this.in1, this.in2], new AddTwo([this.in1, this.in2, this.out])]
    ];
}

class AddTwo extends Reaction<[*, *, *], ?{}> {
    react():void {
        this.io[2].set(this.io[0].get() + this.io[1].get());
    }
}