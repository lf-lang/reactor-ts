// @flow

'use strict';

import {Component, Composite, Containable, Relation, OutputPort, InputPort} from './hierarchy';
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

/**
 * A director coordinates the communication between actors. It can only be
 * embedded in a composite. A composite cannot execute without a director
 * associated to it directly or have one reachable up its containment chain.
 */
export interface Director extends Executable, Containable<Composite> {

    setTimeout(fn: Function, delay: number, ...args: any): Timeout;
    clearTimeout(timeout: Timeout): void;

    setImmediate(fn: Function, ...args: any): Immediate;
    clearImmediate(handle: Immediate): void;

    setInterval(fn: Function, miliseconds: number, ...args: any): Timeout;
    clearInterval(handle: Timeout): void;

    push<T>(port: Port<T>, value: T): void;
    peek<T>(port: Port<T>, index: number): ?T;
    peekMulti<T>(port: Port<T>): Array<T>;
    // poll<T>(port: Port<T>, index: number): ?T;
    // pollMulti<T>(port: Port<T>): Array<T>;

    connect(source: Port<mixed>, destination: Port<mixed>): Relation<mixed>; // FIXME: use * for inferred

}

export class DirectorBase extends Component implements Director {

    push<T>(port: Port<T>, value: T): void {
        if (port.parent == null) {
            throw "Cannot send to an unassociated port."
        } else {
            if (port.parent instanceof Composite 
                && port instanceof InputPort) {
                // Composite sending from input port
                var rels = port.parent.fanOut(port);
                if (rels != null) {
                    for (let r of rels) {
                        r.buffer.push(value);
                    }
                }
            } else {
                // Sending from output port
                var c = port.parent.parent;
                if (c == null) {
                    // No container => no relations
                } else {
                    var rels = c.fanOut(port);
                    if (rels != null) {
                        for (let r of rels) {
                            r.buffer.push(value);
                        }
                    }
                }
            }
        }
    }

    peek<T>(port: Port<T>, index: number): ?T {
        if (port.parent == null) {
            throw "Port is not associated with an actor."
        } else {
            if (port.parent.parent == null) {
                return null;
            } else {
                var rel = port.parent.parent.fanIn(port)[index];
                if (rel != null) {
                    return rel.buffer[0];
                }
            }
        }
    }

    peekMulti<T>(port: Port<T>): Array<T> {
        
        if (port.parent == null) {
            throw "Port is not associated with an actor."
        } else {
            var vals = [];
            if (port.parent.parent != null) {
             var rels = port.parent.parent.fanIn(port);
                if (rels != null) {
                    var index = 0;
                    for (let r of rels) {
                        vals[index++] = r.buffer[0];                            
                    }
                }
            }
            return vals;
        }
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
    connect<T>(source: Port<T>, sink: Port<T>): Relation<T> {

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
        var rel = new Relation(source, sink, ssource.name + "." + source.name 
            + "->" + ssink.name + "." + sink.name);
        var index = 0;

        // while(!container.add(rel)) {
        //     rel.name = rel.name + "(" + ++index + ")";
        // }
        if(!container.add(rel)) { // FIXME: Perhaps throw this in add?
            throw "Cannot add relation that already exists.";
        }
        return rel;
    }


    setTimeout(fn: Function, delay: number, ...args: any): Timeout {
        return new Timeout(setTimeout(fn, delay, args));
    }

    clearTimeout(handle: Timeout): void {
        return clearTimeout(handle);
    }

    setImmediate(fn: Function, ...args:any): Immediate {
        return new Timeout(setImmediate(fn, args));
    }

    clearImmediate(handle: Immediate): void {
        clearImmediate(handle);
    }

    setInterval(fn: Function, delay: number, ...args: mixed): Timeout {
        return new Timeout(setInterval(fn, delay, args));
    }

    clearInterval(handle: Timeout): void {
        return clearInterval(handle.valueOf()); // FIXME: not sure why this is necessary.
    }
}