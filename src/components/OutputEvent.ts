'use strict';

import {Reactor, Reaction} from '../reactor';
import {SingleEvent} from './SingleEvent';

export class OutputResponse<T> extends Reaction<T> {

    /**
     * If this reaction is triggered by an output event from the contained reactor,
     * succeed the test.
     * @override
     */
    react() {
        this.parent.util.success();
    }
}

/**
 * This reactor calls the success callback if it triggers a reaction in response
 * to a value being set to a contained reactor's output port.
 */
export class OutputResponder extends Reactor {

    se: SingleEvent<string> = new SingleEvent(this, "ContainedSingleEvent");
    
    constructor(parent: Reactor){
        super(parent);
        this.addReaction(new OutputResponse(this, [this.se.o], []));
    }
}


