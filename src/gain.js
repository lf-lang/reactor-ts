// @flow

'use strict';

import {Accessor} from './accessor';

export class Gain extends Accessor {
    setup() {
        super.setup();
        this.input('input');
        this.output('scaled');
        this.parameter('gain');
    }

    initialize() {
        this.on('input',
                () => this.send('scaled',
                                this.get('input') * this.getParameter('gain')));
    }
};
