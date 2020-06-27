/**
 * Core of the reactor runtime.
 * 
 * @author Marten Lohstroh (marten@berkeley.edu),
 * @author Matt Weber (matt.weber@berkeley.edu)
 */

import {Sortable, PrioritySetElement, PrioritySet, SortableDependencyGraph, Log, DependencyGraph} from './util';
import {TimeValue, TimeUnit, Tag, Origin, getCurrentPhysicalTime, UnitBasedTimeValue, Alarm, BinaryTimeValue } from './time';
// FIXME: Remove these imports after moving dependent code to federation.ts.
import {Socket, createConnection, SocketConnectOpts} from 'net'
import {EventEmitter } from 'events';


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
 * A variable can be read, written to, or scheduled. Variables may be passed to
 * reactions in an argument list.
 * @see Read
 * @see Write
 * @see Schedule
 */
export type Variable = Read<unknown>

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
    
    /** 
     * Return the alternative name for this object if set, 
     * an empty string otherwise. 
     */
    _getAlias(): string;

    /**
     * Return the fully qualified name of this object.
     */ 
    _getFullyQualifiedName(): string;

    /**
     * Return this name of this object.
     **/
    _getName(): string;

}

/**
 * Interface for readable variables.
 */
export interface Read<T> {
    get(): T | Absent;
}

/**
 * Interface for schedulable actions.
 */
export interface Schedule<T> extends Read<T> {
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
    abstract get(): T | undefined;
    abstract schedule(extraDelay: 0 | TimeValue, value: T): void;
}

//--------------------------------------------------------------------------//
// Core Reactor Classes                                                     //
//--------------------------------------------------------------------------//

/**
 * Base class for named objects embedded in a hierarchy of reactors. Each
 * component can only be owned by a single reactor instance. All members of
 * this class are prefixed with an underscore to avoid name collisions with
 * ports, actions, timers, or reactor instances that may be part of the 
 * interface of a `Reactor`, which extends this class.
 */
class Component implements Named {

    /**
     * An optional alias for this component.
     */
    protected _alias: string | undefined;

    /**
     * A symbol that identifies this component, and it also used to selectively
     * grant access to its priviledged functions.
     */
    protected _key: Symbol = Symbol()

    /**
     * The owner of this component. Each component is owned by a reactor.
     * Only instances of `App`, which denote top-level reactors, are allowed
     * to be their own owner.
     */
    protected _owner: Reactor; // FIXME: make this private with a getter!

    /**
     * Function for staging reactions for execution at the current logical
     * time.
     */
    protected _stage: (reaction: Reaction<unknown>) => void;

    protected _schedule: (e: TaggedEvent<any>) => void;

    /**
     * Create a new component and register it with the owner.
     * @param owner The owner of this component, `null` if this is an instance
     * of `App`, in which case the ownership will be assigned to the component
     * itself.
     * @param alias An optional alias for the component.
     */
    constructor(owner: Reactor | null, alias?:string) {
        this._alias = alias

        if (this instanceof App) {
            this._owner = this               // Apps are self-owner.
            this._stage = this.getLoader()   // Get the loader from the app.
            this._schedule = this.getScheduler() // Also get the scheduler.
        } else {
            if (owner !== null) {
                this._owner = owner              // Set the owner.
                this._owner._register(this, this._key) // Register with owner.
                this._stage = owner._stage       // Inherited the loader.
                this._schedule = owner._schedule // Inherit the scheduler
            } else {
                throw Error("Cannot instantiate component without a parent.")
            }
        }
    }

    /**
     * Report whether or not this component is owned by the given reactor.
     * @param reactor The presumptive owner of this component.
     */
    public _isOwnedBy(reactor: Reactor): boolean {

        if (this instanceof App) return false
        else if (this._owner === reactor) return true
    
        return false
    }

    /**
     * Report whether or not this component is owned by the owner of the given
     * reactor.
     * @param reactor The presumptive owner of the owner of this component.
     */
    public _isOwnedByOwnerOf(reactor: Reactor): boolean {
        if (this instanceof App) return false
        else if (this._owner._isOwnedBy(reactor)) return true;
    
        return false;
    }

    /**
     * Return a string that identifies this component.
     * The name is a path constructed as App/.../Container/ThisComponent
     */
    _getFullyQualifiedName(): string {
        var path = "";
        if (!(this instanceof App)) {
            path = this._owner._getFullyQualifiedName();
        }
        if (path != "") {
            path += "/" + this._getName();
        } else {
            path = this._getName();
        }
        return path;
    }

