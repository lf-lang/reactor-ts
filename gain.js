// @flow

'use strict';

import {Accessor} from './accessor';

export class Gain extends Accessor {
    setup() {
        super.setup();
        this.newInput('input');
        this.newOutput('scaled');
        this.newParameter('gain');
    }

    initialize() {
        this.on('input',
                () => this.send('scaled',
                                this.get('input') * this.getParameter('gain')));
    }
};
