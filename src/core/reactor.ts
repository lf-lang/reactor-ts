/**
 * Core of the reactor runtime.
 * 
 * @author Marten Lohstroh (marten@berkeley.edu),
 * @author Matt Weber (matt.weber@berkeley.edu)
 */

import {PrecedenceGraphNode, PrioritySetNode, PrioritySet, PrecedenceGraph, Log} from './util';
import {TimeValue, TimeUnit, Tag, Origin, getCurrentPhysicalTime, UnitBasedTimeValue, Alarm } from './time';

// Set the default log level.
Log.global.level = Log.levels.ERROR;

//--------------------------------------------------------------------------//
// Types                                                                    //
//--------------------------------------------------------------------------//

/**
 * Type that denotes the absence of a value.
 * @see Variable
 */
export type Absent = undefined;

/**
 * Conditional type for argument lists of reactions. If the type variable
 * `T` is inferred to be a subtype of `Variable[]` it will yield `T`; it  
 * will yield `never` if `T` is not a subtype of `Variable[]`.
 * @see Reaction
 */
export type ArgList<T> = T extends Variable[] ? T : never;

/**
 * Type for data exchanged between ports.
 */
export type Present = (number | string | boolean | symbol | object | null);

/**
 * A number that indicates a reaction's position with respect to other
 * reactions in an acyclic precendence graph.
 * @see ReactionQueue
 */
export type Priority = number;

/**
 * Type for simple variables that are both readable and writable.
 */
export type ReadWrite<T> = Read<T> & Write<T>;

/**
 * A variable is a port, action, or timer (all of which implement the interface
 * `Read`). Its value is therefore readable using `get`, and may be writable
 * using `set`. When `isPresent` is called on a variable, it will return true if
 * the value is defined at the current logical time, and false otherwise.
 * Variables may also refer to ports of a contained reactors. To allow a dotted
 * style of port referencing that is common in Lingua Franca, hierarchical
 * references may be represented by an object of which the own properties have
 * keys that denote the names of the referenced ports. For example, we could
 * write `Foo.bar`, where `Foo` is the name of a contained reactor and `bar` the
 * name of the referenced port. In this case, `Foo` would be the name of the
 * argument passed into a `react` function, and the type of that argument would
 * be `{bar: Read<T>|Write<T>|ReadWrite<T>}`.
 * @see Read
 * @see Write
 */
export type Variable = Read<unknown> |
    Write<unknown> | ReadWrite<unknown> |
{
    [name: string]: (Read<unknown>
        | Write<unknown> | ReadWrite<unknown>)
};

//--------------------------------------------------------------------------//
// Constants                                                                //
//--------------------------------------------------------------------------//

const defaultMIT = new UnitBasedTimeValue(1, TimeUnit.nsec);

//--------------------------------------------------------------------------//
// Interfaces                                                               //
//--------------------------------------------------------------------------//

/**
 * Interface for the invocation of remote procedures.
 */
export interface Call<A, R> extends Write<A>, Read<R> {
    invoke(args: A): R | undefined;
}

/**
 * Interface for objects that have a name.
 */
export interface Named {
    
    /* An alternative name for this object */
    alias: string | undefined;

    /* Return the fully qualified name of this object. */
    getFullyQualifiedName(): string;

    /* Get the name of this object. */
    getName(): string;

}

// /**
//  * Interface for proxy objects used to make ports writable.
//  */
// export interface Proxy<T extends Present> extends Write<T> {
//     isProxyOf: (port: IOPort<any>) => boolean;
//     getPort(): IOPort<T>;
// }

/**
 * Interface for readable variables.
 */
export interface Read<T> {
    get: () => T | Absent;
}

/**
 * Interface for schedulable actions.
 */
export interface Schedule<T extends Present> extends Read<T> {
    schedule: (extraDelay: TimeValue | 0, value: T) => void;
}

/**
 * Interface for writable ports.
 */
export interface Write<T> {
    set: (value: T) => void;
}

export abstract class WritablePort<T extends Present> implements ReadWrite<T> {
    abstract get(): T | undefined;
    abstract set(value: T): void;
    abstract getPort(): Port<T>
}

export abstract class SchedulableAction<T extends Present> implements Schedule<T> {
    abstract schedule(extraDelay: 0 | TimeValue, value: T): void;
    abstract get(): T | undefined; // FIXME: not convinced this should be here.
}

//--------------------------------------------------------------------------//
// Core Reactor Classes                                                     //
//--------------------------------------------------------------------------//

/**
 * Base class for named objects that acquire their name on the basis of the
 * hierarchy they are embedded in. Each component can only be associated with a
 * single reactor instance.
 */
class Component implements Named {

    /**
     * An optional alias for this component.
     */
    public alias: string | undefined;

    constructor(protected __container__: Reactor | null, alias?:string) {
        this.alias = alias
    }

    public isChildOf(r: Reactor): boolean {
        if (this.__container__ && this.__container__ === r) {
            return true;
        }
        return false;
    }

    public isGrandChildOf(r: Reactor): boolean {
        if (this.__container__ && this.__container__.isChildOf(r)) {
            return true;
        }
        return false;
    }

    public getContainer(): Reactor | null {
        return this.__container__
    }

    /**
     * Return a string that identifies this component.
     * The name is a path constructed as App/.../Container/ThisComponent
     */
    getFullyQualifiedName(): string {
        var path = "";
        if (this.__container__ != null) {
            path = this.__container__.getFullyQualifiedName();
        }
        if (path != "") {
            path += "/" + this.getName();
        } else {
            path = this.getName();
        }
        return path;
    }

    /**
     * Return a string that identifies this component within the reactor.
     */
    public getName(): string {
        if (this.alias) {
            return this.alias;
        } else if (this.__container__) {
            for (const [key, value] of Object.entries(this.__container__)) {
                if (value === this) {
                    return `${key}`;
                }
            }
        }
        // Return the constructor name in case the component wasn't found in its
        // container.
        return this.constructor.name;
    }

    /**
     * Set an alias to override the name assigned to this component by its
     * container.
     * @param alias An alternative name.
     */
    protected setAlias(alias: string) {
        this.alias = alias
    }
}


/**
 * Generic base class for reactions. The type parameter `T` denotes the type of
 * the argument list of the `react` function that that is applied to when this
 * reaction gets triggered.
 */
export class Reaction<T> implements PrecedenceGraphNode<Priority>, PrioritySetNode<Priority> {

    /** 
     * Priority derived from this reaction's location in 
     * the directed acyclic precedence graph.
     */
    public priority: Priority = Number.MAX_SAFE_INTEGER;

    public next: PrioritySetNode<Priority> | undefined;

    /** 
     * Construct a new reaction by passing in a reference to the reactor that contains it,
     * the variables that trigger it, and the arguments passed to the react function.
     * @param state state shared among reactions
     */
    constructor(
        private reactor: Reactor,
        private sandbox: ReactionSandbox,
        readonly trigs: Triggers,
        readonly args: Args<ArgList<T>>,
        private react: (...args: ArgList<T>) => void,
        private deadline?: TimeValue,
        private late: (...args: ArgList<T>) => void = () => 
            { Log.global.warn("Deadline violation occurred!") }) {
    }

    public active = false

    public toString(): string {
        return this.reactor.getFullyQualifiedName() + "[R" + this.reactor.getReactionIndex(this) + "]";
    }

    getDependencies(): [Set<Variable>, Set<Variable>] {
        var deps: Set<Variable> = new Set();
        var antideps: Set<Variable> = new Set();
        var vars = new Set();
        for (let a of this.args.tuple.concat(this.trigs.list)) {
            if (a instanceof IOPort) {
                if (this.reactor._isUpstream(a)) {
                    deps.add(a);
                }
                if (this.reactor._isDownstream(a)) {
                    antideps.add(a);
                }
            } else if (a instanceof WritablePort) { // FIXME: how to figure out whether this thing is writable???
                if (this.reactor._isDownstream(a.getPort())) {
                    antideps.add(a.getPort());
                }
            } else {
                // Handle hierarchical references.
                for (let p of Object.getOwnPropertyNames(a)) {
                    let prop = Object.getOwnPropertyDescriptor(a, p);
                    if (prop?.value instanceof Port) {
                        if (this.reactor._isUpstream(prop.value)) {
                            deps.add(prop.value);
                        }
                        if (this.reactor._isDownstream(prop.value)) {
                            antideps.add(prop.value);
                        }
                    }
                }
            }
        }
        return [deps, antideps];
    }

    getPriority(): Priority {
        return this.priority;
    }

    hasPriorityOver(node: PrioritySetNode<Priority> | undefined): boolean {
        if (node != null && this.getPriority() < node.getPriority()) {
            return true;
        } else {
            return false;
        }
    }

    updateIfDuplicateOf(node: PrioritySetNode<Priority> | undefined) {
        return Object.is(this, node);
    }

