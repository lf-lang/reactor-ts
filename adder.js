// @flow

'use strict';

import {Accessor} from './accessor';
import {Composite} from './hierarchy'

export class Adder extends Accessor {

    setup () {
        super.setup();
        this.input('in1');
        this.input('in2')
        this.output('output');
    }

    initialize () {
        var thiz = this;
        this.addInputHandler('in1', function() { thiz.send('output', thiz.get('in1') + thiz.get('in2'))});
    }

    wrapup() {

    }
}

class Swarmlet extends Composite {
    setup() {
        this.add(new Adder("My Adder"));
    }
} 