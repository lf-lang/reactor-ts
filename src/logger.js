// @flow

'use strict';

import {Component, Actor, InPort, Reaction} from './actor';

export class Logger extends Component implements Actor {
 
    in: InPort<*> = new InPort(this);

    _init() {};
    _wrapup() {};

    _reactions = [
        [[this.in], new Print(this.in)]
    ];
}

class Print extends Reaction<*, ?{}> {
    react() {
        console.log(this.io.get());
    }
}