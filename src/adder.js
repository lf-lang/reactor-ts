// @flow

'use strict';

import {Accessor} from './accessor';
import {Composite} from './hierarchy'

export class Adder extends Accessor {
    setup() {
        super.setup();
        this.input('in1');
        this.input('in2');
        this.output('output');
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
