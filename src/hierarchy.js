// @flow

'use strict';

import type {Executable, Director, ExecutionStatus} from './director'

/** 
 * A hint to the host of whether this port should be made visible.
 * @todo: should also affect the connectability of the port?
 */
export type Visibility = "full" | "none" | "expert" | "notEditable";

export type Port<T> = InputPort<T>|OutputPort<T>; // FIXME: Maybe add Parameter?

/**
 * An interface for named objects.
 */
export interface Nameable {
    /** The name of this object. */
    name: string;

    /** Return a globally unique identifier. */
    getFullyQualifiedName(): string;
}

/**
 * An extension of the Nameable interface for objects that 
 * are part of a hierarchy. The type parameter denotes the 
 * type of object that it can be contained by.
 */
export interface Containable<T> extends Nameable {
    
    /** The container of this object. */
    parent: ?T;
}

/**
 * A generic container. It can contain things that are named,
 * and it must have a name itself.
 */
export interface Container<T: Nameable> extends Nameable {
    
    /**
     * Add an element to this container.
     * @param {T} element
     */
    add(element: T): void;

    /**
     * Get an element from this container.
     * @param {string} name
     */    
    lookup(name: string): ?T;

    /**
     * Get an elements held by this container.
     */    
    getAll(): Array<mixed>;

    /**
     * Remove an element from this container.
     * @param {string} name
     */
    remove(name: string): void;

    /**
     * Add an element to this container. If a component with the same name
     * already exists, replace it.
     * @param {T} element
     */
    substitute(element: T): void;

}

export class PortBase<T> implements Containable<Component> {
    /** The component this port is contained by. */
    parent: ?Component;
    
    /** The name of this port. */
    name: string;

    /** The visibility of this port. */
    visibility: Visibility;
    
    /**
     * Construct a new port. Upon creation it will not be
     * associated to any component.
     */
    constructor(name: string) {
        this.name = name;
        this.visibility = "full";
        (this: Containable<Component>);
    }

    /**
     * Return the fully qualified name of this nameable based on its ancestry.
     */
    getFullyQualifiedName(): string {
        var prefix = "";
        if (this.parent != null) {
            prefix = this.parent.getFullyQualifiedName();
        }
        if (prefix != "") {
            return prefix + "." + this.name;
        } else {
            return this.name;
        }
    }
}

/**
 * An input port. The type parameter denotes the type
 * of values that to pass through this port.
 */
export class InputPort<T> extends PortBase<T> {
    
    /** A default value that is used when input is absent. */
    default: ?T;

    /** The width of this port. By default it is 1.*/
    width: number;

    /** Construct a new input port given a name and a set of options. */
    constructor(name: string, options?: ?{value?: T, isParameter?: boolean, 
        visibility?: Visibility,width?: number}) {
        super(name);
        this.width = 1;
        if (options != null) {
            this.default = options['value'];
            if (options['width'] != null) {
                this.width = options['width'];
            }
            if (options['visibility'] != null) {
                this.visibility = options['visibility'];
            }
        }
        (this: Port<T>);
    }
}

/**
 * Unlike normal input ports, parameters cannot be updated.
 */
export class Parameter<T> extends InputPort<T> {

}

/**
 * A collection of meta data that represents a port.
 */
export class OutputPort<T> extends PortBase<T> {
    spontaneous: boolean;;
    
    /**
     * Construct a new output port given a name and a set of options.
     */
    constructor(name: string, options?: ?{spontaneous?: boolean, visibility?: Visibility}) {
        super(name);
        this.spontaneous = false;
        if (options != null) {
            if (options['spontaneous'] != null) {
                this.spontaneous = options['spontaneous'];
            }
            if (options['visibility'] != null) {
                this.visibility = options['visibility'];
            }
        }
        (this: Port<T>);
    }
}