    /**
     * Return a string that identifies this component within the reactor.
     */
    public _getName(): string {

        var name = ""
        if (!(this instanceof App)) {
            for (const [key, value] of Object.entries(this._owner)) {
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
        // Return the constructor name in case the component wasn't found in its
        // container and doesn't have an alias.
        if (name == "") {
            name = this.constructor.name
        }
        
        return name
    }

    public _getAlias(): string {
        if (this._alias) return this._alias
        else return ""
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


/**
 * Generic base class for reactions. The type parameter `T` denotes the type of
 * the argument list of the `react` function that that is applied to when this
 * reaction gets triggered.
 */
export class Reaction<T> implements Sortable<Priority>, PrioritySetElement<Priority> {

    /** 
     * Priority derived from this reaction's location in the dependency graph
     * that spans the entire hierarchy of components inside the top-level reactor
     * that this reaction is also embedded in.
     */
    private priority: Priority = Number.MAX_SAFE_INTEGER;

    /**
     * 
     */
    public next: PrioritySetElement<Priority> | undefined;

     /**
      * Construct a new reaction by passing in a reference to the reactor that
      * will own it, an object to execute the its `react` and `late` functions
      * on, a list of triggers, the arguments to pass into `react` and `late`,
      * an implementation of this reaction's `react` function, an optional
      * deadline to be observed, and an optional custom implementation of the
      * `late` function that is invoked when logical time lags behind physical time
      * with a margin that exceeds the time interval denoted by the deadline.
      * @param reactor The owner of this reaction.
      * @param sandbox The `this` object for `react` and `late`.
      * @param trigs The ports, actions, or timers, which, when they receive
      * values, will trigger this reaction.
      * @param args The arguments to be passed to `react` and `late`.
      * @param react Function that gets execute when triggered and "on time."
      * @param deadline The maximum amount by which logical time may lag behind
      * physical time when `react` has been triggered and is ready to execute.
      * @param late Function that gets execute when triggered and "late."
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

    
    getPriority(): Priority {
        return this.priority;
    }

    hasPriorityOver(node: PrioritySetElement<Priority> | undefined): boolean {
        if (node != null && this.getPriority() < node.getPriority()) {
            return true;
        } else {
            return false;
        }
    }

    updateIfDuplicateOf(node: PrioritySetElement<Priority> | undefined) {
        return Object.is(this, node);
    }

    public doReact() {

        Log.debug(this, () => ">>> Reacting >>> " + this.constructor.name + " >>> " + this.toString());
        Log.debug(this, () => "Reaction deadline: " + this.deadline);

        // If this reaction was loaded onto the reaction queue but the trigger(s) 
        // absorbed by a mutation that routed the value(s) elsewhere, then return
        // without invoking the reaction.
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
            this.late.apply(this.sandbox, this.args.tuple); // late
        } else {
            this.react.apply(this.sandbox, this.args.tuple); // on time
        }
    }

    /**
     * Set a deadline for this reaction. The given time value denotes the maximum
     * allowable amount by which logical time may lag behind physical time at the
     * point that this reaction is ready to execute. If this maximum lag is
     * exceeded, the `late` function is executed instead of the `react` function.
     * @param deadline The deadline to set to this reaction.
     */
    public setDeadline(deadline: TimeValue): this {
        this.deadline = deadline;
        return this;
    }

    /**
     * Set for reaction priority, to be used only by the runtime environment.
     * The priority of each reaction is determined on the basis of its
     * dependencies on other reactions.
     * @param priority The priority for this reaction.
     */
    public setPriority(priority: number) {
        this.priority = priority;
    }

    public toString(): string {
        return this.reactor._getFullyQualifiedName() + "[R" + this.reactor.getReactionIndex(this) + "]";
    }
}

/**
 * An event is caused by a timer or a scheduled action. Each event is tagged
 * with a time instant and may carry a value of arbitrary type. The tag will
 * determine the event's position with respect to other events in the event
 * queue.
 */
export class TaggedEvent<T extends Present> implements PrioritySetElement<Tag> {

    public next: PrioritySetElement<Tag> | undefined;

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
    hasPriorityOver(node: PrioritySetElement<Tag> | undefined) {
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
    updateIfDuplicateOf(node: PrioritySetElement<Tag> | undefined) {
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

    /**
     * Reactions to trigger.
     */
    protected reactions: Set<Reaction<unknown>> = new Set();

    abstract getManager(key: Symbol | undefined): TriggerManager;

    public getContainer(): Reactor | null {
        return this._owner
    }

    abstract isPresent():boolean;

}

abstract class ScheduledTrigger<T extends Present> extends Trigger {
    protected value: T | Absent = undefined;
    protected tag: Tag | undefined;

    /**
     * Update the current value of this timer in accordance with the given
     * event, and trigger any reactions that list this timer as their trigger.
     * @param e Timestamped event.
     */
    public update(e: TaggedEvent<T>):void {

        if (!e.tag.isSimultaneousWith(this._owner.util.getCurrentTag())) {
            throw new Error("Time of event does not match current logical time.");
        }
        if (e.trigger === this) {
            this.value = e.value
            this.tag = e.tag;
            for (let r of this.reactions) {
                this._stage(r)
            }
        } else {
            throw new Error("Attempt to update action using incompatible event.");
        }
    }

    public getManager(key: Symbol | undefined): TriggerManager {
        if (this._key == key) {
            return this.manager
        }
        throw Error("Unable to grant access to manager.")
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
        if (this.tag.isSimultaneousWith(this._owner.util.getCurrentTag())) {
            return true;
        } else {
            return false;
        }
    }

    protected manager = new class implements TriggerManager {
        constructor(private trigger: ScheduledTrigger<T>) { }
        getContainer(): Reactor {
            return this.trigger._owner
        }
        addReaction(reaction: Reaction<unknown>): void {
            this.trigger.reactions.add(reaction)
        }
        delReaction(reaction: Reaction<unknown>): void {
            this.trigger.reactions.delete(reaction)
        }
    }(this)

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

    public asSchedulable(key: Symbol | undefined): Schedule<T> {
        if (this._key === key) {
            return this.scheduler
        }
        throw Error("Invalid reference to container.")
    }

    public getManager(key: Symbol | undefined): TriggerManager {
        if (this._key == key) {
            return this.manager
        }
        throw Error("Unable to grant access to manager.")
    }

    protected scheduler = new class<T extends Present> extends SchedulableAction<T> {
        get(): T | undefined {
            return this.action.get()
        }
        constructor(private action: Action<T>) {
            super()
        }
        schedule(extraDelay: 0 | TimeValue, value: T): void {
            if (!(extraDelay instanceof TimeValue)) {
                extraDelay = new TimeValue(0);
            }
            
            var tag = this.action._owner.util.getCurrentTag();
            var delay = this.action.minDelay.add(extraDelay);

            tag = tag.getLaterTag(delay);

            if (this.action.origin == Origin.physical) {
                // If the resulting timestamp from delay is less than the current physical time
                // on the platform, then the timestamp becomes the current physical time.
                // Otherwise the tag is computed like a logical action's tag.

                let physicalTime = getCurrentPhysicalTime();
                if (tag.time.isEarlierThan(physicalTime)) {
                    tag = new Tag(getCurrentPhysicalTime(), 0);
                } else {
                    tag = tag.getMicroStepLater();
                }
            }
    
            if (this.action.origin == Origin.logical && !(this.action instanceof Startup)) {
                tag = tag.getMicroStepLater();
            }
            
            Log.debug(this, () => "Scheduling " + this.action.origin +
                " action " + this.action._getFullyQualifiedName() + " with tag: " + tag);
    
            this.action._schedule(new TaggedEvent(this.action, tag, value));
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
    constructor(__container__: Reactor, origin: Origin, minDelay: TimeValue = new TimeValue(0), minInterArrival: TimeValue = defaultMIT) {
        super(__container__);
        this.origin = origin;
        this.minDelay = minDelay;
    }

    public toString() {
        return this._getFullyQualifiedName();
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
    constructor(__container__: Reactor, offset: TimeValue | 0, period: TimeValue | 0) {
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


    public toString() {
        return "Timer from " + this._owner._getFullyQualifiedName() + " with period: " + this.period + " offset: " + this.offset;
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
        return this.parent._getFullyQualifiedName() + "[M" + this.parent.getReactionIndex(this) + "]";
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

    // NOTE: put this first because components may attempt to register and need access to this datastructore
    private _keyChain: Map<Component, Symbol> = new Map()

    /**
     * This graph has in it all the dependencies implied by this reactor's
     * ports, reactions, and connections.
     */
    private _dependencyGraph: DependencyGraph<Port<Present> | Reaction<unknown>> = new DependencyGraph()

    /**
     * This graph has some overlap with the reactors dependency, but is 
     * different in two respects:
     * - transitive dependencies between ports have been collapsed; and
     * - it incorporates the causality interfaces of all contained reactors.
     * It thereby carries enough information to find out whether adding a new
     * connection at runtime could result in a cyclic dependency, _without_ 
     * having to consult other reactors.
     */
    private _causalityGraph: DependencyGraph<Port<Present>> = new DependencyGraph()
    
    /**
     * Indicates whether this reactor is active (meaning it has reacted to a
     * startup action), or not (in which case it either never started up or has
     * reacted to a shutdown action).
     */
    private _active = false;

    /**
     * This reactor's shutdown action.
     */
    readonly shutdown = new Shutdown(this);

    /**
     * This reactor's startup action.
     */
    readonly startup = new Startup(this);

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

    public _register(component: Component, key: Symbol) {
        if (!this._keyChain.has(component)) this._keyChain.set(component, key)
    }

    protected _getLast(reactions: Set<Reaction<any>>): Reaction<unknown> | undefined {
        let index = -1
        let all = this._getReactionsAndMutations()

        for (let reaction of reactions) {
            let found = all.findIndex((r) => r === reaction)
            if (found >= 0) {
                index = Math.max(found, index)
            }
        }
        if (index >= 0) {
            return all[index]
        }
    }

    protected _getFirst(reactions: Set<Reaction<any>>): Reaction<unknown> | undefined {
        let index = -1
        let all = this._getReactionsAndMutations()

        for (let reaction of reactions) {
            let found = all.findIndex((r) => r === reaction)
            if (found >= 0) {
                index = Math.min(found, index)
            }
        }
        if (index >= 0) {
            return all[index]
        }
    }

    /**
     * If the given component is owned by this reactor, look up its key and
     * return it. Otherwise, if a key has been provided, and it matches the
     * key of this reactor, also look up the component's key and return it.
     * Otherwise, if the component is owned by a reactor that is owned by 
     * this reactor, request the component's key from that reactor and return
     * it. If the component is an action, this request is only honored if it
     * is a startup or shutdown action (other actions are not allowed to be
     * scheduled across hierarchies).
     * @param component The component to look up the key for.
     * @param key The key that verifies the ownership relation between this
     * reactor and the component, with at most one level of indirection.
     */
    protected _getKey(component: Trigger, key?: Symbol): Symbol | undefined {
        if (component._isOwnedBy(this) || this._key === key) {
            return this._keyChain.get(component)
        } else if ((component instanceof Startup || 
                    component instanceof Shutdown ||
                  !(component instanceof Action)) && 
                    component._isOwnedByOwnerOf(this)) {
            let owner = component.getContainer()
            if (owner !== null) {
                return owner._getKey(component, this._keyChain.get(owner))
            }
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
     * @param owner The owner of this reactor.
     */

    constructor(owner: Reactor | null, alias?:string) {
        super(owner, alias);
        
        // Utils get passed down the hierarchy. If this is an App,
        // the container refers to this object, making the following
        // assignment idemponent.
        this.util = (this._owner as unknown as Reactor).util    
        
        this._reactionScope = new this._ReactionSandbox(this)
        this._mutationScope = new this._MutationSandbox(this)

        // NOTE: beware, if this is an instance of App, `this.util` will be `undefined`.
        // Do not attempt to reference it during the construction of an App.
        var self = this;
        // Add default startup reaction.
        this.addMutation(
            new Triggers(this.startup),
            new Args(),
            function (this) {
                Log.debug(this, () => "*** Starting up reactor " +
                self._getFullyQualifiedName());
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
                    self._getFullyQualifiedName());
                self._doShutdown();
            }
        );
        
    }

    protected _doShutdown() {
        this._shutdownChildren();
        this._unsetTimers();
        this._active = false;
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

    protected writable<T extends Present>(port: IOPort<T>): ReadWrite<T> {
        return port.asWritable(this._getKey(port));
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

    protected schedulable<T extends Present>(action: Action<T>): Schedule<T> {
        return action.asSchedulable(this._getKey(action));
    }

    private _recordDeps<T extends Variable[]>(reaction: Reaction<any>) {
        
        // Add a dependency on the previous reaction or mutation, if it exists.
        let prev = this._getLastReactionOrMutation()
        if (prev) {
            // FIXME: how does this affect the causality graph?
            // Will any effect of this reaction will now be depending
            // on the ports that its predecessors list as dependencies?
            this._dependencyGraph.addEdge(reaction, prev)
            
        }

        // Set up the triggers.
        for (let t of reaction.trigs.list) {
            // Link the trigger to the reaction.
            if (t instanceof Trigger) {
                t.getManager(this._getKey(t)).addReaction(reaction)
            }

            // Also record this trigger as a dependency.
            if (t instanceof IOPort) {
                this._dependencyGraph.addEdge(reaction, t)
                //this._addDependency(t, reaction);
            } else {
                Log.debug(this, () => ">>>>>>>> not a dependency: " + t);
            }
        }
        
        let sources = new Set<Port<any>>()
        let effects = new Set<Port<any>>()
    
        for (let a of reaction.args.tuple) {
            if (a instanceof IOPort) {
                this._dependencyGraph.addEdge(reaction, a)
                sources.add(a)
            }
            if (a instanceof CalleePort) {
                this._dependencyGraph.addEdge(a, reaction)
            }
            if (a instanceof CallerPort) {
                this._dependencyGraph.addEdge(reaction, a)
            }
            // Only necessary if we want to add actions to the dependency graph.
            if (a instanceof Action) {
                // dep
            }
            if (a instanceof SchedulableAction) {
                // antidep
            }
            if (a instanceof WritablePort) {
                this._dependencyGraph.addEdge(a.getPort(), reaction)
                effects.add(a.getPort())
            }
        }
        // Make effects dependent on sources.
        for (let effect of effects) {
            this._causalityGraph.addEdges(effect, sources)
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
    protected addReaction<T>(trigs: Triggers, args: Args<ArgList<T>>,
        react: (this: ReactionSandbox, ...args: ArgList<T>) => void, deadline?: TimeValue,
        late: (this: ReactionSandbox, ...args: ArgList<T>) => void =
            () => { Log.global.warn("Deadline violation occurred!") }) {
        let calleePorts = trigs.list.filter(trig => trig instanceof CalleePort)
        if (calleePorts.length > 0) {
            // This is a procedure.
            let port = calleePorts[0] as CalleePort<Present, Present>
            let procedure = new Procedure(this, this._reactionScope, trigs, args, react, deadline, late)
            if (trigs.list.length > 1) {
                // A procedure can only have a single trigger.
                throw new Error("Procedure `" + procedure + "` has multiple triggers.")
            }
            procedure.active = true
            this._recordDeps(procedure);
            // Let the last caller point to the reaction that precedes this one.
            // This lets the first caller depend on it.
            port.getManager(this._getKey(port)).setLastCaller(this._getLastReactionOrMutation())
            this._reactions.push(procedure);    
            
        } else {
            // This is an ordinary reaction.
            let reaction = new Reaction(this, this._reactionScope, trigs, args, react, deadline, late);
            reaction.active = true;
            this._recordDeps(reaction);
            this._reactions.push(reaction);
        }
    }

    protected addMutation<T>(trigs: Triggers, args: Args<ArgList<T>>,
        react: (this: MutationSandbox, ...args: ArgList<T>) => void, deadline?: TimeValue,
        late: (this: MutationSandbox, ...args: ArgList<T>) => void =
            () => { Log.global.warn("Deadline violation occurred!") }) {
        let mutation = new Mutation(this, this._mutationScope, trigs, args, react,  deadline, late);
        mutation.active = true
        this._recordDeps(mutation);
        this._mutations.push(mutation);
    }

    protected getPrecedenceGraph(depth=-1): DependencyGraph<Port<Present> | Reaction<unknown>> {
        
        var graph: DependencyGraph<Port<Present> | Reaction<unknown>> = new DependencyGraph();
        
        graph.merge(this._dependencyGraph)

        if (depth > 0 || depth < 0) {
            if (depth > 0) {
                depth--
            }
            for (let r of this._getOwnReactors()) {
                graph.merge(r.getPrecedenceGraph(depth));
            }
        }
        
        // Check if there are any callee ports owned by this reactor.
        // If there are, add a dependency from its last caller to the antidependencies
        // of the procedure (excluding the callee port itself).
        let calleePorts = this._findOwnCalleePorts()
        for (let p of calleePorts) {
            let procedure = p.getManager(this._getKey(p)).getProcedure()
            let lastCaller = p.getManager(this._getKey(p)).getLastCaller()
            if (procedure && lastCaller) {
                let antideps = graph.getBackEdges(procedure)
                //console.log(">>>>>>>>>>>> last caller:" + lastCaller)
                for (let a of antideps) {
                    if (!(a instanceof CalleePort)) {
                        graph.addEdge(a, lastCaller)
                    }
                }
            } else {
                Error("No procedure")
            }
        }

        return graph;

    }
    
    private _startupChildren() {
        for (let r of this._getOwnReactors()) {
            Log.debug(this, () => "Propagating startup: " + r.startup);
            // Note that startup reactions are scheduled without a microstep delay
            r.startup.asSchedulable(this._getKey(r.startup)).schedule(0, null)
        }
    }

    private _shutdownChildren() {
        Log.global.debug("Shutdown children was called")
        for (let r of this._getOwnReactors()) {
            Log.debug(this, () => "Propagating shutdown: " + r.shutdown);
            r.shutdown.asSchedulable(this._getKey(r.shutdown)).schedule(0, null)
        }
    }

    /**
     * Return the reactors that this reactor owns.
     */
    private _getOwnReactors(): Array<Reactor> {
        return Array.from(this._keyChain.keys()).filter(
            (it) => it instanceof Reactor) as Array<Reactor>;
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

    private _getLastReactionOrMutation(): Reaction<any> | undefined {
        let len = this._reactions.length
        if (len > 0) {
            return this._reactions[len -1]
        }
        len = this._mutations.length
        if (len > 0) {
            return this._mutations[len -1]
        }
    }

    /**
     * Return a list of reactions owned by this reactor.
     */
    private _getMutations(): Array<Reaction<unknown>> {
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
            if (port._isOwnedByOwnerOf(this)) {
                return true;
            }
        } 
        if (port instanceof OutPort) {
            if (port._isOwnedBy(this)) {
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
            if (port._isOwnedByOwnerOf(this)) {
                return true;
            }
        } 
        if (port instanceof InPort) {
            if (port._isOwnedBy(this)) {
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
        
        // Validate connections between callers and callees.
        if (src instanceof CalleePort) {
            return false
        }
        if (src instanceof CallerPort) {
            if (dst instanceof CalleePort && 
                src._isOwnedByOwnerOf(this) && dst._isOwnedByOwnerOf(this)) {
                return true
            }
            return false
        }

        // Rule out write conflicts.
        //   - (between reactors)
        if (!(dst instanceof CalleePort) && 
                this._dependencyGraph.getBackEdges(dst).size > 0) {
            return false;
        }

        //   - between reactors and reactions (NOTE: check also needs to happen
        //     in addReaction)
        //var antideps = this._dependsOnReactions.get(dst);
        var deps = this._dependencyGraph.getEdges(dst) // FIXME this will change with multiplex ports
        if (deps != undefined && deps.size > 0) {
            return false;
        }

        // Assure that the general scoping and connection rules are adhered to.
        if (src instanceof OutPort) {
            if (dst instanceof InPort) {
                // OUT to IN
                if (src._isOwnedByOwnerOf(this) && dst._isOwnedByOwnerOf(this)) {
                    return true;
                } else {
                    return false;
                }
            } else {
                // OUT to OUT
                if (src._isOwnedByOwnerOf(this) && dst._isOwnedBy(this)) {
                    return true;
                } else {
                    return false;
                }
            }
        } else {
            if (dst instanceof InPort) {
                // IN to IN
                if (src._isOwnedBy(this) && dst._isOwnedByOwnerOf(this)) {
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
                // Register the caller in the callee reactor so that it can
                // establish dependencies on the callers.
                let calleeManager = dst.getManager(this._getKey(dst))
                let callerManager = src.getManager(this._getKey(src))
                let container = callerManager.getContainer()
                let callers = new Set<Reaction<any>>()
                container._dependencyGraph.getBackEdges(src).forEach((dep) => {
                    if (dep instanceof Reaction) {
                        callers.add(dep)
                    }
                })
                let first = container._getFirst(callers)
                let last = container._getLast(callers)
                let lastCaller = calleeManager.getLastCaller()
                if (lastCaller !== undefined) {
                    // This means the callee port is bound to a reaction and
                    // there may be zero or more callers. We now continue
                    // building a chain of callers.
                    if (first) {
                        this._dependencyGraph.addEdge(first, lastCaller)
                    } else {
                        this._dependencyGraph.addEdge(src, dst)
                    }
                    if (last)
                        calleeManager.setLastCaller(last)
                } else {
                    throw new Error("No procedure linked to callee"
                    + " port `${procedure}`.")
                }
                
            } else if (src instanceof IOPort && dst instanceof IOPort) {
                Log.debug(this, () => "connecting " + src + " and " + dst);
                // Set up sources and destinations for value propagation.
                this._dependencyGraph.addEdge(dst, src);
                this._causalityGraph.addEdge(dst, src);

                src.getManager(this._getKey(src)).addReceiver
                    (dst.asWritable(this._getKey(dst)) as WritablePort<S>);
            }
        } else {
            throw new Error("ERROR connecting " + src + " to " + dst);
        }
    }

    /**
     * Return a dependency graph consisting of only this reactor's own ports
     * and the dependencies between them.
     */
    protected _getCausalityInterface(): DependencyGraph<Port<Present>> {
        let ifGraph = this._causalityGraph
        // Find all the input and output ports that this reactor owns.
        
        let inputs = this._findOwnInputs()
        let outputs = this._findOwnOutputs()
        let visited = new Set()
        let self = this
        
        function search(output: OutPort<Present>, nodes: Set<Port<Present> | Reaction<unknown>>) {
            for (let node of nodes) {
                if (!visited.has(node)) {
                    visited.add(node)
                    if (node instanceof InPort && inputs.has(node)) {
                        ifGraph.addEdge(output, node)   
                    } else {
                        search(output, self._dependencyGraph.getEdges(output))
                    }
                }
            }
        }

        // For each output, walk the graph and add dependencies to 
        // the inputs that are reachable.
        for (let output of outputs) {
            search(output, this._dependencyGraph.getEdges(output))
            visited.clear()
        }
        
        return ifGraph
    }

    protected _findOwnCalleePorts() {
        let ports = new Set<CalleePort<Present, Present>>()
        for(let component of this._keyChain.keys()) {
            if (component instanceof CalleePort) {
                ports.add(component)
            }
        }
        return ports
    }

    protected _findOwnInputs() {
        let inputs = new Set<InPort<Present>>()
        for(let component of this._keyChain.keys()) {
            if (component instanceof InPort) {
                inputs.add(component)
            }
        }
        return inputs
    }

    protected _findOwnOutputs() {
        let outputs = new Set<OutPort<Present>>()
        for(let component of this._keyChain.keys()) {
            if (component instanceof InPort) {
                outputs.add(component)
            }
        }
        return outputs
    }

    protected _findOwnReactors() {
        let reactors = new Set<Reactor>()
        for(let component of this._keyChain.keys()) {
            if (component instanceof Reactor) {
                reactors.add(component)
            }
        }
        return reactors
    }


    /**
     * 
     * @param src 
     * @param dst 
     */
    private _disconnect(src: Port<Present>, dst: Port<Present>) {
        Log.debug(this, () => "disconnecting " + src + " and " + dst);
        //src.getManager(this.getKey(src)).delReceiver(dst);


        // FIXME

        // let dests = this._destinationPorts.get(src);
        // if (dests != null) {
        //     dests.delete(dst);
        // }
        // this._sourcePort.delete(src);
    }

    /**
     * Set all the timers of this reactor.
     */
    protected _setTimers(): void {
        Log.debug(this, () => "Setting timers for: " + this);
        let timers = new Set<Timer>();
        for (const [k, v] of Object.entries(this)) {
            if (v instanceof Timer) {
                this._setTimer(v);
            }
        }
    }

    protected _setTimer(timer: Timer): void {
        Log.debug(this, () => ">>>>>>>>>>>>>>>>>>>>>>>>Setting timer: " + timer);
        let startTime;
        if (timer.offset.isZero()) {
            // getLaterTime always returns a microstep of zero, so handle the
            // zero offset case explicitly.
            startTime = this.util.getCurrentTag().getMicroStepLater();
        } else {
            startTime = this.util.getCurrentTag().getLaterTag(timer.offset);
        }
        this._schedule(new TaggedEvent(timer, this.util.getCurrentTag().getLaterTag(timer.offset), null));
    }

    /**
     * Report a timer to the app so that it gets unscheduled.
     * @param timer The timer to report to the app.
     */
    protected _unsetTimer(timer: Timer) {
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
    protected _unsetTimers(): void {
        // Log.global.debug("Getting timers for: " + this)
        let timers = new Set<Timer>();
        for (const [k, v] of Object.entries(this)) {
            if (v instanceof Timer) {
                this._unsetTimer(v);
            }
        }
    }

    /**
     * Return the fully qualified name of this reactor.
     */
    toString(): string {
        return this._getFullyQualifiedName();
    }
}

export abstract class Port<T extends Present> extends Trigger implements Read<T> {
    
    /** The time stamp associated with this port's value. */
    protected tag: Tag | undefined;

    /** The value associated with this port. */
    protected value: T | Absent;

    abstract get(): T | undefined;

    /**
     * Returns true if the connected port's value has been set; false otherwise
     */
    public isPresent() {

        Log.debug(this, () => "In isPresent()...")
        Log.debug(this, () => "value: " + this.value);
        Log.debug(this, () => "tag: " + this.tag);
        Log.debug(this, () => "time: " + this._owner.util.getCurrentLogicalTime())

        if (this.value !== undefined
            && this.tag !== undefined
            && this.tag.isSimultaneousWith(this._owner.util.getCurrentTag())) {
            return true;
        } else {
            return false;
        }
    }
}

export abstract class IOPort<T extends Present> extends Port<T> {

    protected receivers: Set<WritablePort<T>> = new Set();

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
        if (this._key === key) {
            return this.writer
        }
        throw Error("Referenced port is out of scope.") // FIXME: adjust messages for other methods as well
        // FIXME: we could potentially do this for reads/triggers as well just for scope rule enforcement
    }

    /**
     * 
     * @param container Reference to the container of this port 
     * (or the container thereof).
     */
    public getManager(key: Symbol | undefined): IOPortManager<T> {
        if (this._key == key) {
            return this.manager
        }
        throw Error("Unable to grant access to manager.")
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
            this.port.tag = this.port._owner.util.getCurrentTag();
            // Set values in downstream receivers.
            this.port.receivers.forEach(p => p.set(value))
            // Stage triggered reactions for execution.
            this.port.reactions.forEach(r => this.port._stage(r))
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
    protected manager:IOPortManager<T> = new class implements IOPortManager<T> {
        constructor(private port:IOPort<T>) {}
        getContainer(): Reactor {
            return this.port._owner
        }
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
        return this._getFullyQualifiedName();
    }
}

interface ComponentManager {
    getOwner(): Reactor;

}

interface TriggerManager {
    getContainer():Reactor;
    addReaction(reaction: Reaction<unknown>): void;
    delReaction(reaction: Reaction<unknown>): void;    
}

interface IOPortManager<T extends Present> extends TriggerManager {
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
export class CallerPort<A extends Present, R extends Present> extends Port<R> implements Write<A>, Read<R> {
    
    public get(): R | undefined {
        if (this.tag?.isSimultaneousWith(this._owner.util.getCurrentTag()))
            return this.remotePort?.retValue
    }

    public remotePort: CalleePort<A, R> | undefined;

    public set(value: A): void  {
        // Invoke downstream reaction directly, and return store the result.
        if (this.remotePort) {
            this.remotePort.invoke(value)
        }
        this.tag = this._owner.util.getCurrentTag();
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
    public getManager(key: Symbol | undefined): TriggerManager {
        if (this._key == key) {
            return this.manager
        }
        throw Error("Unable to grant access to manager.")
    }


    protected manager: TriggerManager = new class implements TriggerManager {
        constructor(private port:CallerPort<A, R>) {}
        addReaction(reaction: Reaction<unknown>): void {
            throw new Error("A Caller port cannot use used as a trigger.");
        }
        delReaction(reaction: Reaction<unknown>): void {
            throw new Error("A Caller port cannot use used as a trigger.");
        }
        getContainer(): Reactor {
            return this.port._owner
        }
    }(this)

    toString() {
        return "CallerPort"
    }

}

interface CalleeManager<T extends Present> extends TriggerManager {
    setLastCaller(reaction: Reaction<unknown> | undefined):void;
    getLastCaller(): Reaction<unknown> | undefined;
    addReaction(procedure: Procedure<unknown>): void;
    getProcedure(): Procedure<unknown> | undefined;
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

    private procedure: Procedure<unknown> | undefined

    private lastCaller: Reaction<unknown> | undefined
    
    public invoke(value: A): R | undefined {
        this.argValue = value
        this.procedure?.doReact()
        return this.retValue
    }

    public set(value: R): void  {
        // NOTE: this will not trigger reactions because
        // connections between caller ports and callee ports
        // are invoked directly.
        this.retValue = value;
    }

    public return(value: R): void {
        this.set(value)
    }

    /**
     * 
     * @param key 
     */
    public getManager(key: Symbol | undefined): CalleeManager<A> {
        if (this._key == key) {
            return this.manager
        }
        throw Error("Unable to grant access to manager.")
    }

    protected manager:CalleeManager<A> = new class implements CalleeManager<A> {
        constructor(private port:CalleePort<A, Present>) {}
        getContainer(): Reactor {
            return this.port._owner
        }
        addReaction(procedure: Reaction<unknown>): void {
            if (this.port.procedure !== undefined) {
                throw new Error("Each callee port can trigger only a single"
                + " reaction, but two or more are found on: " 
                + this.port.toString())
            }
            this.port.procedure = procedure
        }
        delReaction(reaction: Reaction<unknown>): void {
            throw new Error("Method not implemented.");
        }
        setLastCaller(reaction: Reaction<unknown> | undefined):void {
            this.port.lastCaller = reaction
        }
        getProcedure(): Procedure<unknown> | undefined {
            return this.port.procedure
        }
        getLastCaller(): Reaction<unknown> | undefined {
            return this.port.lastCaller
        }
    }(this)

    toString() {
        return "CalleePort"
    }

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
    success(): void; // FIXME: These callbacks needs be renamed and their implementation needs to be improved.
    failure(): void;
    requestShutdown(): void;
    getCurrentTag(): Tag;
    getCurrentLogicalTime(): TimeValue;
    getCurrentPhysicalTime(): TimeValue;
    getElapsedLogicalTime(): TimeValue;
    getElapsedPhysicalTime(): TimeValue;
    sendRTIMessage(data: Buffer, destFederateID: number, destPortID: number): void;
    sendRTITimedMessage(data: Buffer, destFederateID: number, destPortID: number): void;
}

export interface MutationSandbox extends ReactionSandbox {
    connect<A extends T, R extends Present, T extends Present, S extends R>
            (src: CallerPort<A,R> | IOPort<S>, dst: CalleePort<T,S> | IOPort<R>):void;
    //forkJoin(constructor: new () => Reactor, ): void;
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

    /**
     * Inner class that provides access to utilities that are safe to expose to
     * reaction code.
     */
    util = new class implements AppUtils {
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
        
        public sendRTIMessage(data: Buffer, destFederateID: number, destPortID: number) {
            return this.app.sendRTIMessage(data, destFederateID, destPortID);
        };

        public sendRTITimedMessage(data: Buffer, destFederateID: number, destPortID: number) {
            return this.app.sendRTITimedMessage(data, destFederateID, destPortID);
        };

    }(this);
    
    /**
     * Send an (untimed) message to the designated federate port through the RTI.
     * This function throws an error if it isn't called on a FederatedApp.
     * @param data A Buffer containing the body of the message.
     * @param destFederateID The federate ID that is the destination of this message.
     * @param destPortID The port ID that is the destination of this message.
     */
    protected sendRTIMessage(data: Buffer, destFederateID: number, destPortID: number) {
        throw new Error("Cannot call sendRTIMessage from an App. sendRTIMessage may be called only from a FederatedApp");
    }

    /**
     * Send a (timed) message to the designated federate port through the RTI.
     * This function throws an error if it isn't called on a FederatedApp.
     * @param data A Buffer containing the body of the message.
     * @param destFederateID The federate ID that is the destination of this message.
     * @param destPortID The port ID that is the destination of this message.
     */
    protected sendRTITimedMessage(data: Buffer, destFederateID: number, destPortID: number) {
        throw new Error("Cannot call sendRTIMessage from an App. sendRTIMessage may be called only from a FederatedApp");
    }

    /**
     * The current time, made available so actions may be scheduled relative to it.
     */
    private _currentTag: Tag;

    /**
     * Reference to "immediate" invocation of next.
     */
    protected _immediateRef: ReturnType<typeof setImmediate> | undefined;

    /**
     * The next time the execution will proceed to.
     */
    private _nextTime: TimeValue | undefined;

    /**
     * Priority set that keeps track of scheduled events.
     */
    private _eventQ = new EventQueue();

    public getLoader(): (reaction: Reaction<unknown>) => void {
        return (r:Reaction<unknown>) => this._reactionQ.push(r);
    }

    public getScheduler(): (e: TaggedEvent<any>) => void {
        return (e: TaggedEvent<any>) => this.schedule(e);
    }

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

    /**
     * Check whether the next event can be handled or not.
     *
     * In a non-federated context this method always returns true.
     * @param event The next event to be processed.
     */
    protected canProceed(event: TaggedEvent<Present>) {
        return true
    }

    /**
     * Hook called when all events with the current tag have been reacted to.
     * 
     * @param event The tag of the next event to be handled.
     */
    protected finalizeStep(nextTag: Tag) {
    }

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

            // Check whether the next event can be handled, or not quite yet.
            // A holdup can occur in a federated execution.
            if (!this.canProceed(nextEvent)) {
                // If this happens, then a TAG from the RTI will trigger the
                // next invocation of _next.
                return; 
            }
            // If it is too early to handle the next event, set a timer for it
            // (unless the "fast" option is enabled), and give back control to
            // the JS event loop.
            if (getCurrentPhysicalTime().isEarlierThan(nextEvent.tag.time)
                        && !this._fast) {
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
                this.finalizeStep(nextEvent.tag)
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
                    trigger.update(nextEvent);

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
                    this.snooze.asSchedulable(this._getKey(this.snooze)).schedule(0, this._currentTag);
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

        // All start actions bypass the event queue, except for the one scheduled by this app.
        if (e.trigger instanceof Startup && e.trigger !== this.startup) {
            e.trigger.update(e)
            return
        }

        // Don't schedule events past the end of execution.
        if (!this._endOfExecution || !this._endOfExecution.isEarlierThan(e.tag.time)) {
            this._eventQ.push(e);
        }
        
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
        Log.debug(this, () => {return "In setAlarmOrYield for tag: " + tag});
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
            this._setImmediateForNext();
        }
    }

    /**
     * Call setImmediate on this._next()
     */
    protected _setImmediateForNext() {
        // Only schedule an immediate if none is already pending.
        if (!this._immediateRef) {
            this._immediateRef = setImmediate(function (this: App) {
                this._immediateRef = undefined;
                this._next()
            }.bind(this));
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

            this.schedulable(this.shutdown).schedule(0, null);

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

    private _terminateWithError(): void { // FIXME: this is never read.
        this._cancelNext();
        Log.info(this, () => Log.hr);
        Log.info(this, () => ">>> End of execution at (logical) time: " + this.util.getCurrentLogicalTime());
        Log.info(this, () => ">>> Elapsed physical time: " + this.util.getElapsedPhysicalTime());
        Log.info(this, () => Log.hr);

        this.failure();

    }

    /**
     * Check the app's precedence graph for cycles.
     */
    protected _checkPrecedenceGraph(): void {
        Log.info(this, () => Log.hr);
        let initStart = getCurrentPhysicalTime();
        Log.global.info(">>> Initializing");

        Log.global.debug("Initiating startup sequence.")
        
        // Obtain the precedence graph, ensure it has no cycles, 
        // and assign a priority to each reaction in the graph.
        var apg = this.getPrecedenceGraph();

        Log.debug(this, () => "Before collapse: " + apg.toString());
        var collapsed = new SortableDependencyGraph()

        // 1. Collapse dependencies and weed out the ports.
        let leafs = apg.leafNodes()
        let visited = new Set()

        function search(reaction: Reaction<unknown>, 
            nodes: Set<Port<Present> | Reaction<unknown>>) {
            for (let node of nodes) {    
                if (node instanceof Reaction) {
                    collapsed.addEdge(reaction, node)
                    if (!visited.has(node)) {
                        visited.add(node)
                        search(node, apg.getEdges(node))
                    }
                } else {
                    search(reaction, apg.getEdges(node))
                }
            }
        }

        for (let leaf of leafs) {
            if (leaf instanceof Reaction) {
                collapsed.addNode(leaf)
                search(leaf, apg.getEdges(leaf))
                visited.clear()
            }
        }        

        // 2. Update priorities.
        Log.debug(this, () => "After collapse: " + collapsed.toString());

        if (collapsed.updatePriorities(true)) {
            Log.global.debug("No cycles.");
        } else {
            throw new Error("Cycle in reaction graph.");
        }

        Log.info(this, () => ">>> Spent " + getCurrentPhysicalTime().subtract(initStart as TimeValue)
            + " checking the precedence graph.");
    }

    /**
     * Use the current physical time to set the app's start of execution.
     * If an execution timeout is defined, the end of execution is the start time plus
     * the execution timeout.
     * @param startTime The beginning of this app's execution. The end of execution is
     * determined relative to this TimeValue.
     */
    protected _alignStartAndEndOfExecution(startTime: TimeValue) {
        // Let the start of the execution be the current physical time.
        this._startOfExecution = startTime;
        this._currentTag = new Tag(this._startOfExecution, 0);

        if (this._executionTimeout != null) {
            this._endOfExecution = this._startOfExecution.add(this._executionTimeout);
            Log.debug(this, () => "Execution timeout: " + this._executionTimeout);

            // If there is a known end of execution, schedule a shutdown reaction to that effect.
            this.schedule(new TaggedEvent(this.shutdown, new Tag(this._endOfExecution, 1), null));
        }
    }

    /**
     * Schedule the App's startup action for the current tag.
     */
    protected _scheduleStartup(): void {
        this.util.schedule(new TaggedEvent(this.startup, this._currentTag, null));
    }

    /**
     * Start the app.
     */
    public _start(): void {
        this._checkPrecedenceGraph()
        this._alignStartAndEndOfExecution(getCurrentPhysicalTime());

        Log.info(this, () => Log.hr);
        Log.info(this, () => Log.hr);

        Log.info(this, () => ">>> Start of execution: " + this._currentTag);
        Log.info(this, () => Log.hr);
        
        // Set in motion the execution of this program by scheduling startup at the current logical time.
        this._scheduleStartup();
        //this.getSchedulable(this.startup).schedule(0);
    }
}

//---------------------------------------------------------------------//
// Federated Execution Constants and Enums                             //
//---------------------------------------------------------------------//

// FIXME: For now this constant is unused.
/** 
 *  Size of the buffer used for messages sent between federates.
 *  This is used by both the federates and the rti, so message lengths
 *  should generally match.
 */
export const BUFFER_SIZE: number = 256;

/** 
 *  Number of seconds that elapse between a federate's attempts
 *  to connect to the RTI.
 */
export const CONNECT_RETRY_INTERVAL: TimeValue = new UnitBasedTimeValue(2, TimeUnit.sec);

/** 
 *  Bound on the number of retries to connect to the RTI.
 *  A federate will retry every CONNECT_RETRY_INTERVAL seconds
 *  this many times before giving up. E.g., 500 retries every
 *  2 seconds results in retrying for about 16 minutes.
 */
export const CONNECT_NUM_RETRIES: number = 500;

/**
 * Message types defined for communication between a federate and the
 * RTI (Run Time Infrastructure).
 * In the C reactor target these message types are encoded as an unsigned char,
 * so to maintain compatability in TypeScript the magnitude must not exceed 255
 */
enum RTIMessageTypes {

    /**
     * Byte Identifying a federate ID message, which is 32 bits long.
     */
    FED_ID = 1,

    /**
     * Byte identifying a timestamp message, which is 64 bits long.
     */
    TIMESTAMP = 2,

    /** 
     *  Byte identifying a message to forward to another federate.
     *  The next two bytes will be the ID of the destination port.
     *  The next two bytes are the destination federate ID.
     *  The four bytes after that will be the length of the message.
     *  The remaining bytes are the message.
     */
    MESSAGE = 3,

    /** 
     * Byte identifying that the federate is ending its execution.
     */
    RESIGN = 4,

    /** 
     *  Byte identifying a timestamped message to forward to another federate.
     *  The next two bytes will be the ID of the destination port.
     *  The next two bytes are the destination federate ID.
     *  The four bytes after that will be the length of the message.
     *  The next eight bytes will be the timestamp.
     *  The remaining bytes are the message.
     */
    TIMED_MESSAGE = 5,

    /** 
     *  Byte identifying a next event time (NET) message sent from a federate.
     *  The next eight bytes will be the timestamp. This message from a
     *  federate tells the RTI the time of the earliest event on that federate's
     *  event queue. In other words, absent any further inputs from other federates,
     *  this will be the logical time of the next set of reactions on that federate.
     */
    NEXT_EVENT_TIME = 6,

    /** 
     *  Byte identifying a time advance grant (TAG) sent to a federate.
     *  The next eight bytes will be the timestamp.
     */
    TIME_ADVANCE_GRANT = 7,

    /** 
     *  Byte identifying a logical time complete (LTC) message sent by a federate
     *  to the RTI. The next eight bytes will be the timestamp.
     */
    LOGICAL_TIME_COMPLETE = 8
}

// FIXME: Move the following code to federation.ts
// import {Log} from './util';
// import {TimeValue, TimeUnit, Origin, getCurrentPhysicalTime, UnitBasedTimeValue, Alarm, BinaryTimeValue } from './time';
// import {Socket, createConnection, SocketConnectOpts} from 'net'
// import {EventEmitter } from 'events';
// import {Action, Present, TaggedEvent, App} from './reactor'

//---------------------------------------------------------------------//
// Federated Execution Classes                                         //
//---------------------------------------------------------------------//

// FIXME: add "FederatedApp" and other class names here
// to the prohibited list of LF names.

/**
 * Node.js doesn't export a type for errors with a code,
 * so this is a workaround for typing such an Error.
 */
interface NodeJSCodedError extends Error{
    code: string;
}

/**
 * Custom type guard for a NodeJsCodedError
 * @param e The Error to be tested as being a NodeJSCodedError
 */
function isANodeJSCodedError(e: Error): e is NodeJSCodedError {
    return (typeof (e as NodeJSCodedError).code === 'string');
}

/**
 * An RTIClient is used within a federate to abstract the socket
 * connection to the RTI and the RTI's binary protocol over the socket.
 * RTIClient exposes functions for federate-level operations like
 * establishing a connection to the RTI or sending a message.
 * RTIClient is an EventEmitter, and asynchronously emits events for:
 * 'startTime', 'connected', 'message', 'timedMessage', and 
 * 'timeAdvanceGrant'. The federatedApp is responsible for handling the
 * events to ensure a correct exeuction. 
 */
class RTIClient extends EventEmitter {

    // ID of this federate.
    private id:number;         
    
    // The socket descriptor for communicating with this federate.
    private socket: Socket | null = null;

    // The mapping between a federate port ID and the federate port action
    // scheduled upon reception of a message designated for that federate port.
    private federatePortActionByID: Map<number, Action<Buffer>> = new Map<number, Action<Buffer>>();

    /**
     * Establish the mapping between a federate port's action and its ID.
     * @param federatePortID The federate port's ID.
     * @param federatePort The federate port's action.
     */
    public registerFederatePortAction<T extends Present>(federatePortID: number, federatePortAction: Action<Buffer>) {
        this.federatePortActionByID.set(federatePortID, federatePortAction);
    }

    /**
     * Constructor for an RTIClient
     * @param id The ID of the federate this client communicates
     * on behalf of.
     */
    public constructor (id: number) {
        super();
        this.id = id;
    }

    // If the last data sent to handleSocketData contained an incomplete
    // or chunked message, that data is copied over to chunkedBuffer so it can
    // be saved until the next time handleSocketData is called. If no data has been
    // saved, chunkedBuffer is null.
    private chunkedBuffer : Buffer | null = null;

    // The number of attempts made by this federate to connect to the RTI.
    private connectionAttempts = 0;

    /** 
     *  Create a socket connection to the RTI and register this federate's
     *  ID with the RTI. If unable to make a connection, retry.
     *  @param port The RTI's remote port number.
     *  @param host The RTI's remote host name. 
     */
    public connectToRTI(port: number, host: string) {
        // Create an IPv4 socket for TCP (not UDP) communication over IP (0)
    
        let thiz = this;

        const options: SocketConnectOpts = {
            "port": port,
            "family": 4, // IPv4,
            "localAddress": "0.0.0.0", // All interfaces, 0.0.0.0.
            "host": host
        }

        this.socket = createConnection(options, () => {
            // This function is a listener to the 'connection' socket
            // event.

            // Only set up an event handler for close if the connection is
            // created. Otherwise this handler will go off on every reconnection
            // attempt.
            this.socket?.on('close', () => {
                Log.info(this, () => {return 'RTI socket has closed.'});
            });

            // Immediately send a FED ID message after connecting.
            const buffer = Buffer.alloc(5);
            buffer.writeUInt8(RTIMessageTypes.FED_ID, 0);
            buffer.writeUInt32LE(this.id, 1);
            try {
                Log.debug(this, () => {return 'Sending a FED ID message to the RTI.'});
                this.socket?.write(buffer);
            } catch (e) {
                Log.error(this, () => {return e.toString()});
            }

            // Finally, emit a connected event.
            this.emit('connected');
        });

        this.socket?.on('data', thiz.handleSocketData.bind(thiz));

        // If the socket reports a connection refused error,
        // suppress the message and try to reconnect.
        this.socket?.on('error', (err: Error ) => {
            if (isANodeJSCodedError(err) && err.code === 'ECONNREFUSED' ) {
                Log.info(this, () => {
                    return `Failed to connect to RTI with error: ${err}.`
                })
                if (this.connectionAttempts < CONNECT_NUM_RETRIES) {
                    Log.info(this, () => {return `Retrying RTI connection in ${CONNECT_RETRY_INTERVAL}.`})
                    this.connectionAttempts++;
                    let a = new Alarm();
                    a.set(this.connectToRTI.bind(this, port, host), CONNECT_RETRY_INTERVAL)
                } else {
                    Log.error(this, () => {return `Could not connect to RTI after ${CONNECT_NUM_RETRIES} attempts.`})
                }
            } else {
                Log.error(this, () => {return err.toString()})
            }
        });
    }

    /**
     * Destroy the RTI Client's socket connection to the RTI.
     */
    public closeRTIConnection() {
        Log.debug( this, () => {return 'Closing RTI connection by destroying and unrefing socket.'});
        this.socket?.destroy();
        this.socket?.unref(); // Allow the program to exit
    }

    /** 
     *  Send the specified TimeValue to the RTI and set up
     *  a handler for the response.
     *  The specified TimeValue should be current physical time of the
     *  federate, and the response will be the designated start time for
     *  the federate. May only be called after the federate emits a
     *  'connected' event. When the RTI responds, this federate will
     *  emit a 'startTime' event.
     *  @param myPhysicalTime The physical time at this federate.
     */
    public requestStartTimeFromRTI(myPhysicalTime: TimeValue) {
        let msg = Buffer.alloc(9)
        msg.writeUInt8(RTIMessageTypes.TIMESTAMP, 0);
        let time = myPhysicalTime.get64Bit();
        time.copy(msg, 1);
        try {
            Log.debug(this, () => {return `Sending RTI start time: ${myPhysicalTime}`});
            this.socket?.write(msg);
        } catch (e) {
            Log.error(this, () => {return e});
        }
    }

    /**
     * Send an RTI (untimed) message to a remote federate.
     * @param data The message encoded as a Buffer. The data may be
     * arbitrary length.
     * @param destFederateID The federate ID of the federate
     * to which this message should be sent.
     * @param destPortID The port ID for the port on the destination
     * federate to which this message should be sent.
     */
    public sendRTIMessage(data: Buffer, destFederateID: number, destPortID: number) {
        let msg = Buffer.alloc(data.length + 9);
        msg.writeUInt8(RTIMessageTypes.MESSAGE, 0);
        msg.writeUInt16LE(destPortID, 1);
        msg.writeUInt16LE(destFederateID, 3);
        msg.writeUInt32LE(data.length, 5);
        data.copy(msg, 9); // Copy data into the message
        try {
            Log.debug(this, () => {return `Sending RTI (untimed) message to `
                + `federate ID: ${destFederateID} and port ID: ${destPortID}.`});
            this.socket?.write(msg);
        } catch (e) {
            Log.error(this, () => {return e});
        }
    }

    /**
     * Send an RTI timed message to a remote federate.
     * @param data The message encoded as a Buffer. The data may be
     * arbitrary length.
     * @param destFederateID The federate ID of the federate
     * to which this message should be sent.
     * @param destPortID The port ID for the port on the destination
     * federate to which this message should be sent.
     * @param time The time of the message encoded as a 64 bit little endian
     * unsigned integer in a Buffer.
     */
    public sendRTITimedMessage(data: Buffer, destFederateID: number, destPortID: number, time: Buffer) {
        let msg = Buffer.alloc(data.length + 17);
        msg.writeUInt8(RTIMessageTypes.TIMED_MESSAGE, 0);
        msg.writeUInt16LE(destPortID, 1);
        msg.writeUInt16LE(destFederateID, 3);
        msg.writeUInt32LE(data.length, 5);
        time.copy(msg, 9); // Copy the current time into the message
        data.copy(msg, 17); // Copy data into the message
        try {
            Log.debug(this, () => {return `Sending RTI (timed) message to `
                + `federate ID: ${destFederateID}, port ID: ${destPortID} `
                + `, time: ${time.toString('hex')}.`});
            this.socket?.write(msg);
        } catch (e) {
            Log.error(this, () => {return e});
        }
    }

    /**
     * Send the RTI a logical time complete message. This should be
     * called when the federate has completed all events for a given
     * logical time.
     * @param completeTime The logical time that is complete. The time
     * should be encoded as a 64 bit little endian unsigned integer in
     * a Buffer.
     */
    public sendRTILogicalTimeComplete(completeTime: Buffer) {
        let msg = Buffer.alloc(9);
        msg.writeUInt8(RTIMessageTypes.LOGICAL_TIME_COMPLETE, 0);
        completeTime.copy(msg, 1);
        try {
            Log.debug(this, () => {return "Sending RTI logical time complete: " + completeTime.toString('hex');});
            this.socket?.write(msg);
        } catch (e) {
            Log.error(this, () => {return e});
        }
    }

    /**
     * Send the RTI a resign message. This should be called when
     * the federate is shutting down.
     */
    public sendRTIResign() {
        let msg = Buffer.alloc(1);
        msg.writeUInt8(RTIMessageTypes.RESIGN, 0);
        try {
            Log.debug(this, () => {return "Sending RTI resign.";});
            this.socket?.write(msg);
        } catch (e) {
            Log.error(this, () => {return e});
        }
    }

    /**
     * Send the RTI a next event time message. This should be called when
     * the federate would like to advance logical time, but has not yet
     * received a sufficiently large time advance grant.
     * @param nextTime The time of the message encoded as a 64 bit unsigned
     * integer in a Buffer.
     */
    public sendRTINextEventTime(nextTime: Buffer) {
        let msg = Buffer.alloc(9);
        msg.writeUInt8(RTIMessageTypes.NEXT_EVENT_TIME, 0);
        nextTime.copy(msg,1);
        try {
            Log.debug(this, () => {return "Sending RTI Next Event Time.";});
            this.socket?.write(msg);
        } catch (e) {
            Log.error(this, () => {return e});
        }
    }

    /**
     * The handler for the socket's data event. 
     * The data Buffer given to the handler may contain 0 or more complete messages.
     * Iterate through the complete messages, and if the last message is incomplete
     * save it as thiz.chunkedBuffer so it can be prepended onto the
     * data when handleSocketData is called again.
     * @param assembledData The Buffer of data received by the socket. It may
     * contain 0 or more complete messages.
     */
    private handleSocketData(data: Buffer) {
        let thiz = this;
        if (data.length < 1) {
            throw new Error( `Received a message from the RTI with 0 length.`);
        }

        // Used to track the current location within the data Buffer.
        let bufferIndex = 0;

        // Append the new data to leftover data from chunkedBuffer (if any)
        // The result is assembledData.
        let assembledData: Buffer;

        if (thiz.chunkedBuffer) {
            assembledData = Buffer.alloc(thiz.chunkedBuffer.length + data.length);
            thiz.chunkedBuffer.copy(assembledData, 0, 0, thiz.chunkedBuffer.length);
            data.copy(assembledData, thiz.chunkedBuffer.length);
            thiz.chunkedBuffer = null;
        } else {
            assembledData = data;
        }
        Log.debug(thiz, () => {return `Assembled data is: ${assembledData.toString('hex')}`});

        while (bufferIndex < assembledData.length) {
            
            let messageTypeByte = assembledData[bufferIndex]
            switch (messageTypeByte) {
                case RTIMessageTypes.FED_ID: {
                    // MessageType: 1 byte.
                    // Federate ID: 2 bytes long.
                    // Should never be received by a federate.
                    
                    Log.error(thiz, () => {return "Received FED_ID message from the RTI."});     
                    throw new Error('Received a FED_ID message from the RTI. ' 
                        + 'FED_ID messages may only be sent by federates');
                    break;
                }
                case RTIMessageTypes.TIMESTAMP: {
                    // MessageType: 1 byte.
                    // Timestamp: 8 bytes.

                    let incomplete = assembledData.length < 9 + bufferIndex;

                    if (incomplete) {
                        thiz.chunkedBuffer = Buffer.alloc(assembledData.length - bufferIndex);
                        assembledData.copy(thiz.chunkedBuffer, 0, bufferIndex)
                    } else {
                        let timeBuffer = Buffer.alloc(8);
                        assembledData.copy(timeBuffer, 0, bufferIndex + 1, bufferIndex + 9 );
                        let startTime = new BinaryTimeValue(timeBuffer);
                        Log.debug(thiz, () => { return "Received TIMESTAMP buffer from the RTI " +
                        `with startTime: ${timeBuffer.toString('hex')}`;      
                        })
                        Log.debug(thiz, () => { return "Received TIMESTAMP message from the RTI " +
                            `with startTime: ${startTime}`;      
                        })
                        thiz.emit('startTime', startTime);
                    }

                    bufferIndex += 9;
                    break;
                }
                case RTIMessageTypes.MESSAGE: {
                    // MessageType: 1 byte.
                    // Message: The next two bytes will be the ID of the destination port
                    // The next two bytes are the destination federate ID (which can be ignored).
                    // The next four bytes after that will be the length of the message
                    // The remaining bytes are the message.

                    let incomplete = assembledData.length < 9 + bufferIndex;

                    if (incomplete) {
                        thiz.chunkedBuffer = Buffer.alloc(assembledData.length - bufferIndex);
                        assembledData.copy(thiz.chunkedBuffer, 0, bufferIndex)
                        bufferIndex += 9;
                    } else {
                        let destPortID = assembledData.readUInt16LE(bufferIndex + 1);
                        let messageLength = assembledData.readUInt32LE(bufferIndex + 5);

                        // Once the message length is parsed, we can determine whether
                        // the body of the message has been chunked.
                        let isChunked = messageLength > (assembledData.length - (bufferIndex + 9));

                        if (isChunked) {
                            // Copy the unprocessed remainder of assembledData into chunkedBuffer
                            thiz.chunkedBuffer = Buffer.alloc(assembledData.length - bufferIndex);
                            assembledData.copy(thiz.chunkedBuffer, 0, bufferIndex);
                        } else {
                            // Finish processing the complete message.
                            let messageBuffer = Buffer.alloc(messageLength);
                            assembledData.copy(messageBuffer, 0, bufferIndex + 9, bufferIndex + 9 + messageLength);  
                            let destPortAction = thiz.federatePortActionByID.get(destPortID);
                            thiz.emit('message', destPortAction, messageBuffer);
                        }

                        bufferIndex += messageLength + 9;
                    }
                    break;
                }
                case RTIMessageTypes.TIMED_MESSAGE: {
                    // MessageType: 1 byte.
                    // The next two bytes will be the ID of the destination port.
                    // The next two bytes are the destination federate ID.
                    // The next four bytes after that will be the length of the message
                    // The next eight bytes will be the timestamp.
                    // The remaining bytes are the message.

                    let incomplete = assembledData.length < 17 + bufferIndex;

                    if (incomplete) {
                        thiz.chunkedBuffer = Buffer.alloc(assembledData.length - bufferIndex);
                        assembledData.copy(thiz.chunkedBuffer, 0, bufferIndex)
                        bufferIndex += 17;
                    } else {
                        let destPortID = assembledData.readUInt16LE(bufferIndex + 1);
                        let messageLength = assembledData.readUInt32LE(bufferIndex + 5);

                        let timeBuffer = Buffer.alloc(8);
                        assembledData.copy(timeBuffer, 0, bufferIndex + 9, bufferIndex + 17 );
                        let timestamp = new BinaryTimeValue(timeBuffer);

                        let isChunked = messageLength > (assembledData.length - (bufferIndex + 17));

                        if (isChunked) {
                            // Copy the unprocessed remainder of assembledData into chunkedBuffer
                            thiz.chunkedBuffer = Buffer.alloc(assembledData.length - bufferIndex);
                            assembledData.copy(thiz.chunkedBuffer, 0, bufferIndex)
                        } else {
                            // Finish processing the complete message.
                            let messageBuffer = Buffer.alloc(messageLength);
                            assembledData.copy(messageBuffer, 0, bufferIndex + 17, bufferIndex + 17 +  messageLength);  
                            let destPort = thiz.federatePortActionByID.get(destPortID);
                            thiz.emit('timedMessage', destPort, messageBuffer, timestamp);
                        }

                        bufferIndex += messageLength + 17;
                        break;
                    }
                }
                // FIXME: It's unclear what should happen if a federate gets this
                // message.
                case RTIMessageTypes.RESIGN: {
                    // MessageType: 1 byte.
                    Log.debug(thiz, () => {return 'Received an RTI RESIGN.'});
                    Log.error(thiz, () => {return 'FIXME: No functionality has '
                        + 'been implemented yet for a federate receiving a RESIGN message from '
                        + 'the RTI'});
                    bufferIndex += 1;
                    break;
                }
                case RTIMessageTypes.NEXT_EVENT_TIME: {
                    // MessageType: 1 byte.
                    // Timestamp: 8 bytes.
                    Log.error(thiz, () => {return 'Received an RTI NEXT_EVENT_TIME. This message type '
                        + 'should not be received by a federate'});
                    bufferIndex += 9;
                    break;
                }
                case RTIMessageTypes.TIME_ADVANCE_GRANT: {
                    // MessageType: 1 byte.
                    // Timestamp: 8 bytes.
                    let incomplete = assembledData.length < 9 + bufferIndex;

                    if (incomplete) {
                        thiz.chunkedBuffer = Buffer.alloc(assembledData.length - bufferIndex);
                        assembledData.copy(thiz.chunkedBuffer, 0, bufferIndex)
                    } else {
                        Log.debug(thiz, () => {return 'Received an RTI TIME_ADVANCE_GRANT'});
                        let timeBuffer = Buffer.alloc(8);
                        assembledData.copy(timeBuffer, 0, bufferIndex + 1, bufferIndex + 9);
                        let time = new BinaryTimeValue(timeBuffer);
                        thiz.emit('timeAdvanceGrant', time);
                    }
                    bufferIndex += 9;
                    break;
                }
                case RTIMessageTypes.LOGICAL_TIME_COMPLETE: {
                    // Logial Time Complete: The next eight bytes will be the timestamp.
                    Log.error(thiz, () => {return 'Received an RTI LOGICAL_TIME_COMPLETE.  This message type '
                        + 'should not be received by a federate'});
                    bufferIndex += 9;
                    break;
                }
                default: {
                    throw new Error(`Unrecognized message type in message from the RTI: ${assembledData.toString('hex')}.`)
                }
            }
        }
        Log.debug(thiz, () => {return 'exiting handleSocketData'})
    }
}

/**
 * A federated app is an app containing federates as its top level reactors.
 * A federate is a component in a distributed reactor execution in which
 * reactors from the same (abstract) model run in distinct networked processes.
 * A federated app contains the federates designated to run in a particular
 * process. The federated program is coordinated by the RTI (Run Time Infrastructure).
 * Like an app, a federated app is the top level reactor for a particular process,
 * but a federated app must follow the direction of the RTI for beginning execution,
 * advancing time, and exchanging messages with other federates.
 * 
 * Note: There is no special class for a federate. A federate is the name for a top
 * level reactor of a federated app.
 */
export class FederatedApp extends App {

    /**
     * A federate's rtiClient establishes the federate's connection to
     * the RTI (Run Time Infrastructure). When socket events occur,
     * the rtiClient processes socket-level data into events it emits at the
     * Federate's level of abstraction.
     */
    private rtiClient: RTIClient;

    /**
     * If a federated app uses logical connections, its execution 
     * with respect to time advancement must be sychronized with the RTI.
     * If this variable is true, logical time in this federate
     * cannot advance beyond the time given in the greatest Time Advance Grant
     * sent from the RTI.
     */
    private rtiSynchronized: boolean = false;

    /**
     * The largest time advance grant received so far from the RTI,
     * or null if no time advance grant has been received yet.
     * An RTI synchronized Federate cannot advance its logical time
     * beyond this value.
     */
    private greatestTimeAdvanceGrant: TimeValue | null = null;

    /**
     * Getter for rtiSynchronized
     */
    public _isRTISynchronized() {
        return this.rtiSynchronized;
    }

    /**
     * Getter for greatestTimeAdvanceGrant
     */
    public _getGreatestTimeAdvanceGrant() {
        return this.greatestTimeAdvanceGrant;
    }

    /**
     * Return whether the next event can be handled, or handling the next event
     * has to be postponed to a later time.
     * 
     * If this federated app has not received a sufficiently large time advance
     * grant (TAG) from the RTI for the next event, send it a Next Event Time
     * (NET) message and return. _next() will be called when a new greatest TAG
     * is received. The NET message is not sent if the connection to the RTI is
     * closed. FIXME: what happens in that case? Will next be called?
     * @param event 
     */
    protected canProceed(event: TaggedEvent<Present>) {
        if (this._isRTISynchronized() && this._isActive()) {
            // FIXME: Why would it proceed if the reaction is inactive?
            let greatestTAG = this._getGreatestTimeAdvanceGrant();
            let nextTime = event.tag.time;
            if (greatestTAG === null || greatestTAG.isEarlierThan(nextTime)) {
                this.sendRTINextEventTime(nextTime);
                Log.debug(this, () => "The greatest time advance grant \
                received from the RTI is less than the timestamp of the \
                next event on the event queue");
                Log.global.debug("Exiting _next.");
                return false;
            }
        }
        return true
    }

    protected finalizeStep(nextTag: Tag) {
        let currentTime = this.util.getCurrentLogicalTime()
        if (currentTime.isEarlierThan(nextTag.time)) {
            // Tell the RTI logical time is being advanced to a greater value.
            this.sendRTILogicalTimeComplete(currentTime);
        }
    }

    protected _doShutdown() {
        this.sendRTILogicalTimeComplete(this.util.getCurrentLogicalTime());
        this.sendRTIResign();
        this.shutdownRTIClient();
        super._doShutdown()
    }

    // FIXME: Some of the App settings (like fast) are probably incompatible
    // with federated execution.

    /**
     * Federated app constructor. The primary difference from an App constructor
     * is the federateID and the rtiPort. 
     * @param federateID The ID for the federate assigned to this federatedApp.
     * For compatability with the C RTI the ID must be expressable as a 16 bit
     * unsigned short. The ID must be unique among all federates and be a number
     * between 0 and NUMBER_OF_FEDERATES - 1.
     * @param rtiPort The network socket port for communication with the RTI.
     * @param rtiHost The network host (IP address) for communication with the RTI.
     * @param executionTimeout Terminate execution after the designated delay.
     * @param keepAlive Continue execution when the event loop is empty.
     * @param fast Execute as fast as possible, allowing logical time to exceed physical time.
     * @param success Optional argument. Called when the FederatedApp exits with success.
     * @param failure Optional argument. Called when the FederatedApp exits with failure.
     */
    constructor (federateID: number, private rtiPort: number, private rtiHost: string,
        executionTimeout?: TimeValue | undefined, keepAlive?: boolean,
        fast?: boolean, success?: () => void, failure?: () => void) {
        
        super(executionTimeout, keepAlive, fast, success, failure);
        this.rtiClient = new RTIClient(federateID);
    }

    /**
     * Register a federate port's action with the federate. It must be registered
     * so it is known by the rtiClient and may be scheduled when a message for the
     * port has been received via the RTI. If at least one of a federate's actions
     * is logical, signifying a logical connection to the federate's port,
     * this FederatedApp must be made RTI synchronized. The advancement of time in
     * an RTI synchronized FederatedApp is managed by the RTI.
     * @param federatePortID The designated ID for the federate port. For compatability with the
     * C RTI, the ID must be expressable as a 16 bit unsigned short. The ID must be
     * unique among all port IDs on this federate and be a number between 0 and NUMBER_OF_PORTS - 1
     * @param federatePort The federate port's action for registration.
     */
    public registerFederatePortAction(federatePortID: number, federatePortAction: Action<Buffer>) {
        if (federatePortAction.origin === Origin.logical) {
            this.rtiSynchronized = true;
        }
        this.rtiClient.registerFederatePortAction(federatePortID, federatePortAction);
    }

    /**
     * Send a message to a potentially remote federate's port via the RTI. This message
     * is untimed, and will be timestamped by the destination federate when it is received.
     * @param msg The message encoded as a Buffer.
     * @param destFederateID The ID of the federate intended to receive the message.
     * @param destPortID The ID of the federate's port intended to receive the message.
     */
    public sendRTIMessage(msg: Buffer, destFederateID: number, destPortID: number ) {
        Log.debug(this, () => {return `Sending RTI message to federate ID: ${destFederateID}`
            + ` port ID: ${destPortID}`});
        this.rtiClient.sendRTIMessage(msg, destFederateID, destPortID);
    }

    /**
     * Send a timed message to a potentially remote FederateInPort via the RTI.
     * This message is timed, meaning it carries the logical timestamp of this federate
     * when this function is called.
     * @param msg The message encoded as a Buffer.
     * @param destFederateID The ID of the Federate intended to receive the message.
     * @param destPortID The ID of the FederateInPort intended to receive the message.
     */
    public sendRTITimedMessage(msg: Buffer, destFederateID: number, destPortID: number ) {
        let time = this.util.getCurrentLogicalTime().get64Bit();
        Log.debug(this, () => {return `Sending RTI timed message to federate ID: ${destFederateID}`
            + ` port ID: ${destPortID} and time: ${time.toString('hex')}`});
        this.rtiClient.sendRTITimedMessage(msg, destFederateID, destPortID, time);
    }

    /**
     * Send a logical time complete message to the RTI. This should be called whenever
     * this federate is ready to advance beyond the given logical time.
     * @param completeTimeValue The TimeValue that is now complete.
     */
    public sendRTILogicalTimeComplete(completeTimeValue: TimeValue) {
        let time = completeTimeValue.get64Bit();
        Log.debug(this, () => {return `Sending RTI logical time complete with time: ${completeTimeValue}`});
        this.rtiClient.sendRTILogicalTimeComplete(time)
    }

    /**
     * Send a resign message to the RTI. This message indicates this federated
     * app is shutting down, and should not be directed any new messages.
     */
    public sendRTIResign() {
        this.rtiClient.sendRTIResign();
    }

    /**
     * Send a next event time message to the RTI. This should be called
     * when this federated app is unable to advance logical time beause it
     * has not yet received a sufficiently large time advance grant.
     * @param nextTime The time to which this federate would like to
     * advance logical time.
     */
    public sendRTINextEventTime(nextTime: TimeValue) {
        let time = nextTime.get64Bit();
        Log.debug(this, () => {return `Sending RTI next event time with time: ${time.toString('hex')}`});
        this.rtiClient.sendRTINextEventTime(time);
    }

    /**
     * Shutdown the RTI Client by closing its socket connection to
     * the RTI.
     */
    public shutdownRTIClient() {
        this.rtiClient.closeRTIConnection();
    }

    /**
     * @override
     * Register this federated app with the RTI and request a start time.
     * This function registers handlers for the events produced by the federated app's
     * rtiClient and connects to the RTI. The federated app cannot schedule
     * the start of the runtime until the rtiClient has received a start
     * time message from the RTI.
     */
    _start() {
        this._checkPrecedenceGraph();
        this.rtiClient.on('connected', () => {
            this.rtiClient.requestStartTimeFromRTI(getCurrentPhysicalTime());
        });

        this.rtiClient.on('startTime', (startTime: TimeValue) => {
            if (startTime) {
                Log.info(this, () => Log.hr);
                Log.info(this, () => Log.hr);
                Log.info(this, () => {return `Scheduling federate start for ${startTime}`;});
                Log.info(this, () => Log.hr);

                // Set an alarm to start execution at the designated startTime
                let currentPhysTime = getCurrentPhysicalTime();
                let startDelay : TimeValue;
                if (startTime.isEarlierThan(currentPhysTime)) {
                    startDelay = new TimeValue(0);
                } else {
                    startDelay = startTime.subtract(currentPhysTime);
                }
                this.alarm.set(() => {
                    this._alignStartAndEndOfExecution(startTime);
                    this._scheduleStartup();
                }, startDelay);
            } else {
                throw Error("RTI start time is not known.")
            }
        });

        this.rtiClient.on('message', (destPortAction: Action<Buffer>, messageBuffer: Buffer) => {
            // Schedule this federate port's action.
            // This message is untimed, so schedule it immediately.
            Log.debug(this, () => {return `(Untimed) Message received from RTI.`})
            destPortAction.asSchedulable(this._getKey(destPortAction)).schedule(0, messageBuffer);
        });

        this.rtiClient.on('timedMessage', (destPortAction: Action<Buffer>, messageBuffer: Buffer,
            timestamp: TimeValue) => {
            // Schedule this federate port's action.

            /**
             *  Definitions:
             * Ts = timestamp of message at the sending end.
             * A = after value on connection
             * Tr = timestamp assigned to the message at the receiving end.
             * r = physical time at the receiving end when message is received (when schedule() is called).
             * R = logical time at the receiving end when the message is received (when schedule() is called).

             * We assume that always R <= r.

             * Logical connection, centralized control: Tr = Ts + A
             * Logical connection, decentralized control: Tr = Ts + A or, if R > Ts + A, 
             *  ERROR triggers at a logical time >= R
             * Physical connection, centralized or decentralized control: Tr = max(r, R + A)
             * 
             */
           

            // FIXME: implement decentralized control.

            Log.debug(this, () => {return `Timed Message received from RTI with timestamp ${timestamp}.`})
            if (destPortAction.origin == Origin.logical) {
                // delay together with the schedule function for logical actions implements
                // Tr = Ts + A
                let delay = timestamp.subtract(this.util.getCurrentLogicalTime());
                destPortAction.asSchedulable(this._getKey(destPortAction)).schedule(delay, messageBuffer);

            } else {
                // The schedule function for physical actions implements
                // Tr = max(r, R + A)
                destPortAction.asSchedulable(this._getKey(destPortAction)).schedule(0, messageBuffer);
            }
        });

        this.rtiClient.on('timeAdvanceGrant', (time: TimeValue) => {
            Log.debug(this, () => {return `Time Advance Grant received from RTI for ${time}.`});
            if (this.greatestTimeAdvanceGrant === null || this.greatestTimeAdvanceGrant?.isEarlierThan(time)) {
                // Update the greatest time advance grant and immediately 
                // wake up _next, in case it was blocked by the old time advance grant
                this.greatestTimeAdvanceGrant = time;
                this._setImmediateForNext();
            }
        });

        this.rtiClient.connectToRTI(this.rtiPort, this.rtiHost);
        Log.info(this, () => {return `Connecting to RTI on port: ${this.rtiPort}`});
    }
}

/**
 * A RemoteFederatePort represents a FederateInPort in another federate.
 * It contains the information needed to address RTI messages to the remote
 * port.
 */
export class RemoteFederatePort {
    constructor(public federateID: number, public portID: number) {}
}
