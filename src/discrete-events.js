// @flow

'use strict';

import {InputPort, OutputPort, Component, Relation, Composite} from './hierarchy';
import type { Timeout, Immediate, Director } from './director';
import type { Executable, ExecutionPhase, ExecutionStatus } from './director';
import type {Port} from './hierarchy';

export class DiscreteEvents extends Component implements Director {
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

    send(port: Port<mixed>, value: any): void {
    } // FIXME: types

    get(port: Port<mixed>): any {
    }

    /**
     * Connect a source port to sink port.
     * @todo: include checks for safety.
     */
    connect(source: Port<mixed>, sink: Port<mixed>): void {

        var ssource: ?Component = source.parent;
        var ssink: ?Component = sink.parent;

        var container: ?Composite = null;

        if (ssource == null || ssink == null) {
            throw "Cannot connect unaffiliated ports; " +
                    "add them to a container first."
        }
        
        // The ports' parents are siblings.
        if (ssource.parent == ssink.parent) {
            // output -> input
            if(ssource.parent == null && ssource instanceof Composite) {
                
                if (source instanceof InputPort && source instanceof OutputPort) {
                    // top-level composite input connecting to its own output
                    container = ssource;
                }
                else if(source instanceof OutputPort && source instanceof InputPort) {
                    throw "Cannot construct self-loop in top-level composite.";
                } else {
                    throw "Cannot connect top-level inputs to top-level inputs " +
                    "or top-level outputs to top-level outputs.";
                }
            } else {
                throw "No composite available to store relation."
            }
        }
        // The source's component is a parent of the sink's component.
        else if (ssource == ssink.parent) {
            // input -> input
            if (ssource instanceof Composite && 
                source instanceof InputPort && 
                sink instanceof InputPort) {
                container = ssource;
            } else {
                throw "Hierarchical relation dictates that " +
                "both ports must be inputs."
            }
        }

        // The sink's component is a parent of the source's component.
        else if (ssink == ssource.parent) {
            // output -> output
            if (ssink instanceof Composite && 
                source instanceof OutputPort && 
                sink instanceof OutputPort) {
                container = ssink;
            } else {
                throw "Hierarchical relation dictates that " +
                "both ports must be outputs."
            }
        }
        // Source and sink cannot be connected.
        else {
            throw "Cannot connect port `" + source.name + "` to port `" 
            + sink.name + "` because there is no direct path between them.";
        }

        // FIXME: do some extra checks here.
        // Generally: Do the types match?
        // In DE: Does the new topology introduce zero-delay feedback?
        // In SR: Does the new topology introduce consumption-rate mismatches?
        var rel = new Relation(source, sink, source.name + "->" + sink.name);
        var index = 0;

        while(!container.add(rel)) {
            rel.name = rel.name + "(" + ++index + ")";
        }
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
