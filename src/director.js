// @flow

'use strict';

import {Component, Composite, Containable, Relation} from './hierarchy';
import type {Port} from './hierarchy';

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
    initialize(): void;
    fire(): void;
    postfire(): void;
    wrapup(): void;
}

export interface Scheduler {
    getSchedule(): Array<Executable>;
}

/**
 * A director coordinates the communication between actors. It can only be
 * embedded in a composite. A composite cannot execute without a director
 * associated to it directly or have one reachable up its containment chain.
 */
export interface Director extends Executable, Containable<Composite>, Scheduler {

    setTimeout(fn: Function, delay: number): Timeout;
    clearTimeout(timeout: Timeout): void;

    setImmediate(fn: Function): Immediate;
    clearImmediate(handle: Immediate): void;

    setInterval(timeout: Timeout): void;
    clearInterval(handle: Timeout): void;

    send(port: Port<mixed>, value: mixed): void;
    get(port: Port<mixed>): mixed;

    connect(source: Port<mixed>, destination: Port<mixed>): Relation<mixed>; // FIXME: use * for inferred

    getExecutionPhase(): ExecutionPhase;
}