    public doReact() {

        Log.debug(this, () => ">>> Reacting >>> " + this.constructor.name + " >>> " + this.toString());
        Log.debug(this, () => "Reaction deadline: " + this.deadline);

        // If this reaction was loaded onto the reaction queue but subsequently
        // removed/deactivated by a mutation, then return without invoking the
        // reaction.
        if (!this.active) {
            return
        }
        // Test if this reaction has a deadline which has been violated.
        // This is the case if the reaction has a defined timeout and
        // logical time + timeout < physical time
        if (this.deadline &&
            this.sandbox.util.getCurrentTag()
                .getLaterTag(this.deadline)
                .isSmallerThan(new Tag(getCurrentPhysicalTime(), 0))) {
            this.late.apply(this.sandbox, this.args.tuple);
        } else {
            this.react.apply(this.sandbox, this.args.tuple); // on time
        }
    }

    /**
     * Set a deadline for this reaction. The given time value denotes the maximum
     * allowable amount by which logical time may lag behind physical time at the
     * point that this reaction is ready to execute. If this maximum lag is
     * exceeded, the "late" function is executed instead of the "react" function.
     * @param deadline The deadline to set to this reaction.
     */
    /* FIXME: Unused function */
    setDeadline(deadline: TimeValue): this {
        this.deadline = deadline;
        return this;
    }

    /**
     * Setter for reaction priority, to be used only by the runtime environment.
     * The priority of each reaction is determined on the basis of its
     * dependencies on other reactions.
     * @param priority The priority for this reaction.
     */
    public setPriority(priority: number) {
        this.priority = priority;
    }
}

/**
 * An event is caused by a timer or a scheduled action. Each event is tagged
 * with a time instant and may carry a value of arbitrary type. The tag will
 * determine the event's position with respect to other events in the event
 * queue.
 */
class TaggedEvent<T extends Present> implements PrioritySetNode<Tag> {

    public next: PrioritySetNode<Tag> | undefined;

    /**
     * Construct a new event.
     * @param trigger The trigger of this event.
     * @param tag The tag at which this event occurs.
     * @param value The value associated with this event. 
     * 
     */
    constructor(public trigger: ScheduledTrigger<T>, public tag: Tag, public value: T) {
    }

    /**
     * Return true if this event has a smaller tag than the given event, false
     * otherwise.
     * @param node The event to compare this event's tag against.
     */
    hasPriorityOver(node: PrioritySetNode<Tag> | undefined) {
        if (node) {
            return this.getPriority().isSmallerThan(node.getPriority());
        } else {
            return false;
        }
    }

    /**
     * Determine whether the given event is a duplicate of this one. If so, assign the
     * value this event to the given one. Otherwise, return false.
     * @param node The event adopt the value from if it is a duplicate of this one.
     */
    updateIfDuplicateOf(node: PrioritySetNode<Tag> | undefined) {
        if (node && node instanceof TaggedEvent) {
            if (this.trigger === node.trigger && this.tag.isSimultaneousWith(node.tag)) {
                node.value = this.value; // update the value
                return true;
            }
        }
        return false;
    }

    /**
     * Return the tag associated with this event.
     */
    getPriority(): Tag {
        return this.tag;
    }
}
abstract class Trigger extends Component {

    protected reactions: Set<Reaction<unknown>> = new Set();

    abstract getManager(container: Reactor): TriggerManager;

}

abstract class ScheduledTrigger<T extends Present> extends Trigger {
    protected value: T | Absent = undefined;
    protected tag: Tag | undefined;

    public update(e: TaggedEvent<T>, trigger: (r: Reaction<unknown>) => void):void {

        if (!e.tag.isSimultaneousWith(this.__container__.util.getCurrentTag())) {
            throw new Error("Time of event does not match current logical time.");
        }
        if (e.trigger === this) {
            this.value = e.value
            this.tag = e.tag;
            //this.__container__._triggerReactions(e);
            for (let r of this.reactions) {
                trigger(r)
            }
        } else {
            throw new Error("Attempt to update action using incompatible event.");
        }
    }

    public getManager(container: Reactor): TriggerManager {
        if (this.__container__ === container) {
            return this.manager
        }
        throw Error("Invalid reference to container.")
    }

    /**
     * Returns true if this action was scheduled for the current
     * logical time. This result is not affected by whether it
     * has a value.
     */
    public isPresent() {
        if (this.tag === undefined) {
            // This action has never been scheduled before.
            return false;
        }
        if (this.tag.isSimultaneousWith(this.__container__.util.getCurrentTag())) {
            return true;
        } else {
            return false;
        }
    }

    protected manager = new class implements TriggerManager {
        constructor(private trigger: ScheduledTrigger<T>) { }
        addReaction(reaction: Reaction<unknown>): void {
            this.trigger.reactions.add(reaction)
        }
        delReaction(reaction: Reaction<unknown>): void {
            this.trigger.reactions.delete(reaction)
        }
    }(this)

    constructor(protected __container__: Reactor) {
        super(__container__)
    }
}

/**
 * An action denotes a self-scheduled event.
 * An action, like an input, can cause reactions to be invoked.
 * Whereas inputs are provided by other reactors, actions are scheduled
 * by this reactor itself, either in response to some observed external
 * event or as a delayed response to some input event. The action can be
 * scheduled by a reactor by invoking the schedule function in a reaction
 * or in an asynchronous callback that has been set up in a reaction.
 */
export class Action<T extends Present> extends ScheduledTrigger<T> implements Read<T> {

    readonly origin: Origin;
    readonly minDelay: TimeValue;
    readonly minInterArrival: TimeValue = defaultMIT;
    
    public get(): T | Absent {
        if (this.isPresent()) {
            return this.value;
        } else {
            return undefined;
        }
    }

    public getScheduler(container: Reactor): Schedule<T> {
        if (this.__container__ === container) {
            return this.scheduler
        }
        throw Error("Invalid reference to container.")
    }

    public getManager(container: Reactor): TriggerManager {
        if (this.__container__ === container) {
            return this.manager
        }
        throw Error("Invalid reference to container.")
    }

    protected scheduler = new class extends SchedulableAction<T> {
        constructor(private action: Action<T>) {
            super()
        }
        schedule(extraDelay: 0 | TimeValue, value: T): void {
            if (!(extraDelay instanceof TimeValue)) {
                extraDelay = new TimeValue(0);
            }
            
            var tag = this.action.__container__.util.getCurrentTag();
            var delay = this.action.minDelay.add(extraDelay);

            if (this.action.origin == Origin.physical) {
                tag = new Tag(getCurrentPhysicalTime(), 0);
            }
    
            tag = tag.getLaterTag(delay);
    
            if (this.action.origin == Origin.logical && !(this.action instanceof Startup)) {
                tag = tag.getMicroStepLater();
            }
            
            Log.debug(this, () => "Scheduling " + this.action.origin +
                " action " + this.action.getFullyQualifiedName() + " with tag: " + tag);
    
            this.action.__container__.util.schedule(new TaggedEvent(this.action, tag, value));
        }
        
        get(): T | undefined {
            return this.action.get()
        }

    }(this)

    /** 
     * Construct a new action.
     * @param __container__ The reactor containing this action.
     * @param origin Optional. If physical, then the hardware clock on the local 
     * platform is used to determine the tag of the resulting event. If logical, 
     * the current logical time (plus one microstep) is used as the offset.
     * @param minDelay Optional. Defaults to 0. Specifies the intrinsic delay of
     * any events resulting from scheduling this action.
     * @param minInterArrival Optional. Defaults to 1 nsec. Specifies the minimum
     * intrinsic delay between to occurrences of this action.
     */
    constructor(protected __container__: Reactor, origin: Origin, minDelay: TimeValue = new TimeValue(0), minInterArrival: TimeValue = defaultMIT) {
        super(__container__);
        this.origin = origin;
        this.minDelay = minDelay;
    }

    public toString() {
        return this.getFullyQualifiedName();
    }
}

export class Startup extends Action<Present> {
    constructor(__parent__: Reactor) {
        super(__parent__, Origin.logical)
    }
}

export class Shutdown extends Action<Present> {
    constructor(__parent__: Reactor) {
        super(__parent__, Origin.logical)
    }
}

export class Parameter<T> implements Read<T> {
    constructor(private value: T) {
    }
    get(): T {
        return this.value;
    }
}

/**
 * A state variable. This class refines the Read interface by letting `get`
 * return T rather than T | Absent. If the state should be nullable or
 * uninitialized, this has to be reflected explicitly in T.
 */
export class State<T> implements Read<T>, Write<T> {
    
    /**
     * Create a new state variable and assign it an initial value.
     * @param value The initial value to assign to this state variable.
     */
    constructor(private value: T) {
    
    }

    /**
     * Return the current value of this state variable.
     */
    get(): T {
        return this.value;
    };

    /**
     * Set the current value of this state variable.
     * @param value 
     */
    set(value: T) {
        this.value = value;
    };

}

/**
 * A timer is an attribute of a reactor which periodically (or just once)
 * creates a timer event. A timer has an offset and a period. Upon initialization
 * the timer will schedule an event at the given offset from starting wall clock time.
 * Whenever this timer's event comes off the event queue, it will 
 * reschedule the event at the current logical time + period in the future. A 0 
 * period indicates the timer's event is a one-off and should not be rescheduled.
 */
export class Timer extends ScheduledTrigger<Tag> implements Read<Tag> {

    period: TimeValue;
    offset: TimeValue;

