// @flow

/**
 * @file Defines various classes and interfaces for accessor hierarchy.
 * @author Marten Lohstroh
 */

'use strict';

/** ES6 imports */
import type {Executable, Director, ExecutionStatus} from './director'

/** The available kinds of ports. */
export type PortType = "input" | "output" | "parameter" | "portparameter";

/** A hint to the host of whether this port should be made visible. */
// FIXME: should also affect the connectability of the port?
export type Visibility = "full" | "none" | "expert" | "notEditable";

/**
 * A Base class for named objects. One can get and set any nameable object's
 * name. NamedDescendant, Component are also nameable
 * classes. Composite is not (why?)
 */
export class Nameable { // FIXME: perhaps extend EventEmitter? Or let Component extend EventEmitter? Idea: probably the director should be an event emitter, not the other components.
    // Why EventEmitter?

    name: string;

    /** Instantiate an object and name it. */
    constructor(name: string) {
        this.name = name;
    }

    /** Get this object's name. */
    getName(): string {
        return this.name;
    }

    /** Set this object's name. */
    setName(name: string) {
        this.name = name;
    }

}

/**
 * A generic container that can contain anything that's nameable:
 * nameddescendant, component.
 *
 * A PortSet contains Port.
 * A Composite contains Component.
 *
 */
export interface Container<T: Nameable> {
    // What about using interface property instead of functions?
    // interface Container<T: Nameable> {
    //   components: Map<string, T>;
    // }

    // What about Container<T, E: Containable<T>>?
    //
    // Ideally, we would have Container<Containable<T>>, but
    // higher-kinded polymorphism is not supported by Flow at this time.
    // Instead we use an extra level of containment -- ports are be
    // contained in a PortSet -- yet ports are linked directly to their
    // parent component via the Descendant interface, bypassing this
    // extra level of containment when looking up the descendant chain.
    // This means that the descendant chain may skip links of the
    // containment chain.

    /** Add an element to this container. */
    add(element: T): void;

    /** Remove an element from this container. */
    remove(name: string): void;

    /**
     * Add an element to this container. If a component with the same name
     * already exists, replace it, and reconnect dangling wires to the new
     * component in the same configuration as they were attached to the
     * replaced component, to the extend possible. Wires formerly connected
     * to a port that is not available on the replacement component will
     * be removed.
     *
     * NOTE: this is where types will need to come in.
     * NOTE: the mutable accessor will have to extend this by adding wires in case extra ports are available.
     */
    substitute(element: T): void;

     /**
      * List the opaque components that are directly or indirectly
      * contained by this container.
      */
    //deepComponentList(): Array<T>;

    /** List the components in this container. */
    //componentList(): Array<T>; // FIXME: this should not be part of this interface, it should be part of composite

    // note: PERHAPS have a get containers function and

}

/**
 * Interface that specifies hierarchical relations between objects.
 *
 * A Port is a Descendant of Component.
 * A PortSet is a Descendant of Component.
 * A Composite is a Descendant of another Composite
 */
export interface Descendant<T> {
    setParent(parent: ?T): void;
    getParent(): ?T;
    getFullyQualifiedName(): string;
}

// What about using interface property instead of functions?
// This is already the case for Component...
// interface Descendant {
//   parent: ?T;
// }


/**
 * A descendant that has a name. Its fully qualified name is prefixed by the
 * fully qualified name of its parent in the descendant chain.
 */
export class NamedDescendant<T> extends Nameable implements Descendant<T> { // FIXME: rename!
    parent: ?T;

    constructor(name: string) {
        super(name);
    }

    getFullyQualifiedName(): string { // check for null
        var name = "";
        if (parent != null) {
            // @todo: parent should also implement Descendant? Need generic
            // bounds.
            name = parent.getFullyQualifiedName();
        }
        return name + "." + this.getName();
    }

    setParent(parent: ?T) {
        this.parent = parent;
    }

    getParent(): ?T {
        return this.parent;
    }
}


/**
 * A FIFO queue with some meta data that represents a port.
 */
export class Port extends NamedDescendant<Component> {
    queue: Array<any>;
    portType: PortType;

    // What about using generics Port<T>
    // this.queue is Array<T>
    // And when we connect two ports, their types have to be matched (or the
    // output port's type is a subtype of the subsequent input port's type)?
    dataType: ?string; // FIXME: use a proper type here.

    // What is port options?
    options: ?Object;

    visibility: ?Visibility;

    constructor(name: string, portType: PortType, dataType?: ?string,
        value?: ?any, options?: ?Object, visibility?: ?Visibility) {
        super(name);
        this.portType = portType;
        this.dataType = dataType;
        this.options = options;
        if (value != null) {
            this.queue.push(value);
        }
        this.options = options;
        this.visibility = visibility;
    }

    getPortType(): PortType {
        return this.portType;
    }
    getDataType(): ?string {
        return this.dataType;
    }

    push(value: any): void {
        // Why isn't parameter a separate type?
        if (this.portType == "parameter") {
            this.queue[0] = value;
        } else {
            this.queue.push(value);
        }
    }

