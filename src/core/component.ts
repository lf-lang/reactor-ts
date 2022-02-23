import {Reactor, App, Runtime} from "./internal"

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

    /**
     * An optional alias for this component.
     */
    protected _alias: string | undefined;

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
    constructor(container: Reactor | null, alias?:string) {
        this._alias = alias

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
                throw Error("Cannot instantiate component without a parent.")
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
     * Report whether this component has been registed with its container or not.
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
     * Return the alias of this component, or an empty string if none was set.
     */
    public _getAlias(): string {
        if (this._alias) return this._alias
        else return ""
    }

    /**
     * Return a string that identifies this component.
     * The name is a path constructed as `[App]/[..]/[Container]/[This]`.
     */
    _getFullyQualifiedName(): string {
        var path = "";
        if (!(this instanceof App)) {
            path = this._container._getFullyQualifiedName();
        }
        if (path != "") {
            path += "/" + this._getName();
        } else {
            path = this._getName();
        }
        return path;
    }

    /**
     * Return a string that identifies this component within its container.
     */
    public _getName(): string {

        var name = ""
        if (!(this instanceof App)) {
            for (const [key, value] of Object.entries(this._container)) {
                if (value === this) {
                    name = `${key}`
                    break
                }
            }
        }

        if (this._alias) {
            if (name == "") {
                name = this._alias
            } else {
                name += ` (${this._alias})`
            }
        }
        // Return the constructor name in case the component wasn't found in
        // its container and doesn't have an alias.
        if (name == "") {
            name = this.constructor.name
        }
        
        return name
    }

    /**
     * Return the container of this component.
     */
    protected _getContainer(): Reactor {
        return this._container
    }

    /**
     * Set an alias to override the name assigned to this component by its
     * container.
     * @param alias An alternative name.
     */
    protected _setAlias(alias: string) {
        this._alias = alias
    }
}
