// @flow

'use strict';

import {Composite, Component, Port, PortSet} from './hierarchy'
import type {Executable, ExecutionStatus} from './director';

/**
 * An actor is a `Component` (hence has its parent composite) and implements
 * `Executable` (can be called and scheduled by a director).
 */
export class Actor extends Component implements Executable {

    ports: PortSet;
    status: ExecutionStatus;

    /**
     * Constructs a new Actor with a specific name.
     */
    constructor(name: string, parent?: ?Composite) {
        super(name, parent);
        this.ports = new PortSet(this);
        this.status = "idle";
        (this: Executable); // check that interfaces are implemented properly.
    }

    /**
     * Adds a new input port, identified by the name.
     */
    addInputPort(name: string) {
        this.ports.add(new Port(name, "input"));
    }

    /**
     * Adds a new output port, identified by the name.
     */
    addOutputPort(name: string) {
        this.ports.add(new Port(name, "output"));
    }

    /**
     * Return all ports of this accessor.
     */
    getPorts(): PortSet {
        return this.ports;
    }

    /**
     * Return a specific port,
     */
    getPort(name: string): ?Port {
        return this.ports.get(name);
    }

    // **************************************
    //
    // interface Executable
    //
    // **************************************

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
     * Initialize the actor as the first phase of its execution. The base
     * implementation only sets the status to "wrappingup."  Subclasses should
     * override this method, call super() and, at the end of the method, set the
     * status to "idle."
     */
    initialize(): void {
        this.setStatus("initializing");
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
     * Clean up any state not to be carried over to the next execution.
     * The base implementation only sets the status to "wrappingup."
     * Subclasses should override this method, call super() and, at
     * the end of the method, set the status to "idle."
     */
    wrapup(): void {
        this.setStatus("wrappingup");
    }

    /**
     * Set the current execution status. Only to be called by the director.
     */
    setStatus(status: ExecutionStatus): void {
        this.status = status;
    }

    /**
     * Retieve the current execution status.
     */
    getStatus(): ExecutionStatus {
        return this.status;
    }
}
