// @flow

'use strict';

import {InputPort, OutputPort, Component, Relation, Composite} from './hierarchy';
import type {Timeout, Immediate, Director} from './director';
import type {Executable, ExecutionPhase, ExecutionStatus} from './director';
import type {Port} from './hierarchy';

/**
 * DiscreteEvents directory.
 */
export class DiscreteEvents extends Component implements Director {

    constructor() {
        super("DEDirector");
    }

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

    send(port: Port<mixed>, value: mixed): void {
        if (port.parent == null) {
            throw "Cannot connect unassociated port."
        } else {
            if (port.parent instanceof Composite 
                && port instanceof InputPort) {
                // Composite sending from input port
                var rels = port.parent.fanOut(port.name);
                if (rels != null) {
                    for (let r of rels) {
                        // FIXME: put token
                    }
                }
            } else {
                // Sending from output port
                var c = port.parent.parent;
                if (c == null) {
                    // No container => no relations
                } else {
                    var rels = c.fanOut(port.name);
                    if (rels != null) {
                        for (let r of rels) {
                            // FIXME: put token
                        }
                    }
                }
            }
        }
    }

    get(port: Port<mixed>): mixed {
    
    }

    /**
     * Connect a source port to sink port.
     *
     * Connecting involves topology changes and semantics checks. The current
     * implementation only handles topology changes and basic type checks, it
     * does not support semantics check based on the director. See elaboration
     * at {@link https://github.com/nebgnahz/accessor-flow/issues/12 Issue 12}.
     *
     * @todo: include checks for safety.
     * @todo: move this into base class.
     */
    connect(source: Port<mixed>, sink: Port<mixed>): Relation<mixed> {

        var ssource: ?Component = source.parent;
        var ssink: ?Component = sink.parent;

        var container: ?Composite = null;

        if (ssource == null || ssink == null) {
            throw "Cannot connect unaffiliated ports; " +
                    "add them to a container first."
        }

        // The ports' parents are siblings.
        if (ssource.parent == ssink.parent) {

            // self-loop
            if (ssource == ssink) {
                // composite
                if(ssource instanceof Composite) {
                    // external self loop
                    if (source instanceof OutputPort &&
                        sink instanceof InputPort) {
                        if(ssource.parent == null) {
                            throw "Self-loops are not allowed in top-level.";
                        }
                    }
                    // internal shortcut
                    else if (!(source instanceof InputPort &&
                        sink instanceof OutputPort)) {
                        throw "Cannot connect inputs to inputs or outputs "
                        + "to outputs if unnested.";
                    }
                    container = ssource;
                } else {
                    // non-composite
                    if ((source instanceof InputPort &&
                        sink instanceof OutputPort)) {
                        throw "Cannot connect input to output on the same actor.";
                    }
                    if ((source instanceof InputPort &&
                        sink instanceof InputPort)) {
                        throw "Cannot connect input to input on the same actor.";
                    }
                    if ((source instanceof OutputPort &&
                        sink instanceof OutputPort)) {
                        throw "Cannot connect output to output on the same actor.";
                    }
                    // output -> input loop is allowed
                    if (ssource.parent == null) {
                        throw "No composite available to store relation.";
                    } else {
                        container = ssource.parent;
                    }
                }
            } else {
                // normal cascade
                if (!(source instanceof OutputPort &&
                        sink instanceof InputPort)) {
                    throw "Cannot connect inputs to inputs or outputs "
                    + "to outputs if unnested.";
                }
                if (ssource.parent == null) {
                    throw "No composite available to store relation.";
                } else {
                    container = ssource.parent;
                }
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
        // Generally: Do the types match? Check width.
        // In DE: Does the new topology introduce zero-delay feedback?
        // In SR: Does the new topology introduce consumption-rate mismatches?
        // use fanIn(sink) to check for existing relations and compare with width
        var rel = new Relation(source, sink, source.name + "->" + sink.name);
        var index = 0;

        while(!container.add(rel)) {
            rel.name = rel.name + "(" + ++index + ")";
        }
        return rel;
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
