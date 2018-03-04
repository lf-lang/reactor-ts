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
        super("DEDirector");
    }

    canAddSafely(relation: Relation<*>): boolean {
        // FIXME: check for zero-delay feedback 
        return true;
    }

}
