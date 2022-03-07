import {Reactor, App, Runtime, MultiPort, IOPort, Bank} from "./internal"

/**
 * Base class for named objects embedded in a hierarchy of reactors. Each
 * component can only be owned by a single reactor instance. All members of
 * this class are prefixed with an underscore to avoid name collisions with
 * ports, actions, timers, or reactor instances that may be part of the 
 * interface of a `Reactor`, which extends this class.
 * 
 * @author Marten Lohstroh (marten@berkeley.edu)
 */
export abstract class Component {

    public static pathSeparator = '.'

    /**
     * A symbol that identifies this component, and it also used to selectively
     * grant access to its privileged functions.
     */
    protected _key: Symbol = Symbol()

    /**
     * The container of this component. Each component is contained by a
     * reactor. Only instances of `App`, which denote top-level reactors,
     * are self-contained.
     */
    private _container: Reactor;

    /**
     * Create a new component and register it with the given container.
     * @param container The reactor that will contain the new component,
     * `null` if this is an instance of `App`, in which case the component
     * will be designated as its own container.
     * 
     * Note that each subclass implementation needs to call the method
     * `_linkToRuntimeObject` immediately after calling this super
     * constructor in order to establish a link with the runtime object.
     * @param alias An optional alias for the component.
     */
    constructor(container: Reactor | null) {

        if (container !== null) {
            // Register.
            container._register(this, this._key)
            // And set the container.
            this._container = container
        } else {
            if (this instanceof App) {
                // Apps are self-contained.
                this._container = this
            } else {
                throw new Error("Cannot instantiate component without a parent.")
            }
        }
    }

    /**
     * Store a reference to the given runtime object as a private class member.
     * @param runtime 
     */
    public abstract _receiveRuntimeObject(runtime: Runtime): void;

    /**
     * Request the container to pass down its runtime object to this component.
     * This function is to be called once and only once upon the construction
     * of an object that subclasses `Component`. If it is called more than once
     * a runtime error results.
     */
    protected _linkToRuntimeObject() {
        this._getContainer()._requestRuntimeObject(this)
    }

    /**
     * Report whether this component has been registered with its container or not.
     * In principle, all components should have a container, but at the time of
     * their construction there is a brief period where they are not. This is the
     * only moment that a component is allowed register with its container.
     */
    public _isRegistered(): boolean {
        return (this._getContainer() !== undefined)
    }

    /**
     * Confirm whether or not this component is contained by the given reactor.
     * @param reactor The presumptive container of this component.
     */
    public _isContainedBy(reactor: Reactor): boolean {

        if (this instanceof App) return false
        else if (this._container === reactor) return true
    
        return false
    }

    /**
     * Confirm whether or not this component is contained by the container of
     * the given reactor.
     * @param reactor The container presumptive container of the container of
     * this component.
     */
    public _isContainedByContainerOf(reactor: Reactor): boolean {
        if (this instanceof App) return false
        else if (this._container._isContainedBy(reactor)) return true;
    
        return false;
    }

    /**
     * Return a string that identifies this component.
     * The name is a path constructed as `[App]/[..]/[Container]/[This]`.
     */
    _getFullyQualifiedName(): string {        
        if (!(this instanceof App)) {
            return this._container._getFullyQualifiedName() + Component.pathSeparator + this._getName();
        } else {
            return this._getName()
        }
    }

    /**
     * Given a component and its container (the global object if the component
     * is an `App`), return the key of the entry that matches the component.
     * @param component a component of which the object is assumed to be its
     * container
     * @param object the assumed container of the component
     * @returns the key of the entry that matches the component
     */
    public static keyOfMatchingEntry(component: Component, object: Object) {
        for (const [key, value] of Object.entries(object)) {
            if (value === component) {
                return `${key}`
            }
        }
    }

    /**
     * Given a port and its containing reactor, return the key of the entry that matches
     * a multiport found in the reactor that matches the port.
     * @param port a port that is assumed to be a constituent of a multiport declared on
     * the given reactor
     * @param reactor a reactor that is assumed to have a multiport of which one of the 
     * constituents is the given port
     * @returns an identifier for the port based on its location in a matching multiport
     */
    public static keyOfMatchingMultiport(port: Component, reactor: Reactor) {
        for (const [key, value] of Object.entries(reactor)) {
            if (value instanceof MultiPort) {
                let channels = value.channels()
                for (let i=0; i < channels.length; i++) {
                    if (channels[i] === port) {
                        return `${key}[${i}]`
                    }
                }
            }
        }
    }

    public static keyOfMatchingBank(member: Component, reactor: Reactor) {
        for (const [key, value] of Object.entries(reactor)) {
            if (value instanceof Bank) {
                let members = value.all()
                for (let i=0; i < members.length; i++) {
                    if (members[i] === member) {
                        return `${key}[${i}]`
                    }
                }
            }
        }
    }

    /**
     * Return a string that identifies this component within its container.
     * If no such string was found, return the name of the constructor.
     */
    public _getName(): string {
        var name

        if (this instanceof App) {
            name = this._name
        } else {
            name = Component.keyOfMatchingEntry(this, this._container)
        }

        if (!name && this instanceof IOPort) {
            name = Component.keyOfMatchingMultiport(this, this._container)
        }

        if (!name && this instanceof Reactor) {
            name = Component.keyOfMatchingBank(this, this._container)
        }

        if (name) {
            return name
        } else {
            return this.constructor.name
        }
    }

    /**
     * Return the container of this component.
     */
    protected _getContainer(): Reactor {
        return this._container
    }
}
