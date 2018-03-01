// @flow

'use strict';

import {Actor, InputPort, OutputPort, Parameter} from './hierarchy';

import type {Port, Visibility} from './hierarchy'

export type LegacyInputType = "boolean"|"int"|"number"|"string"|"JSON";
export type LegacyInputSpec = {type?: LegacyInputType, value?: any, options?: any, visibility?: Visibility};

/**
 * AccessorAPI provides the specifications for Accessor definition according to
 * the spec on the wiki, link:
 * https://wiki.eecs.berkeley.edu/accessors/Version1/AccessorSpecification
 */
export interface AccessorAPI {
    /*
     * Add a function to handle new inputs.
     * @param {string} input
     * @param {Function} handler
     */
    addInputHandler(input: string, handler: Function): number;

    /*
     * Retrieve the value of a parameter.
     */
    getParameter(name: string): any;

    /*
     * Set up this accessors actor interface prior to exection.
     * The base implementation only sets the status to "settingup."
     * Subclasses should override this method, call super() and, at
     * the end of the method, set the status to "idle."
     */
    setup(): void;

    /*
     * Provide to a named input the given value.
     */
    provideInput(name: string, value: any): void;
    //...
}

/**
 * An an actor that implements the accessor API.
 * The semantics of get and send are different from
 * Port.send and Port.recv => prefire!
 */
export class Accessor extends Actor implements AccessorAPI {

    handlers: Array<Function>;
    triggers: Map<string, number>;

    /**
     * Construct a new Accessor.
     * @memberof accessor.Accessor
     */
    constructor(name: string) {
        super(name);
        this.handlers = [];
        this.triggers = new Map();
    }

    /**
     * Register an input handler. A handle is returned that can be used for
     * unregistering.
     */
    addInputHandler(input: string, handler: Function): number {
        var index = this.handlers.push(handler) -1;
        this.triggers.set(input, index);
        return index;
    }

    /**
     * A handy shortcut to `Accessor.addInputHandler` function.
     */
    on(input: string, handler: Function): number {
        return this.addInputHandler(input, handler);
    }

    /**
     * Legacy method for declaring a new input.
     */
    input(name: string, spec?: LegacyInputSpec) {
        if (spec == null) {
            this.add(new InputPort(name));
        } else {
            var options = {};
            if (spec.value != null) {
                options['value'] = spec.value;
            }
            if (spec.visibility != null) {
                options['visibility'] = spec.visibility;
            }
            if (spec.type != null) {
                if (spec.value == null ||
                    ((spec.type == "int" && typeof options.value === "number")
                        || typeof options.value === spec.type)) {
                    this.add(new InputPort(name, options));
                } else {
                    throw "Supplied default value incompatible with given type."
                }
            }
        }
    }

    /**
     * Retrieve a value from an input/output port with a given name.
     */
    get(name: string): any {
        var port = this.find(name, "ports");

        if (port == null) {
            throw "No port named: `" + name + "`."
        }

        return null; // FIXME: need to retrieve token from map
    }

    /**
     * Retrieve a parameter value.
     */
    getParameter(name: string): any {
        var port = this.find(name, "ports");
        if (port != null && port instanceof Parameter) {
            return null; // FIXME: need to retrieve token from map
        } else {
            throw "No parameter named `" + name + "`.";
        }
    }

    /**
     * Initialize the accessor as the first phase of its execution.
     */
    initialize(): void {
        // clear registered input handlers
        this.handlers = [];
        this.triggers.clear();
    }

    /**
     * Declare a new output
     */
    output(name: string, options?: ?Object) {
        this.add(new OutputPort(name, options));
    }

    /**
     * Declare a new parameter.
     */
    parameter(name: string, options?: ?Object) {
        this.add(new Parameter(name, options));
    }

    /**
     * Send a value to an output port with a given name.
     */
    send(name: string, value: any) {
        var port = this.find(name, "ports");

        if (port == null) {
            throw "No port named: `" + name + "`."
        }

        if (!(port instanceof Parameter)) {
            throw "Port named `" + name + "` is not an output port."
        }
        //FIXME: do the send
    }

    /**
     * Set the value of a parameter.
     */
    setParameter(name: string, value: any):void {
        // only change the value if not executing, throw an exception otherwise
        if (this.parent == null || this.parent.getDirector().getExecutionPhase() == "setup") {
            var port = this.find(name, "ports");
            if (port != null && port instanceof Parameter) {
                //port.push(value); // FIXME
            } else {
                throw "No parameter named `" + name + "`.";
            }
        } else {
            throw "Cannot reset parameter during execution. Use a port instead."
        }

    }

    /**
     * Set up this accessors actor interface prior to exection.
     */
    setup(): void {
        //
    }

    /**
     * Provide to a named input the given value.
     * @todo: implement provide input
     */
    provideInput(name: string, value: any): void {
        var port = this.find(name, "ports");

        if (port == null) {
            throw "No port named: `" + name + "`."
        }
    }

    /**
     * todo: for each input, pop one token off their queue
     */
    prefire(): void {
        // for (port: Port in this.portset.getInputs()) {
            return;
        // }
    }

    /**
     * Fire this accessor.
     */
    fire(): void {
        super.fire(); // this will call prefire
        // invoke input handlers
        var keys = this.triggers.keys();
        for (let name of keys) {
            var index = this.triggers.get(name);
            var port = this.find(name, "ports");
            if (index == null) {
                throw "Unable to find handler."
            } else {
                var handler = this.handlers[index];
            }

            // FIXME:
            // if (port != null && port.peek() != null) {
            //     handler.call(this);
            // }

            // Current situation
            // Node-specific: Ports are one-slot buffers; sends are destructive
            // In general: subsequent reads don't consume more tokens.

            // NOTE: test case:
            // Expected behavior in node / commonhost:
            // two handlers output during the same firing, the first output will disappear.
            // In CapeCode:
            // Both outputs will be received, during subsequent firings

            // SOLUTION: peek on triggers, pop inside handlers

        }
    }
}