    // What happens to parameter? Read once only?
    // If nothing inside the port, returns undefined?
    pop(): any {
        return this.queue.shift();
    }

    reset(): void {
        this.queue = [];
    }

    // If nothing inside the port, returns undefined?
    peek(): any {
        return this.queue[0];
    }

    getOptions(): ?Object {
        return this.options;
    }

}


/**
 * A component has a name and is containable by a Composite.
 */
export class Component extends Nameable implements Descendant<Composite> {

    parent: ?Composite;

    constructor (name: string, parent?: ?Composite):void {
        super(name);
        this.parent = parent;
    }

    getFullyQualifiedName(): string {
        var prefix = "";
        if (this.parent != null) {
            prefix = this.parent.getFullyQualifiedName();
        }

        if (prefix != "") {
            return prefix + "." + this.getName();
        } else {
            return this.getName();
        }
    }

    getParent(): ?Composite {
        return this.parent;
    }

    setParent(parent: ?Composite) {
        this.parent = parent;
    }
}

/**
 * A collection of ports. No duplicate names are allowed.
 */
export class PortSet extends NamedDescendant<Component> implements Container<Port> {

    members: Map<string, Port>;

    constructor(parent: Component) {
        super("ports");
        this.parent = parent;
        this.members = new Map();
    }

    add(port: Port) {
        if (!this.members.has(port.getName())) {
            // NOTE: skipping this  container in the descendent chain.
            port.setParent(this.parent);
            this.members.set(port.getName(), port);
        } else {
            throw "Port or parameter with name `"
                + "` is already defined for component `"
                + this.getFullyQualifiedName() + "`.";
        }
    }

    get(name: string): ?Port {
        return this.members.get(name);
    }

    remove(name: string) {
        this.members.delete(name);
    }

    substitute(port: Port) {
        // NOTE: skipping this container in the descendent chain.
        port.setParent(this.parent);
        this.members.set(port.getName(), port);
    }

 }


/**
 * A composite is a container for other components. A component can be
 * added to a composite, removed from it, or substituted by another
 * component. Two components within a composite can be connected to one
 * another via their ports.
 */
export class Composite extends Component implements Executable, Container<Component>, Descendant<Composite> {

    director: ?Director;
    inputs: Container<Port>
    outputs: Container<Port>
    components: Map<string, Component>;
    status: ExecutionStatus;

    constructor(name: string, parent?: ?Composite, director?: ?Director) {
        //(this: Executable);

        if (parent != null) {
            if (parent.contains(name)) {
                throw "A component with name '" + name + "' already exists in `" + parent.getFullyQualifiedName() + "`.";
            }
        } else {
            if (director == null) {
                throw "Top-level container must have a director.";
            }
        }
        super(name, parent);

        this.director = director;

    }

    /** List the components in this container. */
    // componentList(): Array<Component> {
    //     return Array.from(this.components.values());
    // }

    /**
     *
     */
    // @todo: this can be a stand alone function because it does not need to
    // access this.
    connect(source: Port, sink: Port): void {

        var ssource = source.getParent();
        var ssink = sink.getParent();

        if (ssource == ssink) {
            throw "Cannot connect two ports from the same components."; // FIXME: maybe this should be allowed instead.
        }
        // The ports' parents are siblings.
        else if (ssource != null && ssink != null && ssource.getParent() == ssink.getParent()) {
            var parent = this.getParent();
            if (parent != null) {
                parent.getDirector().connect(source, sink); // FIXME
            }

            // output -> input

        }
        // The source's component is a parent of the sink's component.
        else if (ssource != null && ssink != null && ssource == ssink.getParent()) {
            // input -> input

        }
        // The sink's component is a parent of the source's component.
        else if (ssource != null && ssink != null && ssink == ssource.getParent()) {
            // output -> output

        }
        // Source and sink cannot be connected.
        else {
            throw "Cannot connect port `" + source.getName() + "` to port `" + sink.getName() + "` because there is no direct path between them.";
        }

    }

    /**
      * List the opaque components that are directly or indirectly
      * contained by this container.
      */
    // deepComponentList(): Array<Component> {
    //     var arr: Array<Component> = this.componentList();
    //     for (var component of this.componentList) {
    //         // FIXME: expect a type error here, need to check for instanceof??
    //         arr.concat(component.deepComponentList());
    //     }
    //     return arr;
    // }


    /**
     * Add a component to this composite. This operation also updates
     * the descendant chain accordingly.
     */
    add(component: Component) {
        this.components.set(component.getName(), component);

        // Wouldn't `component.setParent(this)` be enough?
        var parent = component.getParent;
        if (parent != null) {
            parent.remove(component);
        }
        component.setParent(this);
    }

    /**
     *
     */
    remove(name: string) {
        // disconnect wires

        // remove the component
    }

    substitute(component: Component | Port) {
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

    getStatus(): ExecutionStatus {
        return this.status;
    }

    setStatus(status: ExecutionStatus) {
        this.status = status;
    }

    setup() {

    }

    setDirector(director: Director): void {
        director.setParent(this);
        this.director = director;
    }

    initialize() {

    }
    fire() {}
    postfire() {}
    wrapup() {}
}