    /**
     * Timer constructor. 
     * @param __container__ The reactor this timer is attached to.
     * @param offset The interval between the start of execution and the first
     * timer event. Cannot be negative.
     * @param period The interval between rescheduled timer events. If 0, will
     * not reschedule. Cannot be negative.
     */
    constructor(protected __container__: Reactor, offset: TimeValue | 0, period: TimeValue | 0) {
        super(__container__);
        if (!(offset instanceof TimeValue)) {
            this.offset = new TimeValue(0);
        } else {
            this.offset = offset;
        }

        if (!(period instanceof TimeValue)) {
            this.period = new TimeValue(0);
        } else {
            this.period = period;
        }
    }

    /**
     * Update the current value of this timer in accordance with the given
     * event, and trigger any reactions that list this timer as their trigger.
     * @param e Timestamped event.
     */
    // public update(e: TaggedEvent<Present>, trigger: (r: Reaction<unknown>) => void) {
    //     if (!e.tag.isSimultaneousWith(this.__container__.util.getCurrentTag())) {
    //         throw new Error("Time of event does not match current logical time.");
    //     }
        
    //     if (e.trigger === this) {
    //         this.tag = e.tag;
    //         //this.__container__._triggerReactions(e);
    //         for (let r of this.reactions) {
    //             trigger(r)
    //         }
    //     }
    // }

    public toString() {
        return "Timer from " + this.__container__.getFullyQualifiedName() + " with period: " + this.period + " offset: " + this.offset;
    }

    public get(): Tag | Absent {
        if (this.isPresent()) {
            return this.tag;
        } else {
            return undefined;
        }
    }
}

class Procedure<T> extends Reaction<T> {

}

export class Mutation<T> extends Reaction<T> {

    readonly parent: Reactor;

    constructor(
        __parent__: Reactor,
        sandbox: MutationSandbox,
        trigs: Triggers,
        args: Args<ArgList<T>>,
        react: (...args: ArgList<T>) => void,
        deadline?: TimeValue,
        late?: (...args: ArgList<T>) => void) {
        super(__parent__, sandbox, trigs, args, react, deadline, late);
        this.parent = __parent__;
    }

    /**
     * @override
     */
    public toString(): string {
        return this.parent.getFullyQualifiedName() + "[M" + this.parent.getReactionIndex(this) + "]";
    }
    
}

export class Args<T extends Variable[]> {
    tuple: T;
    constructor(...args: T) {
        this.tuple = args;
    }
}

export class Triggers {
    list: Variable[];
    constructor(trigger: Variable, ...triggers: Variable[]) {
        this.list = triggers.concat(trigger)
    }
}

/**
 * A reactor is a software component that reacts to input events, timer events,
 * and action events. It has private state variables that are not visible to any
 * other reactor. Its reactions can consist of altering its own state, sending
 * messages to other reactors, or affecting the environment through some kind of
 * actuation or side effect.
 */
export abstract class Reactor extends Component {

    /**
     * Indicates whether this reactor is active (meaning it has reacted to a
     * startup action), or not (in which case it either never started up or has
     * reacted to a shutdown action).
     */
    private _active = false;

    /**
     * The top-level reactor that this reactor is contained in.
     */
    private _app: App;

    /**
     * Maps ports to upstream reactions that they depend on.
     */
    private _dependsOnReactions: Map<Port<Present>, Set<Reaction<unknown>>> = new Map();

    /**
     * Maps ports to downstream reactions that depend on them. FIXME: FWD: to be subsumed by reactions in Port.
     */
    private _dependentReactions: Map<Port<Present>, Set<Reaction<unknown>>> = new Map();

    /**
     * Maps ports to downstream ports to which they are connected. FIXME: FWD: To be subsumed by receivers in Port.
     */
    private _destinationPorts: Map<Port<Present>, Set<Port<Present>>> = new Map();

    /**
     * This reactor's shutdown action.
     */
    readonly shutdown = new Shutdown(this);

    /**
     * Maps ports to an upstream port that it is connected to.
     */
    private _sourcePort: Map<Port<Present>, Port<Present>> = new Map();

    /**
     * This reactor's startup action.
     */
    readonly startup = new Startup(this);

    /**
     * Maps a callee port to upstream reactions that may invoke the reaction it triggers.
     */
    private _remoteCallers: Map<CalleePort<Present, Present>, Set<Reaction<unknown>>> = new Map();

    /**
     * The list of reactions this reactor has.
     */
    private _reactions: Reaction<any>[] = [];

    /**
     * Sandbox for the execution of reactions.
     */
    private _reactionScope: ReactionSandbox;

    /** 
     * The list of mutations this reactor has.
     */
    private _mutations: Mutation<any>[] = [];

    /**
     * Sandbox for the execution of mutations.
     */
    private _mutationScope: MutationSandbox;

    private keys: Map<Component, Symbol> = new Map()

    public register(component: Component, key: Symbol) {
        if (!this.keys.has(component)) this.keys.set(component, key)
    }

    public borrow(component: Component, container:Reactor): Symbol | undefined {
        let key = this.keys.get(component)
        if (this.isChildOf(container)) {
            return key
        }
    }

    /**
     * Collection of utility functions for this app.
     */
    public util: AppUtils;

    /**
     * Inner class intended to provide access to methods that should be
     * accessible to mutations, not to reactions.
     */
    private _MutationSandbox = class implements MutationSandbox { 
        constructor(private reactor: Reactor) {}
        
        public util = this.reactor.util
        
        public connect<A extends T, R extends Present, T extends Present, S extends R>
                (src: CallerPort<A,R> | IOPort<S>, dst: CalleePort<T,S> | IOPort<R>) {
            return this.reactor._connect(src, dst);
        }
    };
    
    /**
     * Inner class that furnishes an execution environment for reactions.  
     */
    private _ReactionSandbox = class implements ReactionSandbox {
        public util: AppUtils;
        constructor(public reactor: Reactor) {
            this.util = reactor.util
        }
    }

    /**
     * Create a new reactor.
     * @param __parent__ The container of this reactor.
     */
    constructor(__parent__: Reactor | null) {
        super(__parent__);
        if (__parent__ != null) {
            this._app = __parent__._app;
        } else {
            if (this instanceof App) {
                this._app = this;
            } else {
                throw new Error("Cannot instantiate reactor without a parent.");
            }
        }

        // Even though TypeScript doesn't catch it, the following statement
        // will assign `undefined` if the this is an instance of App.
        this.util = this._app.util;
        this._reactionScope = new this._ReactionSandbox(this)
        this._mutationScope = new this._MutationSandbox(this)
        // NOTE: beware, if this is an instance of App, `this.util` will be `undefined`.
        // Do not attempt to reference it during the construction of an App.
        var self = this
        // Add default startup reaction.
        this.addMutation(
            new Triggers(this.startup),
            new Args(),
            function (this) {
                Log.debug(this, () => "*** Starting up reactor " +
                self.getFullyQualifiedName());
                self._startupChildren();
                self._setTimers();
                self._active = true;
            }
        );
        
        // Add default shutdown reaction.
        this.addMutation(
            new Triggers(this.shutdown),
            new Args(),
            function (this) {
                Log.debug(this, () => "*** Shutting down reactor " + 
                    self.getFullyQualifiedName());

                // if (this.reactor instanceof App) {
                //     //this.reactor._shutdownStarted = true;
                //     //this.reactor._cancelNext();
                // }
                self._shutdownChildren();
                self._unsetTimers();
                self._active = false;
            }
        );
        
    }

    protected _initializeReactionScope(): void {
        this._reactionScope = new this._ReactionSandbox(this)
    }

    protected _initializeMutationScope(): void {
        this._mutationScope = new this._MutationSandbox(this)
    }
    
    protected _isActive(): boolean {
        return this._active
    }


    protected getWriter<T extends Present>(port: IOPort<T>): ReadWrite<T> {
        return port.asWritable(this.keys.get(port));
    }


    /**
     * Return the index of the reaction given as an argument.
     * @param reaction The reaction to return the index of.
     */
    public getReactionIndex(reaction: Reaction<any>): number {
        
        var index: number | undefined;

        if (reaction instanceof Mutation) {
            index = this._mutations.indexOf(reaction)
        } else {
            index = this._reactions.indexOf(reaction)
        }
        
        if (index !== undefined)
            return index

        throw new Error("Reaction is not listed.");
    }

    /**
     * Return the set of downstream ports that this reactor connects 
     * to the given port.
     * @param port The port to look up its destinations for.
     */
    public _getDestinations(port: Port<Present>): Set<Port<Present>> {
        if (this.__container__) {
            let dests = this.__container__._destinationPorts.get(port);
            if (dests) {
                return dests;
            }
        }
        return new Set();
    }

    /**
     * Return the upstream port that this reactor connects to the given port.
     * @param port The port to look up its source for.
     */
    public getSource(port: Port<Present>): Port<Present> | undefined {
        if (this.__container__) {
            return this.__container__._sourcePort.get(port);
        }
    }

    /**
     * Return the set of reactions within this reactor that are dependent on
     * the given port.
     * @param port The port to look up its depdendent reactions for.
     */
    public getDownstreamReactions(port: Port<Present>): Set<Reaction<unknown>> {
        var reactions = this._dependentReactions.get(port);
        if (reactions) {
            return reactions;
        } else {
            return new Set();
        }
    }

    /**
     * Return the set of reactions within this reactor that the given port 
     * depends on.
     * @param port The port to look up its depdendent reactions for.
     */
    public getUpstreamReactions(port: Port<Present>): Set<Reaction<unknown>> {
        var reactions = this._dependsOnReactions.get(port);
        if (reactions) {
            return reactions;
        } else {
            return new Set();
        }
    }


