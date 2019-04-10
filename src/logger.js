// @flow

'use strict';

import {Component, ReActor, InPort, Reaction} from './reactor';

export class Logger extends Component implements ReActor {
 
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