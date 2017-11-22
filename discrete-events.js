// @flow

'use strict';

import type { Timeout, Immediate, Director } from './director';
import type { Executable, ExecutionPhase, ExecutionStatus } from './director';
import type {Port, Composite} from './hierarchy';

class DiscreteEvents implements Director {
    // **************************************
    //
    // interface Director
    //
    // **************************************
    setTimeout(fn: Function, delay: number): Timeout {
        throw new Error('Unimplemented');
    }

    clearTimeout(timeout: Timeout): void {
    }

    setImmediate(fn: Function): Immediate {
        throw new Error('Unimplemented');
    }

    clearImmediate(handle: Immediate): void {
    }

    setInterval(timeout: Timeout): void {
    }

    clearInterval(handle: Timeout): void {
    }

    send(port: Port, value: any): void {
    } // FIXME: types

    get(port: Port): any {
    }

    connect(source: Port, destination: Port): void {
    }

    getExecutionPhase(): ExecutionPhase {
        throw new Error('Unimplemented');
    }

    // **************************************
    //
    // interface Executable
    //
    // **************************************
    setup(): void {}

    initialize(): void {}

    fire(): void {}

    postfire(): void {}

    wrapup(): void {}

    setStatus(status: ExecutionStatus): void {}

    getStatus(): ExecutionStatus {
        throw new Error('Unimplemented');
    }

    // **************************************
    //
    // interface Descendant<Composite>
    //
    // **************************************
    setParent(parent: ?Composite): void {}
    getParent(): ?Composite {}
    getFullyQualifiedName(): string {
        throw new Error('Unimplemented');
    }

    // ******************************
    //
    // From Scheduler Interface
    //
    // ******************************
    getSchedule(): Array<Executable> {
        throw new Error('Unimplemented');
    }
}
