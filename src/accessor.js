// @flow

'use strict';

import {Port, PortSet} from './hierarchy';
import {Actor} from './actor';

export class Accessor extends Actor {

    handlers: Array<Function>;
    triggers: Map<string, number>;

    /**
     * Construct a new Accessor.
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
     * Declare a new input.
     */
    newInput(name: string, options?: ?Object) {
        if (options == null) {
            this.ports.add(new Port(name, "input"));
        } else {
            if (options.value != null) {
                this.ports.add(new Port(name, "portparameter", options.type,
                    options.value, options.options, options.visibility));
            } else {
                this.ports.add(new Port(name, "input", options.type,
                    options.value, options.options, options.visibility));
            }
        }
    }

    provideInput(name: string, value: any) {
        var port = this.ports.get(name);

        if (port == null) {
            throw "No port named: `" + name + "`."
        }

        if (port.getPortType() != "input") {
            throw "Port named `" + name + "` is not an input port."
        }

        port.push(value);
    }

    /**
     * Retrieve a value from an input/output port with a given name.
     */
    get(name: string): any {
        var port = this.ports.get(name);

        if (port == null) {
            throw "No port named: `" + name + "`."
        }

        return port.pop();
    }

    /**
     * Retrieve a parameter value.
     */
    getParameter(name: string): any {
        var port = this.ports.get(name);
        if (port != null && port.getPortType() == "parameter") {
            return port.peek();
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
    newOutput(name: string, options?: ?Object) {
        if (options == null) {
            this.ports.add(new Port(name, "output"));
        } else {
            this.ports.add(new Port(name, "output", options.type,
                options.value, options.options, options.visibility));
        }
    }

    /**
     * Declare a new parameter.
     */
    newParameter(name: string, options?: ?Object) {
        if (options == null) {
            this.ports.add(new Port(name, "parameter"));
        } else {
            this.ports.add(new Port(name, "parameter", options.type,
                options.value, options.options, options.visibility));
        }
    }

    /**
     * Send a value to an output port with a given name.
     */
    send(name: string, value: any) {
        var port = this.ports.get(name);

        if (port == null) {
            throw "No port named: `" + name + "`."
        }

        if (port.getPortType() != "output") {
            throw "Port named `" + name + "` is not an output port."
        }

        port.push(value);
    }

    /**
     * Set the value of a parameter.
     */
    setParameter(name: string, value: any):void {
        // only change the value if not executing, throw an exception otherwise
        if (this.parent == null || this.parent.getDirector().getExecutionPhase() == "setup") {
            var port = this.ports.get(name);
            if (port != null && port.getPortType() == "parameter") {
                port.push(value);
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
        this.ports = new PortSet(this);
    }

    /**
     * Fire this accessor.
     */
    fire(): void {
        // invoke input handlers
        var keys = this.triggers.keys();
        for (let name of keys) {
            var index = this.triggers.get(name);
            var port = this.ports.get(name);
            if (index == null) {
                throw "Unable to find handler."
            } else {
                var handler = this.handlers[index];
            }

            if (port != null && port.peek() != null) {
                handler.call(this);
            }

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
