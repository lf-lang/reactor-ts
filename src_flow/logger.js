// @flow

'use strict';

import {Reactor, InPort, UnorderedReaction} from './reactor';

export class Logger extends Reactor {
 
    inp: InPort<*> = new InPort(this);

    _reactions = [
        [[this.inp], new Print(), [this.inp]]
    ];
}

class Print implements UnorderedReaction {
    react(inp: InPort<*>) {
        console.log(inp.get());
    }
}