    protected getSchedulable<T extends Present>(action: Action<T>): Schedule<T> {
        return action.getScheduler(this);
    }

    private _recordDeps(reaction: Reaction<any>) {
        // Stick this reaction into the trigger map to ensure it gets triggered.
        for (let t of reaction.trigs.list) {
            // Link the trigger to the reaction.
            if (t instanceof Trigger) {
                t.getManager(this).addReaction(reaction)
            }

            // Record this trigger as a dependency.
            if (t instanceof IOPort || t instanceof CalleePort) {
                this._addDependency(t, reaction);
            } else {
                Log.debug(this, () => ">>>>>>>> not a dependency: " + t);
            }
        }
        for (let a of reaction.args.tuple) {
            if (a instanceof IOPort) {
                if (this._isUpstream(a)) {
                    this._addDependency(a, reaction);
                } else if (this._isDownstream(a)) {
                    this._addAntiDependency(a, reaction);
                } else {
                    throw new Error("Encountered argument that is neither a dependency nor an antidependency.");
                }
            }
            if (a instanceof CalleePort) {
                this._addDependency(a, reaction)
            }
            if (a instanceof CallerPort) {
                this._addAntiDependency(a, reaction)
            }
            // Only necessary if we want to add actions to the dependency graph.
            if (a instanceof Action) {
                // dep
            }
            if (a instanceof SchedulableAction) {
                // antidep
            }
            if (a instanceof WritablePort) {
                this._addAntiDependency(a.getPort(), reaction);
            }
        }
    }

    /**
     * Given a reaction, return the reaction within this reactor that directly
     * precedes it, or `undefined` if there is none.
     * @param reaction A reaction to find the predecessor of. 
     */
    protected prevReaction(reaction: Reaction<unknown>): Reaction<any> | undefined {
        var index: number | undefined
        
        if (reaction instanceof Mutation) {
            index = this._mutations.indexOf(reaction)
            if (index !== undefined && index > 0) {
                return this._mutations[index-1];
            }
        } else {
            index = this._reactions.indexOf(reaction)
            if (index !== undefined && index > 0) {
                return this._reactions[index-1];
            } else {
                let len = this._mutations.length
                if (len > 0) {
                    return this._mutations[len-1]
                }
            }
        }
    }

    /**
     * Given a reaction, return the reaction within this reactior that directly
     * succeeds it, or `undefined` if there is none.
     * @param reaction A reaction to find the successor of. 
     */
    protected nextReaction(reaction: Reaction<unknown>): Reaction<any> | undefined {
        var index: number | undefined
        
        if (reaction instanceof Mutation) {
            index = this._mutations.indexOf(reaction)
            if (index !== undefined && index < this._mutations.length-1) {
                return this._mutations[index+1];
            } else if (this._reactions.length > 0) {
                return this._reactions[0]
            }
        } else {
            index = this._reactions.indexOf(reaction)
            if (index !== undefined && index < this._reactions.length-1) {
                return this._reactions[index+1];
            }
        }
    }

    /**
     * Add a reaction to this reactor. Each newly added reaction will acquire a
     * dependency either on the previously added reaction, or on the last added
     * mutation (in case no reactions had been added prior to this one). A
     * reaction is specified by a list of triggers, a list of arguments, a react
     * function, an optional deadline, and an optional late function (which
     * represents the reaction body of the deadline). All triggers a reaction
     * needs access must be included in the arguments.
     *
     * @param trigs 
     * @param args 
     * @param react 
     * @param deadline 
     * @param late 
     */
    public addReaction<T>(trigs: Triggers, args: Args<ArgList<T>>,
        react: (this: ReactionSandbox, ...args: ArgList<T>) => void, deadline?: TimeValue,
        late: (this: ReactionSandbox, ...args: ArgList<T>) => void =
            () => { Log.global.warn("Deadline violation occurred!") }) {
        let calleePorts = trigs.list.filter(trig => trig instanceof CalleePort)
        if (calleePorts.length > 0) {
            // This is a procedure.
            if (trigs.list.length > 1) {
                // A procedure can only have a single trigger.
                throw new Error("Procedure has multiple triggers.")
            }
            let port = calleePorts[0]
            let existing = this._getReactionsAndMutations()
            var conflict = false
            existing.forEach(r => 
                (r.active && r.trigs.list.find(it => 
                    it === port)) ? conflict = true : {});
            if (conflict) {
                throw new Error("Each callee port can trigger only a single reaction, but two or more are found.")
            }
            let procedure = new Procedure(this, this._reactionScope, trigs, args, react, deadline, late)
            procedure.active = true
            this._reactions.push(procedure)
            this._recordDeps(procedure);
            // Let the port discover the newly added reaction.
            (calleePorts[0] as CalleePort<Present, Present>).update()
        } else {
            // This is an ordinary reaction.
            let reaction = new Reaction(this, this._reactionScope, trigs, args, react, deadline, late);
            reaction.active = true;
            this._reactions.push(reaction);
            this._recordDeps(reaction);
        }
    }

    public addMutation<T>(trigs: Triggers, args: Args<ArgList<T>>,
        react: (this: MutationSandbox, ...args: ArgList<T>) => void, deadline?: TimeValue,
        late: (this: MutationSandbox, ...args: ArgList<T>) => void =
            () => { Log.global.warn("Deadline violation occurred!") }) {
        let mutation = new Mutation(this, this._mutationScope, trigs, args, react,  deadline, late);
        mutation.active = true
        this._mutations.push(mutation);
        this._recordDeps(mutation);
    }

    protected getPrecedenceGraph(): PrecedenceGraph<Reaction<unknown> | Mutation<unknown>> {
        var graph: PrecedenceGraph<Reaction<unknown> | Mutation<unknown>> = new PrecedenceGraph();

        for (let r of this._getChildren()) {
            graph.merge(r.getPrecedenceGraph());
        }

        let prev: Reaction<unknown> | Mutation<unknown> | null = null;
        prev = this._collectDependencies(graph, this._mutations, prev);
        prev = this._collectDependencies(graph, this._reactions, prev);

        return graph;

    }

    private _collectDependencies(graph: PrecedenceGraph<Reaction<unknown> | Mutation<unknown>>,
        nodes: Reaction<unknown>[] | Mutation<unknown>[],
        prev: Reaction<unknown> | Mutation<unknown> | null) {
        for (let i = 0; i < nodes.length; i++) {
            let r = nodes[i];
            graph.addNode(r);
            // Establish dependencies between reactions
            // depending on their ordering inside the reactor.
            if (prev) {
                graph.addEdge(r, prev);
            }
            var deps = r.getDependencies();
            
            // look upstream
            for (let d of deps[0]) {
                if (d instanceof CalleePort) {
                    let prev = this.prevReaction(r)
                    let next = this.nextReaction(r)
                    let callers = this._remoteCallers.get(d)
                    Log.global.debug(">>>>>>>>>>>>>>>Number of callers: " + callers?.size)
                    if (callers) {
                        // 1. Add dependencies from all callers to the preceding reaction.
                        if (prev) {
                            graph.addBackEdges(prev, callers)
                        }
                        // 2. Add dependencies from all the next reaction to all callers.
                        if (next) {
                            graph.addEdges(next, callers)
                        }
                        // 3. Add dependencies between all callers.
                        prev = undefined;
                        callers.forEach((caller) => {prev? graph.addEdge(caller, prev) : {}; prev = caller})
                    }
                } else if (d instanceof IOPort) {
                    graph.addEdges(r, d.getUpstreamReactions());
                } else {
                    Log.global.error("Found dependency that is not a port: " + d)
                }
            }
            // look downstream
            for (let d of deps[1]) {
                if (d instanceof IOPort) {
                    graph.addBackEdges(r, d.getDownstreamReactions());
                } else {
                    Log.global.error("Found antidependency that is not a port")
                }
            }
            prev = r;
        }
        return prev;
    }

    private _addDependency(port: Port<Present>, reaction: Reaction<any>): void {
        let s = this._dependentReactions.get(port);
        if (s == null) {
            s = new Set();
            this._dependentReactions.set(port, s);
        }
        s.add(reaction);
    }

    private _addAntiDependency(port: Port<Present>, reaction: Reaction<any>): void {
        let s = this._dependsOnReactions.get(port);
        if (s == null) {
            s = new Set();
            this._dependsOnReactions.set(port, s);
        }
        s.add(reaction);
    }

    public _triggerReaction(reaction: Reaction<unknown>) {
        this._app._triggerReaction(reaction);
    }

    private _startupChildren() {
        for (let r of this._getChildren()) {
            Log.debug(this, () => "Propagating startup: " + r.startup);
            // Note that startup reactions are scheduled without a microstep delay
            r.getSchedulable(r.startup).schedule(0, null);
        }
    }

    private _shutdownChildren() {
        Log.global.debug("Shutdown children was called")
        for (let r of this._getChildren()) {
            Log.debug(this, () => "Propagating shutdown: " + r.shutdown);
            r.getSchedulable(r.shutdown).schedule(0, null);
        }
    }

