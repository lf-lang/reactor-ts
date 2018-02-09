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
        this.on('in1', () => this.send('output', this.get('in1') + this.get('in2')));
    }
}

class Swarmlet extends Composite {
    setup() {
        this.add(new Adder("My Adder"));
    }
}
