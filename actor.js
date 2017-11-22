// @flow

'use strict';

/** ES6 imports */
import {Map} from './map';
import {Component, Port, PortSet} from './hierarchy'

/** Flow type imports */
import type {Executable, ExecutionStatus} from './director';

// NOTE: the semantics of postfire (state update) would be difficult to enforce
// because asynchronous callbacks can modify the state of an accessor at any
// time (i.e., outside of postfire, or even outside of fire), unless the
// director has control over the event queue.

export class Actor extends Component implements Executable {

    ports: PortSet;
    status: ExecutionStatus;

    /**
     * Construct a new Actor.
     */
    constructor(name: string) {
        super(name);
        this.ports = new PortSet(this);
        this.status = "idle";
        (this: Executable); // check that interfaces are implemented properly.
    }

    /**
     * Retieve the current execution status.
     */
    getStatus(): ExecutionStatus {
        return this.status;
    }

    /**
     * Return all ports of this accessor.
     */
    getPorts(): PortSet {
        return this.ports;
    }

    /**
     * Initialize the accessor as the first phase of its execution.
     * The base implementation only sets the status to "wrappingup."
     * Subclasses should override this method, call super() and, at
     * the end of the method, set the status to "idle."
     */
    initialize(): void {
        this.setStatus("initializing");
    }

    /**
     * Only used for SR actors that fire multuple times before they commit
     * to a new state. The fire method of such actor must be side-effect-free.
     * The base implementation only sets the status to "postfiring."
     * Subclasses should override this method, call super() and, at
     * the end of the method, set the status to "idle."
     */
    postfire() {
        this.setStatus("postfiring");
    }

    /**
     * Set the current execution status. Only to be called by the director.
     */
    setStatus(status: ExecutionStatus): void {
        this.status = status;
    }

    /**
     * Set up this accessors actor interface prior to exection.
     * The base implementation only sets the status to "settingup."
     * Subclasses should override this method, call super() and, at
     * the end of the method, set the status to "idle."
     */
    setup(): void {
        this.setStatus("settingup");
    }

    /**
     * Fire this actor. The base implementation only sets the status to
     * "firing." Subclasses should override this method, call super()
     * and, at the end of the method, and set the status to "idle."
     */
    fire(): void {
        this.setStatus("firing");
    }

    /**
     * Clean up any state not to be carried over to the next execution.
     * The base implementation only sets the status to "wrappingup."
     * Subclasses should override this method, call super() and, at
     * the end of the method, set the status to "idle."
     */
    wrapup(): void {
        this.setStatus("wrappingup");
    }
}
