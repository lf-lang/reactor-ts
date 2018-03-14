// @flow

'use strict';

import {InputPort, OutputPort, Component, Relation, Composite} from './hierarchy';
import type {Timeout, Immediate, Director} from './director';
import {DirectorBase} from './director'
import type {Executable, ExecutionPhase, ExecutionStatus} from './director';
import type {Port} from './hierarchy';

/**
 * DiscreteEvents directory.
 */
export class DiscreteEvents extends DirectorBase {

    constructor() {
        super();
        (this:Director);
    }

    canAddSafely(relation: Relation<*>): boolean {
        // FIXME: check for zero-delay feedback 
        return true;
    }

    fire() {
        try {

        } catch(error) {
            // Ideas for error handling policies:
            // - substitute with different component
            // - suspend the actor's operation (cease future firings)
            // - log the error
        }
    }
}
