// @flow

'use strict';

/** ES6 imports */
import {Descendant, Component, Composite, Port} from './hierarchy';

/**
 * Type class for timers.
 */
export class Timeout extends Number {
    +ref: ?(() => this);
    +unref: ?(() => this);
}

/** Type alias for handles of "immediately" scheduled callbacks. */
export type Immediate = Timeout;

/** The execution phase of a director */
export type ExecutionPhase = "setup" | "initialize" | "fire" | "postfire" | "wrapup";

/** The status of an executing component. */
export type ExecutionStatus = "idle" | "settingup" | "initializing" | "firing" | "postfiring" | "wrappingup";

/**
 * An actor, director, or attribute must implement these methods.
 */
export interface Executable {
    setup(): void;
    initialize(): void;
    fire(): void;
    postfire(): void;
    wrapup(): void;
    setStatus(status: ExecutionStatus):void;
    getStatus(): ExecutionStatus;
}

export interface Scheduler {
    getSchedule(): Array<Executable>;
}

/**
 * A director coordinates the communication between actors. It can only be
 * embedded in a composite. A composite cannot execute without a director
 * associated to it directly or have one reachable up its containment chain.
 */
export interface Director extends Executable, Descendant<Composite>, Scheduler {

    setTimeout(fn: Function, delay: number): Timeout;
    clearTimeout(timeout: Timeout): void;

    setImmediate(fn: Function): Immediate;
    clearImmediate(handle: Immediate): void;

    setInterval(timeout: Timeout): void;
    clearInterval(handle: Timeout): void;

    send(port: Port, value: any): void; // FIXME: types
    get(port: Port): any;

    connect(source: Port, destination: Port): void;

    getExecutionPhase(): ExecutionPhase;
}


/**
 *
 */
// export class StatusUpdate implements Executable, Scheduler { // implements Attribute?

//     status: ExecutionStatus;

//     setup(): void {
//         for (let component of this.getSchedule()) {
//              component.setStatus("settingup");
//              component.setup();
//              component.setStatus("idle");
//         }
//     }

//     initialize() {

//     }

//     fire() {

//     }

//     postfire() {

//     }

//     wrapup() {

//     }

//     setStatus(status: ExecutionStatus) {
//         this.status = status;
//     }

//     getStatus(): ExecutionStatus {
//         return "idle";
//     }

//     getSchedule(): Array<Executable> {
//                 for (let component of this.getParent().deepComponentList()) { // FIXME: where to get the schedule from? deep contains()
//         //     component.setStatus("settingup");
//         //     component.setup();
//         //     component.setStatus("idle");
//         }
//         return null;
//     }

// }