    public isChildOf(parent: Reactor) {
        if (this.__container__ === parent) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Obtain a set that has the reactors that this reactor contains directly
     * (not further down the hierarchy).
     */
    private _getChildren(): Set<Reactor> {
        let children = new Set<Reactor>();
        for (const [key, value] of Object.entries(this)) {
            // If pointers to other non-child reactors in the hierarchy are not
            // excluded (eg. value != this.parent) this function will loop
            // forever.
            if (value instanceof Reactor && 
                    value != this.__container__ && !(value instanceof App)) {
                // A reactor may not be a child of itself.
                if (value === this) {
                    throw new Error("A reactor may not have itself as an " +
                    "attribute. Reactor attributes represent a containment " +
                    "relationship, and a reactor cannot contain itself.");
                }
                children.add(value);
            }
        }
        return children;
    }

    /**
     * Return a list of reactions owned by this reactor.
     */
    protected _getReactions(): Array<Reaction<unknown>> {
        var arr: Array<Reaction<any>> = new Array();
        this._reactions.forEach((it) => arr.push(it))
        return arr;
    }

    /**
     * Return a list of reactions and mutations owned by this reactor.
     */
    public _getReactionsAndMutations(): Array<Reaction<unknown>> {
        var arr: Array<Reaction<any>> = new Array();
        this._mutations.forEach((it) => arr.push(it))
        this._reactions.forEach((it) => arr.push(it))
        return arr;
    }

    /**
     * Return a list of reactions owned by this reactor.
     */
    public _getMutations(): Array<Reaction<unknown>> {
        var arr: Array<Reaction<any>> = new Array();
        this._mutations.forEach((it) => arr.push(it))
        return arr;
    }

    /**
     * Report whether the given port is downstream of this reactor. If so, the
     * given port can be connected to with an output port of this reactor.
     * @param port 
     */
    public _isDownstream(port: Port<Present>) {
        if (port instanceof InPort) {
            if (port.isGrandChildOf(this)) {
                return true;
            }
        } 
        if (port instanceof OutPort) {
            if (port.isChildOf(this)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Report whether the given port is upstream of this reactor. If so, the
     * given port can be connected to an input port of this reactor.
     * @param port 
     */
    public _isUpstream(port: Port<Present>) {
        if (port instanceof OutPort) {
            if (port.isGrandChildOf(this)) {
                return true;
            }
        } 
        if (port instanceof InPort) {
            if (port.isChildOf(this)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns true if a given source port can be connected to the
     * given destination port, false otherwise. Valid connections
     * must:
     * (1) adhere to the scoping rules and connectivity constraints 
     *     of reactors; and
     * (2) not introduce cycles.
     * 
     * The scoping rules of reactors can be summarized as follows:
     *  - A port cannot connect to itself;
     *  - Unless the connection is between a caller and callee, the
     *    destination can only be connected to one source;
     *  - ...
     * @param src The start point of a new connection.
     * @param dst The end point of a new connection.
     */
    public canConnect<A extends T, R extends Present, T extends Present, S extends R>
            (src: CallerPort<A,R> | IOPort<S>, dst: CalleePort<T,S> | IOPort<R>) {
        // Rule out self loops. 
        //   - (including trivial ones)
        if (src === dst) {
            return false
        }

        // FIXME: If elapsed logical time is greater than zero, check the local
        // dependency graph to figure out whether this change introduces
        // zero-delay feedback.
        
        // Check that a caller is matched with callee and vice versa. 
        if ((src instanceof CallerPort && !(dst instanceof CalleePort)) || 
             dst instanceof CalleePort && !(src instanceof CallerPort)) {
                return false
        }

        // Rule out write conflicts.
        //   - (between reactors)
        if (!(dst instanceof CalleePort) && 
                this._sourcePort.get(dst) !== undefined) {
            return false;
        }

        //   - between reactors and reactions (NOTE: check also needs to happen
        //     in addReaction)
        var antideps = this._dependsOnReactions.get(dst);
        if (antideps != undefined && antideps.size > 0) {
            return false;
        }

        // Assure that the general scoping and connection rules are adhered to.
        if (src instanceof OutPort) {
            if (dst instanceof InPort) {
                // OUT to IN
                if (src.isGrandChildOf(this) && dst.isGrandChildOf(this)) {
                    return true;
                } else {
                    return false;
                }
            } else {
                // OUT to OUT
                if (src.isGrandChildOf(this) && dst.isChildOf(this)) {
                    return true;
                } else {
                    return false;
                }
            }
        } else {
            if (dst instanceof InPort) {
                // IN to IN
                if (src.isChildOf(this) && dst.isGrandChildOf(this)) {
                    return true;
                } else {
                    return false;
                }
            } else {
                // IN to OUT
                return false;
            }
        }
    }

    /**
     * Connect a source port to a downstream destination port. If a source is a
     * regular port, then the type variable of the source has to be a subtype of
     * the type variable of the destination. If the source is a caller port,
     * then the destination has to be a callee port that is effectively a
     * subtype of the caller port. Because functions have a contra-variant
     * subtype relation, the arguments of the caller side must be a subtype of
     * the callee's, and the return value of the callee's must be a subtype of
     * the caller's.
     * @param src The source port to connect.
     * @param dst The destination port to connect.
     */
    protected _connect<A extends T, R extends Present, T extends Present, S extends R>
            (src: CallerPort<A,R> | IOPort<S>, dst: CalleePort<T,S> | IOPort<R>) {
        if (this.canConnect(src, dst)) {
            Log.debug(this, () => "connecting " + src + " and " + dst);
            if (src instanceof CallerPort && dst instanceof CalleePort) {
                // Treat connections between callers and callees separately.
                // Note that because A extends T and S extends R, we can safely
                // cast CalleePort<T,S> to CalleePort<A,R>.
                src.remotePort = ((dst as unknown) as CalleePort<A,R>);
                let calleeContainer: Reactor | undefined
                let callerContainer: Reactor | undefined
                // Figure out which reactor contains the callee.
                if (dst.isChildOf(this)) {
                    calleeContainer = this
                } else {
                    this._getChildren().forEach((child) => 
                            child._getPorts().forEach((port) => 
                            {(port === dst)? calleeContainer = child : {}}))
                }
                // Obtain the list of remote callers that is stored on the
                // callee's end.
                let callers = calleeContainer?._remoteCallers.get(dst)
                if (!callers) {
                    callers = new Set()
                    calleeContainer?._remoteCallers.set(dst, callers)
                }
                // Figure out which reactor contains the caller.
                if (src.isChildOf(this)) {
                    callerContainer = this
                } else {
                    this._getChildren().forEach((child) => 
                            child._getPorts().forEach((port) => 
                            {(port === src)? callerContainer = child : {}}))
                }
                // Register the caller in the callee reactor so that it can
                // establish dependencies on the callers.
                callerContainer?._dependsOnReactions.get(src)?.
                        forEach((reaction) => callers?.add(reaction))
            } else if (src instanceof IOPort && dst instanceof IOPort) {
                Log.debug(this, () => "connecting " + src + " and " + dst);
                // Set up sources and destinations for value propagation.
                let dests = this._destinationPorts.get(src);
                if (dests == null) {
                    dests = new Set();
                }
                dests.add(dst);

                let key = this.keys.get(dst)
                let writable
                if (key) {
                    writable = dst.asWritable(key) as WritablePort<S> // FIXME: suspicious cast
                } else {
                    writable = dst.asWritable(dst.getContainer()?.borrow(dst, this)) as WritablePort<S>
                }
                src.getManager(this).addReceiver(writable); // FIXME: suspicious cast
                this._destinationPorts.set(src, dests);
                this._sourcePort.set(dst, src);
            }
        } else {
            throw new Error("ERROR connecting " + src + " to " + dst);
        }
    }

    /**
     * 
     * @param src 
     * @param dst 
     */
    protected _disconnect(src: Port<Present>, dst: Port<Present>) {
        Log.debug(this, () => "disconnecting " + src + " and " + dst);
        //src.getManager(this).delReceiver(dst);
        let dests = this._destinationPorts.get(src);
        if (dests != null) {
            dests.delete(dst);
        }
        this._sourcePort.delete(src);
    }

    /**
     * Set all the timers of this reactor.
     */
    public _setTimers(): void {
        Log.debug(this, () => "Setting timers for: " + this);
        let timers = new Set<Timer>();
        for (const [k, v] of Object.entries(this)) {
            if (v instanceof Timer) {
                this._app._setTimer(v);
            }
        }
    }

    /**
     * Unset all the timers of this reactor.
     */
    public _unsetTimers(): void {
        // Log.global.debug("Getting timers for: " + this)
        let timers = new Set<Timer>();
        for (const [k, v] of Object.entries(this)) {
            if (v instanceof Timer) {
                this._app._unsetTimer(v);
            }
        }
    }

    /**
     * Iterate through this reactor's attributes and return the set of its
     * ports.
     */
    protected _getPorts(): Set<Port<any>> {
        // Log.global.debug("Getting ports for: " + this)
        let ports = new Set<Port<any>>();
        for (const [key, value] of Object.entries(this)) {
            if (value instanceof Port) {
                ports.add(value);
            }
        }
        return ports;
    }

    // /**
    //  * Iterate through this reactor's attributes and return the set of its
    //  * actions.
    //  */
    // public _getActions(): Set<Action<any>> {
    //     // Log.global.debug("Getting actions for: " + this)
    //     let actions = new Set<Action<any>>();
    //     for (const [key, value] of Object.entries(this)) {
    //         if (value instanceof Action) {
    //             actions.add(value);
    //         }
    //     }
    //     return actions;
    // }

    /**
     * A reactor's priority represents its order in the topological sort.
     * The default value of -1 indicates a priority has not been set. 
     */
    _priority: number = -1;

    /**
     * Return the fully qualified name of this reactor.
     */
    toString(): string {
        return this.getFullyQualifiedName();
    }

    // NOTE: This code is commented out because it could potentially run
    // forever. Simple cycles like A contains A are ruled out, but ones such as
    // A contains B ... contains A are not. If we want to check the integrity of
    // the hierarchy we need to do something more sophisticated. Also, we'd have
    // to find aliases, which we currently are not.

    // I decided to comment it out because hierarchy checks are already done in
    // _connect, which is where they matter most. For instance, if a connection
    // is drawn to something that is assumed to be up the hierarchy while it is
    // really lower in the hierarchy (or vice versa), the connection will
    // fail. 

    // /**
    //  * Recursively traverse all reactors and verify the 
    //  * parent property of each component correctly matches its location in
    //  * the reactor hierarchy.
    //  */
    // public _checkAllParents(parent: Reactor | null) {


    //     if (this.__container__ != parent) throw new Error("The parent property for " + this
    //         + " does not match the reactor hierarchy.");

    //     let children = this._getChildren();
    //     for (let child of children) {
    //         child._checkAllParents(this);
    //     }

    //     // Ports have their parent set in constructor, so verify this was done correctly.
    //     let ports = this._getPorts();
    //     for (let port of ports) {
    //         if (!port.isChildOf(this)) {
    //             throw new Error("A port has been incorrectly constructed as an attribute of " +
    //                 "a different reactor than the parent it was given in its constructor: "
    //                 + port);
    //         }
    //     }

    //     let actions = this._getActions();
    //     for (let action of actions) {
    //         if (!action.isChildOf(this)) throw new Error("The parent property for " + action
    //             + " does not match the reactor hierarchy.");
    //     }

    // }

}

export abstract class Port<T extends Present> extends Trigger implements Read<T> {
    
    /** The time stamp associated with this port's value. */
    protected tag: Tag | undefined;

    /** The value associated with this port. */
    protected value: T | Absent;

    abstract get(): T | undefined;

    abstract getManager(container: Reactor): PortManager<T>;

    /**
     * Create a new port on the given reactor.
     * @param __container__ 
     */
    constructor(protected __container__: Reactor) {
        super(__container__);
    }

    /**
     * Return the transitive closure of reactions dependent on this port.
     */
    public getDownstreamReactions(): Set<Reaction<unknown>> { // FIXME: move this to reactor because reactions should not be able to retrieve downstream reactions
        var reactions: Set<Reaction<unknown>> = new Set();
        for (let d of this.__container__._getDestinations(this)) {
            reactions = new Set([...reactions, ...d.getDownstreamReactions()]);
        }
        reactions = new Set([...reactions, ...this.__container__.getDownstreamReactions(this)]);
        if (reactions.size > 0) {
            Log.global.debug("Downstream reactions found!");
        }
        return reactions;
    }


    /**
     * Return the transitive closure of reactions dependent on this port.
     */
    public getUpstreamReactions(): Set<Reaction<unknown>> {
        var reactions: Set<Reaction<unknown>> = new Set();
        var source = this.__container__.getSource(this);
        Log.debug(this, () => "Finding upstream reactions for " + this);
        if (source) {
            Log.global.debug(">>>");
            // Reactions upstream (i.e., in other reactors).
            reactions = new Set([...reactions, ...source.getUpstreamReactions()]);
        }
        // Reactions local (i.e., within the reactor).
        reactions = new Set([...reactions, ...this.__container__.getUpstreamReactions(this)]);
        if (reactions.size > 0)
            Log.global.debug("Upstream reactions found!");
        return reactions;
    }

}

export abstract class IOPort<T extends Present> extends Port<T> {

    protected receivers: Set<WritablePort<T>> = new Set();

    protected reactions: Set<Reaction<unknown>> = new Set();

    private key: Symbol = Symbol()

    /**
     * Create a new port on the given reactor.
     * @param __container__ 
     */
    constructor(protected __container__: Reactor) {
        super(__container__);
        __container__.register(this, this.key)
    }

    /**
     * Returns true if the connected port's value has been set; false otherwise
     */
    public isPresent() {

        Log.debug(this, () => "In isPresent()...")
        Log.debug(this, () => "value: " + this.value);
        Log.debug(this, () => "tag: " + this.tag);
        Log.debug(this, () => "time: " + this.__container__.util.getCurrentLogicalTime())

        if (this.value !== undefined
            && this.tag !== undefined
            && this.tag.isSimultaneousWith(this.__container__.util.getCurrentTag())) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Return the value set to this port. Return `Absent` if the connected
     * output did not have its value set at the current logical time.
     */
    public get(): T | Absent {
        if (this.isPresent()) {
            return this.value;
        } else {
            return undefined;
        }
    }

    /**
     * Only the holder of the key may obtain a writable port.
     * @param key
     */
    public asWritable(key: Symbol | undefined): WritablePort<T> {
        if (this.key === key) {
            return this.writer
        }
        throw Error("Invalid reference to container.")
    }

    /**
     * 
     * @param container Reference to the container of this port 
     * (or the container thereof).
     */
    public getManager(container: Reactor): PortManager<T> {
        if (this.__container__ === container || this.__container__.isChildOf(container)) {
            return this.manager
        }
        throw Error("Invalid reference to container.")
    }

    /**
     * Inner class instance to gain access to Write<T> interface.
     */
    protected writer = new class extends WritablePort<T> {
        constructor(private port:IOPort<T>) {
            super()
        }

        public set(value: T): void {
            this.port.value = value;
            this.port.tag = this.port.__container__.util.getCurrentTag();
            // Set values in downstream receivers.
            this.port.receivers.forEach(p => p.set(value))
            // Trigger reactions sensitive to this port.
            this.port.reactions.forEach(r => this.port.__container__._triggerReaction(r))
        }

        public get(): T | Absent {
            return this.port.get()
        }

        public getPort(): Port<T> {
            return this.port
        }
        
        public toString(): string {
            return this.port.toString()
        }
        
    }(this)

    /**
     * Inner class instance to let the container configure this port.
     */
    protected manager:PortManager<T> = new class implements PortManager<T> {
        constructor(private port:IOPort<T>) {}
        addReceiver(port: WritablePort<T>): void {
            this.port.receivers.add(port)
        }
        delReceiver(port: WritablePort<T>): void {
            this.port.receivers.delete(port)
        }
        addReaction(reaction: Reaction<unknown>): void {
            this.port.reactions.add(reaction)
        }
        delReaction(reaction: Reaction<unknown>): void {
            this.port.reactions.delete(reaction)
        }
    }(this)

    toString(): string {
        return this.getFullyQualifiedName();
    }
}

interface TriggerManager {
    addReaction(reaction: Reaction<unknown>): void;
    delReaction(reaction: Reaction<unknown>): void;    
}

interface PortManager<T extends Present> extends TriggerManager {
    addReceiver(port: WritablePort<T>): void;
    delReceiver(port: WritablePort<T>): void;
}

export class OutPort<T extends Present> extends IOPort<T> {

}

export class InPort<T extends Present> extends IOPort<T> {

}

/**
 * A caller port sends arguments of type T and receives a response of type R.
 */
export class CallerPort<A extends Present, R extends Present> extends Port<R> implements Write<A>, Read<R> { // FIXME: maybe Port should not implement Read
    
    public get(): R | undefined {
        if (this.tag?.isSimultaneousWith(this.__container__.util.getCurrentTag()))
            return this.remotePort?.retValue
    }

    public remotePort: CalleePort<A, R> | undefined;

    public set(value: A): void  {
        // Invoke downstream reaction directly, and return store the result.
        if (this.remotePort) {
            this.remotePort.invoke(value)
        }
        this.tag = this.__container__.util.getCurrentTag();
    }

    public invoke(value:A): R | undefined {
        // If connected, this will trigger a reaction and update the 
        // value of this port.
        this.set(value)
        // Return the updated value.
        return this.get()
    }

    /**
     * 
     * @param container Reference to the container of this port 
     * (or the container thereof).
     */
    public getManager(container: Reactor): PortManager<R> {
        if (this.__container__ === container || this.__container__.isChildOf(container)) {
            return this.manager
        }
        throw Error("Invalid reference to container.")
    }

    protected manager:PortManager<R> = new class implements PortManager<R> {
        constructor(private port:Port<R>) {}
        addReceiver(port: WritablePort<R>): void {
            //
        }
        delReceiver(port: WritablePort<R>): void {
            //
        }
        addReaction(reaction: Reaction<unknown>): void {
            //
        }
        delReaction(reaction: Reaction<unknown>): void {
            //
        }
    }(this)

}

/**
 * A callee port receives arguments of type A and send a response of type R.
 */
export class CalleePort<A extends Present, R extends Present> extends Port<A> implements Read<A>, Write<R> {
    
    get(): A | undefined {
        return this.argValue;
    }

    public retValue: R | undefined;

    public argValue: A | undefined;

    private reaction: Reaction<unknown> | undefined

    public update(): void {
        for (let reaction of this.__container__._getReactionsAndMutations()) {
            if (reaction.trigs.list.find(it => it === this)) {
                this.reaction = reaction
                break
            }
        }
    }

    public invoke(value: A): R | undefined {
        this.argValue = value
        this.reaction?.doReact()
        return this.retValue
    }

    public set(value: R): void  {
        // NOTE: this will not trigger reactions because
        // connections between caller ports and callee ports
        // are excluded from the trigger map.
        this.retValue = value;
    }

    public return(value: R): void {
        this.set(value)
    }

    /**
     * 
     * @param container Reference to the container of this port 
     * (or the container thereof).
     */
    public getManager(container: Reactor): PortManager<A> {
        if (this.__container__ === container || this.__container__.isChildOf(container)) {
            return this.manager
        }
        throw Error("Invalid reference to container.")
    }

    protected manager:PortManager<A> = new class implements PortManager<A> {
        constructor(private port:Port<A>) {}
        addReceiver(port: WritablePort<A>): void {
            //
        }
        delReceiver(port: WritablePort<A>): void {
            //
        }
        addReaction(reaction: Reaction<unknown>): void {
            //
        }
        delReaction(reaction: Reaction<unknown>): void {
            //
        }
    }(this)

}

class EventQueue extends PrioritySet<Tag> {

    public push(event: TaggedEvent<Present>) {
        return super.push(event);
    }

    public pop(): TaggedEvent<Present> | undefined {
        return super.pop() as TaggedEvent<Present>;
    }

    public peek(): TaggedEvent<Present> | undefined {
        return super.peek() as TaggedEvent<Present>;
    }
}

class ReactionQueue extends PrioritySet<Priority> {

    public push(reaction: Reaction<unknown>) {
        return super.push(reaction);
    }

    public pop(): Reaction<unknown> {
        return super.pop() as Reaction<unknown>;
    }

    public peek(): Reaction<unknown> {
        return super.peek() as Reaction<unknown>;
    }

}

interface AppUtils {
    schedule(e: TaggedEvent<any>): void; // FIXME: shouldn't really be here.
    success(): void;
    failure(): void;
    requestShutdown(): void;
    getCurrentTag(): Tag;
    getCurrentLogicalTime(): TimeValue;
    getCurrentPhysicalTime(): TimeValue;
    getElapsedLogicalTime(): TimeValue;
    getElapsedPhysicalTime(): TimeValue;

}

export interface MutationSandbox extends ReactionSandbox {
    connect<A extends T, R extends Present, T extends Present, S extends R>
            (src: CallerPort<A,R> | IOPort<S>, dst: CalleePort<T,S> | IOPort<R>):void;
    // FIXME: addReaction, removeReaction
    // FIXME: disconnect
}

export interface ReactionSandbox {
    /**
     * Collection of utility functions accessible from within a `react` function.
     */
    util: AppUtils

}

export class App extends Reactor {

    alarm = new Alarm();

    util = new class implements AppUtils { // NOTE this is an inner class because some of the member fields of the app are protected.
        constructor(private app: App) {

        }
        public schedule(e: TaggedEvent<any>) {
            return this.app.schedule(e);
        }

        public requestShutdown() {
            this.app._shutdown();
        }

        public success() {
            return this.app.success();
        }

        public failure() {
            return this.app.failure();
        }

        public getCurrentTag(): Tag {
            return this.app._currentTag;
        }

        public getCurrentLogicalTime(): TimeValue {
            return this.app._currentTag.time;
        }

        public getCurrentPhysicalTime(): TimeValue {
            return getCurrentPhysicalTime();
        }

        public getElapsedLogicalTime(): TimeValue {
            return this.app._currentTag.time.difference(this.app._startOfExecution);
        }

        public getElapsedPhysicalTime(): TimeValue {
            return getCurrentPhysicalTime().subtract(this.app._startOfExecution);
        }
    }(this);
    
    /**
     * The current time, made available so actions may be scheduled relative to it.
     */
    private _currentTag: Tag;

    /**
     * Reference to "immediate" invocation of next.
     */
    private _immediateRef: ReturnType<typeof setImmediate> | undefined;

    /**
     * The next time the execution will proceed to.
     */
    private _nextTime: TimeValue | undefined;

    /**
     * Priority set that keeps track of scheduled events.
     */
    private _eventQ = new EventQueue();

    /**
     * If not null, finish execution with success, this time interval after the
     * start of execution.
     */
    private _executionTimeout: TimeValue | undefined;

    /**
     * The time at which normal execution should terminate. When this time is
     * defined, we can assume that a shutdown event associated with this time
     * has been scheduled.
     */
    private _endOfExecution: TimeValue | undefined;

    /**
     * If false, execute with normal delays to allow physical time to catch up
     * to logical time. If true, don't wait for physical time to match logical
     * time.
     */
    private _fast: boolean;

    /**
     * Indicates whether the program should continue running once the event 
     * queue is empty.
     */
    private _keepAlive = false;

    /**
     * Priority set that keeps track of reactions at the current Logical time.
     */
    private _reactionQ = new ReactionQueue();

    /**
     * The physical time when execution began relative to January 1, 1970 00:00:00 UTC.
     * Initialized in start().
     */
    private _startOfExecution: TimeValue;

    /**
     * Report a timer to the app so that it gets scheduled.
     * @param timer The timer to report to the app.
     */
    public _setTimer(timer: Timer) {
        Log.debug(this, () => ">>>>>>>>>>>>>>>>>>>>>>>>Setting timer: " + timer);
        let startTime;
        if (timer.offset.isZero()) {
            // getLaterTime always returns a microstep of zero, so handle the
            // zero offset case explicitly.
            startTime = this.util.getCurrentTag().getMicroStepLater();
        } else {
            startTime = this.util.getCurrentTag().getLaterTag(timer.offset);
        }
        this.schedule(new TaggedEvent(timer, this.util.getCurrentTag().getLaterTag(timer.offset), null));
    }

    /**
     * Report a timer to the app so that it gets unscheduled.
     * @param timer The timer to report to the app.
     */
    public _unsetTimer(timer: Timer) {
        // FIXME: we could either set the timer to 'inactive' to tell the 
        // scheduler to ignore future event and prevent it from rescheduling any.
        // The problem with this approach is that if, for some reason, a timer would get
        // reactivated, it could start seeing events that were scheduled prior to its
        // becoming inactive. Alternatively, we could remove the event from the queue, 
        // but we'd have to add functionality for this.
    }

    /**
     * Unset all the timers of this reactor.
     */
    public _unsetTimers(): void {
        Object.entries(this).filter(it => it[1] instanceof Timer).forEach(it => this._unsetTimer(it[1]))
    }

    private snooze: Action<Tag> = new Action(this, Origin.logical, new TimeValue(1, 0));

    /**
     * Create a new top-level reactor.
     * @param executionTimeout Optional parameter to let the execution of the app time out.
     * @param keepAlive Optional parameter, if true allows execution to continue with an empty event queue.
     * @param fast Optional parameter, if true does not wait for physical time to catch up to logical time.
     * @param success Optional callback to be used to indicate a successful execution.
     * @param failure Optional callback to be used to indicate a failed execution.
     */
    constructor(executionTimeout: TimeValue | undefined = undefined, 
                keepAlive: boolean = false, 
                fast: boolean = false, 
                public success: () => void = () => {}, 
                public failure: () => void = () => { 
                    throw new Error("An unexpected error has occurred.") 
                }) {
        super(null);
        
        // Initialize the scope in which reactions and mutations of this reactor
        // will execute. This is already done in the super constructor, but has
        // to be redone because at that time this.utils hasn't initialized yet.
        this._initializeReactionScope()
        this._initializeMutationScope()

        this._fast = fast;
        this._keepAlive = keepAlive;
        this._executionTimeout = executionTimeout;

        // NOTE: these will be reset properly during startup.
        this._currentTag = new Tag(new TimeValue(0), 0);
        this._startOfExecution = this._currentTag.time;

    }

    

    // getName(): string {
    //     var alias = super.getName();
    //     var count = 0;
    //     var suffix = "";
    //     if (alias == this.constructor.name) {
    //         for (let a of App.instances) {
    //             if (a !== this && alias === a.constructor.name) {
    //                 count++;
    //             }
    //         }
    //     }
    //     if (count > 0) {
    //         suffix = "(" + count + ")";
    //     }
    //     return alias + suffix;
    // }

    /**
     * Handle the next events on the event queue.
     * ----
     * Wait until physical time matches or exceeds the time of the least tag on
     * the event queue. After this wait, load the reactions triggered by all
     * events with the least tag onto the reaction queue and start executing
     * reactions in topological order. Each reaction may produce outputs, which,
     * in turn, may load additional reactions onto the reaction queue. Once done
     * executing reactions for the current tag, see if the next tag has the same
     * time (but a different microstep) and repeat the steps above until the
     * next tag has both a different time and microstep. In this case, set an
     * alarm to be woken up at the next time. Note that our timer implementation
     * uses `process.nextTick()` to unravel the stack but prevent I/O from
     * taking place if computation is lagging behind physical time. Only once
     * computation has caught up, full control is given back to the JS event
     * loop. This prevents the system from being overwhelmed with external
     * stimuli.
     */
    private _next() {
        var nextEvent = this._eventQ.peek();
        if (nextEvent) {
            // There is an event at the head of the event queue.

            // If it is too early to handle the next event, set a timer for it
            // (unless the "fast" option is enabled), and give back control to
            // the JS event loop.
            if (getCurrentPhysicalTime().isEarlierThan(nextEvent.tag.time) && !this._fast) {
                this.setAlarmOrYield(nextEvent.tag);
                return;
            }

            // Start processing events. Execute all reactions that are triggered
            // at the current tag in topological order. After that, if the next
            // event on the event queue has the same time (but a greater
            // microstep), repeat. This prevents JS event loop from gaining
            // control and imposing overhead. Asynchronous activity therefore
            // might get blocked, but since the results of such activities are
            // typically reported via physical actions, the tags of the
            // resulting events would be in the future, anyway.
            do {
                // Advance logical time.
                this._currentTag = nextEvent.tag;

                // Keep popping the event queue until the next event has a different tag.
                while (nextEvent != null && nextEvent.tag.isSimultaneousWith(this._currentTag)) {
                    var trigger = nextEvent.trigger;
                    this._eventQ.pop();
                    Log.debug(this, () => "Popped off the event queue: " + trigger);

                    // Handle timers.
                    if (trigger instanceof Timer) {
                        if (!trigger.period.isZero()) {
                            Log.debug(this, () => "Rescheduling timer " + trigger);

                            this.schedule(new TaggedEvent(trigger,
                                this._currentTag.getLaterTag(trigger.period),
                                null));
                        }
                    }

                    // Load reactions onto the reaction queue.
                    nextEvent.trigger.update(nextEvent, (r:Reaction<unknown>) => this._triggerReaction(r));
                    // Look at the next event on the queue.
                    nextEvent = this._eventQ.peek();
                }

                while (this._reactionQ.size() > 0) {
                    try {
                        var r = this._reactionQ.pop();
                        r.doReact();
                    } catch (e) {
                        Log.error(this, () => "Exception occurred in reaction: " + r + ": " + e);
                        // Allow errors in reactions to kill execution.
                        throw e; 
                    }
                    
                }
                Log.global.debug("Finished handling all events at current time.");

                // Peek at the event queue to see whether we can process the next event
                // or should give control back to the JS event loop.
                nextEvent = this._eventQ.peek();

            } while (nextEvent && this._currentTag.time.isEqualTo(nextEvent.tag.time));
        }

        // Once we've reached here, either we're done processing events and the
        // next event is at a future time, or there are no more events in the
        // queue.
        if (nextEvent) {
            Log.global.debug("Event queue not empty.")
            this.setAlarmOrYield(nextEvent.tag);
        } else {
            // The queue is empty.
            if (this._endOfExecution) {
                // An end of execution has been specified; a shutdown event must
                // have been scheduled, and all shutdown events must have been
                // consumed.
                this._terminateWithSuccess();
            } else {
                // No end of execution has been specified.
                if (this._keepAlive) {
                    // Keep alive: snooze and wake up later.
                    Log.global.debug("Going to sleep.");
                    this.getSchedulable(this.snooze).schedule(0, this._currentTag);
                } else {
                    // Don't keep alive: initiate shutdown.
                    Log.global.debug("Initiating shutdown.")
                    this._shutdown();
                }
            }
        }
    }


    /**
     * Push events on the event queue. 
     * @param e Prioritized event to push onto the event queue.
     */
    public schedule(e: TaggedEvent<any>) {
        let head = this._eventQ.peek();

        // If startup was scheduled during a run-time mutation, bypass the event queue.
        if (e.trigger instanceof Startup && !this.util.getElapsedLogicalTime().isZero()) {
            e.trigger.update(e, (r:Reaction<unknown>) => this._triggerReaction(r))
            return
        }

        this._eventQ.push(e);

        Log.debug(this, () => "Scheduling with trigger: " + e.trigger);
        Log.debug(this, () => "Elapsed logical time in schedule: " + this.util.getElapsedLogicalTime());
        Log.debug(this, () => "Elapsed physical time in schedule: " + this.util.getElapsedPhysicalTime());
        
        // If the scheduled event has an earlier tag than whatever is at the
        // head of the queue, set a new alarm.
        if (head == undefined || e.tag.isSmallerThan(head.tag)) {
            this.setAlarmOrYield(e.tag);
        }
    }

    /**
     * Disable the alarm and clear possible immediate next.
     */
    public _cancelNext() {
        this._nextTime = undefined;
        this.alarm.unset();
        if (this._immediateRef) {
            clearImmediate(this._immediateRef);
            this._immediateRef = undefined;
        }
        this._eventQ.empty()
    }

    /**
     * 
     * @param tag 
     */
    public setAlarmOrYield(tag: Tag) {
        if (this._endOfExecution) {
            if (this._endOfExecution.isEarlierThan(tag.time)) {
                // Ignore this request if the tag is later than the end of execution.
                return;
            }
        }
        this._nextTime = tag.time;
        let physicalTime = getCurrentPhysicalTime();
        let timeout = physicalTime.difference(tag.time);
        if (physicalTime.isEarlierThan(tag.time) && !this._fast) {
            // Set an alarm to be woken up when the event's tag matches physical
            // time.
            this.alarm.set(function (this: App) {
                this._next();
            }.bind(this), timeout)
        } else {
            // Either we're in "fast" mode, or we're lagging behind.
            // Only schedule an immediate if none is already pending.
            if (!this._immediateRef) {
                this._immediateRef = setImmediate(function (this: App) {
                    this._immediateRef = undefined;
                    this._next()
                }.bind(this));
            }
        }
    }

    /**
     * Public method to push reaction on the reaction queue. 
     * @param e Prioritized reaction to push onto the reaction queue.
     */
    public _triggerReaction(r: Reaction<unknown>) {
        Log.debug(this, () => "Pushing " + r + " onto the reaction queue.")
        this._reactionQ.push(r);
    }

    /**
     * Schedule a shutdown event at the current time if no such action has been taken yet. 
     * Clear the alarm, and set the end of execution to be the current tag. 
     */
    private _shutdown(): void {
        if (this._isActive()) {
            this._endOfExecution = this._currentTag.time;

            Log.debug(this, () => "Initiating shutdown sequence.");
            Log.debug(this, () => "Setting end of execution to: " + this._endOfExecution);

            this.getSchedulable(this.shutdown).schedule(0, null);

        } else {
            Log.global.debug("Ignoring App._shutdown() call after shutdown has already started.");
        }
    }

    private _terminateWithSuccess(): void {
        this._cancelNext();
        Log.info(this, () => Log.hr);
        Log.info(this, () => ">>> End of execution at (logical) time: " + this.util.getCurrentLogicalTime());
        Log.info(this, () => ">>> Elapsed physical time: " + this.util.getElapsedPhysicalTime());
        Log.info(this, () => Log.hr);

        this.success();
    }

    private _terminateWithError(): void {
        this._cancelNext();
        Log.info(this, () => Log.hr);
        Log.info(this, () => ">>> End of execution at (logical) time: " + this.util.getCurrentLogicalTime());
        Log.info(this, () => ">>> Elapsed physical time: " + this.util.getElapsedPhysicalTime());
        Log.info(this, () => Log.hr);

        this.failure();

    }

    public _start(): void {
        Log.info(this, () => Log.hr);
        let initStart = getCurrentPhysicalTime();
        Log.global.info(">>> Initializing");

        Log.global.debug("Initiating startup sequence.")
        // // Recursively check the parent attribute for this and all contained reactors and
        // // and components, i.e. ports, actions, and timers have been set correctly.
        // this._checkAllParents(null);
        // Obtain the precedence graph, ensure it has no cycles, 
        // and assign a priority to each reaction in the graph.
        var apg = this.getPrecedenceGraph();
        Log.debug(this, () => apg.toString());

        if (apg.updatePriorities()) {
            Log.global.debug("No cycles.");
        } else {
            throw new Error("Cycle in reaction graph.");
        }

        // Let the start of the execution be the current physical time.
        this._startOfExecution = getCurrentPhysicalTime();
        this._currentTag = new Tag(this._startOfExecution, 0);

        // If an execution timeout is defined, the end of execution be the start time plus
        // the execution timeout.
        if (this._executionTimeout != null) {
            this._endOfExecution = this._startOfExecution.add(this._executionTimeout);
            Log.debug(this, () => "Execution timeout: " + this._executionTimeout);
            // If there is a known end of execution, schedule a shutdown reaction to that effect.
            this.schedule(new TaggedEvent(this.shutdown, new Tag(this._endOfExecution, 1), null));
        }

        Log.info(this, () => ">>> Spent " + this._currentTag.time.subtract(initStart as TimeValue)
            + " initializing.");
        Log.info(this, () => Log.hr);
        Log.info(this, () => Log.hr);
        Log.info(this, () => ">>> Start of execution: " + this._currentTag);
        Log.info(this, () => Log.hr);

        // Set in motion the execution of this program by scheduling startup at the current logical time.
        this.util.schedule(new TaggedEvent(this.startup, this._currentTag, null));
        //this.getSchedulable(this.startup).schedule(0);
    }
}