/**
 * A base class for executable components. Importantly, components can only 
 * be contained by a specific kind of component, namely a composite.
 * @todo: it might be a good idea to base this class of off EventEmitter.
 */
export class Component implements Containable<Composite>, Executable {

    name: string;
    parent: ?Composite;

    constructor(name: string) {
        this.name = name;
        (this: Containable<Composite>);
        (this: Executable);
    }

    /**
     * Return the fully qualified name of this nameable based on its ancestry.
     */
    getFullyQualifiedName(): string {
        var prefix = "";
        if (this.parent != null) {
            prefix = this.parent.getFullyQualifiedName();
        }
        if (prefix != "") {
            return prefix + "." + this.name;
        } else {
            return this.name;
        }
    }

    // **************************************
    //
    // interface Executable
    //
    // **************************************

    /**
     * Initialize the component as the first phase of its execution.
     */
    initialize(): void {
    
    }

    /**
     * Fire this component.
     */
    fire(): void {
        this.prefire();
    }

    /**
     * @todo: we probably need this in order to let accessors fetch inputs 
     * prior to firing.
     */
    prefire() {
        // override this in accessor
    }

    /**
     * Only used in the context of SR where components need to fire multiple
     * times before they commit to a new state. The fire method of such 
     * component must be side-effect-free.
     */
    postfire() {
    }

    /**
     * Clean up any state not to be carried over to the next execution.
     */
    wrapup(): void {
    }

    /**
     * Set the current execution status. Only to be called by the director.
     */
    setStatus(status: ExecutionStatus): void {
    }
}

export class Actor extends Component implements Container<Port<mixed>> {

    inputs: Map<string, InputPort<mixed>>;
    outputs: Map<string, OutputPort<mixed>>;

    /**
     * Constructs a new Actor with a specific name.
     */
    constructor(name: string, parent?: ?Composite) {
        super(name);
        this.parent = parent;
        this.inputs = new Map();
        this.outputs = new Map();
        (this: Container<Port<mixed>>);
    }


    /**
     * Add a new port by name, throw an error if the port already exists.
     */
    add(port: Port<mixed>): void {
        if (port instanceof InputPort && !this.inputs.has(port.name)) {
            port.parent = this;
            this.inputs.set(port.name, port);
        } 
        else if (port instanceof OutputPort && !this.outputs.has(port.name)) {
            port.parent = this;
            this.outputs.set(port.name, port);
        } else {
            throw "Port or parameter with name `" + port.getFullyQualifiedName() 
            + "` already exists. `"
        }
    }

    /**
     * Return the port associated to given name. If no such port exists, return null.
     */
    lookup(name: string): ?Port<mixed> {
        var port = this.inputs.get(name);
        if (port != null) {
            return port;
        } else {
            return this.outputs.get(name);
        }
    }

    getAll(): Array<mixed> {
        return Array.from(this.inputs.values()).concat(Array.from(this.outputs.values()));
    }

    getInputs(): Array<InputPort<mixed>> {
        return Array.from(this.inputs.values());
    }

    getOutputs(): Array<OutputPort<mixed>> {
        return Array.from(this.outputs.values());
    }

    /**
     * Remove a port by name, do nothing if the port does not exist.
     */
    remove(name: string): void {
        this.inputs.delete(name) && this.outputs.delete(name);
    }

    /**
     * Substitute an existing port.
     * @todo: How do we make sure that the substitution is safe?
     */
    substitute(port: Port<mixed>) {
        // Loop up the port.
        var current = this.lookup(port.name);
        // FIXME.
    }
}

// export class Relation implements Containable<Composite> {

// }

/**
 * A composite is a container for other components. A component can be
 * added to a composite, removed from it, or substituted by another
 * component. Two components within a composite can be connected to one
 * another via their ports.
 */
export class Composite extends Actor implements Container<Component|Port<mixed>> { //|Relation

