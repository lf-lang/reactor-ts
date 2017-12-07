// @flow

'use strict';

import {Accessor} from './accessor';
import {Composite} from './hierarchy'

export class Adder extends Accessor {
    setup() {
        super.setup();
        this.newInput('in1');
        this.newInput('in2')
        this.newOutput('output');
    }

    initialize() {
        var thiz = this;
        var add = function() {
            thiz.send('output', thiz.get('in1') + thiz.get('in2'))
        };
        this.addInputHandler('in1', add);
    }

    wrapup() {

    }
}

class Swarmlet extends Composite {
    setup() {
        this.add(new Adder("My Adder"));
    }
}