    director: ?Director;
    components: Map<string, Component>;
    ports: Map<string, Component>;
    //relations: Map<Port<mixed>, Array<Port<mixed>>>;
    status: ExecutionStatus;

    constructor(name: string, parent?: ?Composite, director?: ?Director) {
        super(name);
        this.components = new Map();

        if (parent != null) {
            if (parent.contains(name)) {
                throw "A component with name '" + name + "' already exists in `" + parent.getFullyQualifiedName() + "`.";
            }
        } else {
            if (director == null) {
                throw "Top-level container must have a director.";
            }
        } 
        this.director = director;
        (this: Executable);
        (this: Container<Component|Port<mixed>>);
    }

    /**
     * Connects a source port to sink port.
     */
    connect(source: Port<mixed>, sink: Port<mixed>): void {

        var ssource = source.parent;
        var ssink = sink.parent;

        if (ssource == ssink) {
            throw "Cannot connect two ports from the same components."; // FIXME: maybe this should be allowed instead.
        }
        // The ports' parents are siblings.
        else if (ssource != null && ssink != null && ssource.parent == ssink.parent) {
            var parent = this.parent;
            if (parent != null) {
                parent.getDirector().connect(source, sink); // FIXME
            }

            // output -> input

        }
        // The source's component is a parent of the sink's component.
        else if (ssource != null && ssink != null && ssource == ssink.parent) {
            // input -> input

        }
        // The sink's component is a parent of the source's component.
        else if (ssource != null && ssink != null && ssink == ssource.parent) {
            // output -> output

        }
        // Source and sink cannot be connected.
        else {
            throw "Cannot connect port `" + source.name + "` to port `" + sink.name + "` because there is no direct path between them.";
        }
    }

    /**
     * Add a component to this composite. This operation also updates
     * the containment chain accordingly.
     */
    add(obj: Component|Port<mixed>) {
        if (obj instanceof InputPort || obj instanceof OutputPort) {
            super.add(obj);
            return;
        }
        if (obj instanceof Component) {
            // unlink
            if (obj.parent != null) {
                obj.parent.remove(obj.name);
            }
            if (this.components.get(obj.name) != null) {
                throw "Duplicate component " + obj.name 
                    + " in container " + this.name + "."
            } else {
                this.components.set(obj.name, obj);
                obj.parent = this;    
            }
        }
    }

    getAll(): Array<mixed> {
        return Array.from(this.inputs.values()).concat(Array.from(this.outputs.values()));
    }

    /**
     * Remove a component identified by the component name (string).
     */
    remove(name: string) {
        let component = this.components.get(name);
        if (component != undefined) {
            component.parent == null;
        }
        this.components.delete(name);
    }

    /**
     * Add an element to this container. If a component with the same name
     * already exists, replace it, and reconnect dangling wires to the new
     * component in the same configuration as they were attached to the replaced
     * component, to the extent possible. Wires formerly connected to a port
     * that is not available on the replacement component will be removed.
     * @todo: implement this
     */
    substitute(component: Component|Port<mixed>) {
        // add the component

        // reconnect wires
    }


    /** Return true if a component with a given name is a contained
      * in this container, return false otherwise.
      */
    contains(name: string): boolean { // FIXME: take namable object here!
        if (this.components.has(name)) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Return true if this container has its own director, false otherwise.
     */
    isOpaque(): boolean {
        return this.director != null;
    }

    /**
     * If this container is opaque, then return its director.
     * Otherwise, search up the containment hierarchy to find
     * the nearest director and return that.
     */
    getDirector(): Director {
        if (this.director != null) {
            return this.director;
        } else {
            return parent.getDirector();
        }
    }

    setDirector(director: Director): void {
        director.parent = this;
        this.director = director;
    }

    /**
      * List the opaque components that are directly or indirectly
      * contained by this container.
      */
    deepComponentList(): Array<Component> {
        return [];
    }

    /** List the components in this container. */
    componentList(): Array<Component>{
        return [];
    }
}
