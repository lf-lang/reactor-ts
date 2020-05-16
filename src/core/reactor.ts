/**
 * Core of the reactor runtime.
 * 
 * @author Marten Lohstroh (marten@berkeley.edu),
 * @author Matt Weber (matt.weber@berkeley.edu)
 */

import {Sortable, PrioritySetNode, PrioritySet, SortableDependencyGraph, Log, DependencyGraph} from './util';
import {TimeValue, TimeUnit, Tag, Origin, getCurrentPhysicalTime, UnitBasedTimeValue, Alarm } from './time';

// Set the default log level.
Log.global.level = Log.levels.DEBUG;

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
    Write<unknown> | ReadWrite<unknown> | // FIXME: reduce this to just Read<unknown>
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
    
    /** 
     * Return the alternative name for this object if set, 
     * an empty string otherwise. 
     */
    getAlias(): string;

    /**
     * Return the fully qualified name of this object.
     */ 
    getFullyQualifiedName(): string;

    /**
     * Return this name of this object.
     **/
    getName(): string;

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
export interface Schedule<T extends Present> {
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
    //abstract get(): T | undefined;
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
    protected alias: string | undefined;

    protected key: Symbol = Symbol()

    /**
     * Function for staging reactions for execution at the current logical time.
     */
    protected stage: ((reaction: Reaction<unknown>) => void);

    protected __container__: Reactor;

    constructor(__container__: Reactor | null, alias?:string) {
        this.alias = alias

        if (this instanceof App) {
            this.__container__ = this       // Apps are self-contained.
            this.stage = this.getLoader()   // Loader inherited from the app.
        } else {
            if (__container__ !== null) {
                this.__container__ = __container__  // Set the container.
                this.__container__._register(this, this.key) // Register.
                this.stage = __container__.stage   // Inherited the loader.
            } else {
                throw Error("Cannot instantiate component without a parent.")
            }
        }
    }

    public isChildOf(r: Reactor): boolean {

        if (this instanceof App) return false
        
        if (this.__container__ === r) return true
    
        return false
    }

    public isGrandChildOf(r: Reactor): boolean {
        if (this instanceof App) return false
        
        if (this.__container__.isChildOf(r)) return true;
    
        return false;
    }

    /**
     * Return a string that identifies this component.
     * The name is a path constructed as App/.../Container/ThisComponent
     */
    getFullyQualifiedName(): string {
        var path = "";
        if (!(this instanceof App)) {
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

        var name = ""
        if (!(this instanceof App)) {
            for (const [key, value] of Object.entries(this.__container__)) {
                if (value === this) {
                    name = `${key}`
                    break
                }
            }
        }

        if (this.alias) {
            if (name == "") {
                name = this.alias
            } else {
                name += ` (${this.alias})`
            }
        }
        // Return the constructor name in case the component wasn't found in its
        // container and doesn't have an alias.
        if (name == "") {
            name = this.constructor.name
        }
        
        return name
    }

    public getAlias(): string {
        if (this.alias) return this.alias
        else return ""
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
export class Reaction<T> implements Sortable<Priority>, PrioritySetNode<Priority> {

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

    // getDependencies(): [Set<Variable>, Set<Variable>] {
    //     var deps: Set<Variable> = new Set();
    //     var antideps: Set<Variable> = new Set();
    //     var vars = new Set();
    //     for (let a of this.args.tuple.concat(this.trigs.list)) {
    //         if (a instanceof IOPort) {
    //             if (this.reactor._isUpstream(a)) {
    //                 deps.add(a);
    //             }
    //             if (this.reactor._isDownstream(a)) {
    //                 antideps.add(a);
    //             }
    //         } else if (a instanceof WritablePort) {
    //             if (this.reactor._isDownstream(a.getPort())) {
    //                 antideps.add(a.getPort());
    //             }
    //         } else {
    //             // Handle hierarchical references.
    //             for (let p of Object.getOwnPropertyNames(a)) { // FIXME: remove this
    //                 let prop = Object.getOwnPropertyDescriptor(a, p);
    //                 if (prop?.value instanceof Port) {
    //                     if (this.reactor._isUpstream(prop.value)) {
    //                         deps.add(prop.value);
    //                     }
    //                     if (this.reactor._isDownstream(prop.value)) {
    //                         antideps.add(prop.value);
    //                     }
    //                 }
    //             }
    //         }
    //     }
    //     return [deps, antideps];
    // }

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
    public setDeadline(deadline: TimeValue): this {
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

    /**
     * Reactions to trigger.
     */
    protected reactions: Set<Reaction<unknown>> = new Set();

    abstract getManager(key: Symbol | undefined): TriggerManager;

    public getContainer(): Reactor | null {
        return this.__container__
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

        if (!e.tag.isSimultaneousWith(this.__container__.util.getCurrentTag())) {
            throw new Error("Time of event does not match current logical time.");
        }
        if (e.trigger === this) {
            this.value = e.value
            this.tag = e.tag;
            for (let r of this.reactions) {
                this.stage(r)
            }
        } else {
            throw new Error("Attempt to update action using incompatible event.");
        }
    }

    public getManager(key: Symbol | undefined): TriggerManager {
        if (this.key == key) {
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
        if (this.tag.isSimultaneousWith(this.__container__.util.getCurrentTag())) {
            return true;
        } else {
            return false;
        }
    }

    protected manager = new class implements TriggerManager {
        constructor(private trigger: ScheduledTrigger<T>) { }
        getContainer(): Reactor {
            return this.trigger.__container__
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
        if (this.key === key) {
            return this.scheduler
        }
        throw Error("Invalid reference to container.")
    }

    public getManager(key: Symbol | undefined): TriggerManager {
        if (this.key == key) {
            return this.manager
        }
        throw Error("Unable to grant access to manager.")
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

    // NOTE: put this first because components may attempt to register and need access to this datastructore
    private keys: Map<Component, Symbol> = new Map()

    /**
     * This graph has in it all the dependencies implied by this reactor's
     * ports, reactions, and connections.
     */
    private dependencyGraph: DependencyGraph<Port<Present> | Reaction<unknown>> = new DependencyGraph()

    /**
     * This graph has some overlap with the reactors dependency, but is 
     * different in two respects:
     * - transitive dependencies between ports have been collapsed; and
     * - it incorporates the causality interfaces of all contained reactors.
     * It thereby carries enough information to find out whether adding a new
     * connection at runtime could result in a cyclic dependency, _without_ 
     * having to consult other reactors.
     */
    private causalityGraph: DependencyGraph<Port<Present>> = new DependencyGraph()

    // FIXME: to do runtime checks, filter out the ports/reactions that are not
    // of this reactor, collapse dependencies between ports that go through a reaction,
    // and plug causality interfaces obtained from contained reactors.
    
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
        if (!this.keys.has(component)) this.keys.set(component, key)
    }

    protected _getLast(reactions: Set<Reaction<any>>): Reaction<unknown> | undefined {
        let index = -1
        let all = this._getReactionsAndMutations()

        for (let reaction of reactions) {
            console.log(all.findIndex((r) => r === reaction))
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
    protected getKey(component: Trigger, key?: Symbol): Symbol | undefined {
        if (component.isChildOf(this) || this.key === key) {
            return this.keys.get(component)
        } else if ((component instanceof Startup || 
                    component instanceof Shutdown ||
                  !(component instanceof Action)) && 
                    component.isGrandChildOf(this)) {
            let owner = component.getContainer()
            if (owner !== null) {
                return owner.getKey(component, this.keys.get(owner))
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
     * @param __parent__ The container of this reactor.
     */
    constructor(__parent__: Reactor | null, alias?:string) {
        super(__parent__, alias);
        
        // Utils get passed down the hierarchy. If this is an App,
        // the container refers to this object, making the following
        // assignment idemponent.
        this.util = (this.__container__ as unknown as Reactor).util    
        
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

    protected getSchedulable<T extends Present>(action: Action<T>): Schedule<T> {
        return action.asSchedulable(this.keys.get(action));
    }

    private _recordDeps<T extends Variable[]>(reaction: Reaction<any>) {
        
        // Add a dependency on the previous reaction or mutation, if it exists.
        let prev = this._getLastReactionOrMutation()
        if (prev) {
            // FIXME: how does this affect the causality graph?
            // Will any effect of this reaction will now be depending
            // on the ports that its predecessors list as dependencies?
            this.dependencyGraph.addEdge(reaction, prev)
            
        }

        // Set up the triggers.
        for (let t of reaction.trigs.list) {
            // Link the trigger to the reaction.
            if (t instanceof Trigger) {
                t.getManager(this.getKey(t)).addReaction(reaction)
            }

            // Also record this trigger as a dependency.
            if (t instanceof IOPort) {
                this.dependencyGraph.addEdge(reaction, t)
                //this._addDependency(t, reaction);
            } else {
                Log.debug(this, () => ">>>>>>>> not a dependency: " + t);
            }
        }
        
        let sources = new Set<Port<any>>()
        let effects = new Set<Port<any>>()
    
        for (let a of reaction.args.tuple) {
            if (a instanceof IOPort) {
                this.dependencyGraph.addEdge(reaction, a)
                sources.add(a)
            }
            if (a instanceof CalleePort) {
                this.dependencyGraph.addEdge(a, reaction)
            }
            if (a instanceof CallerPort) {
                this.dependencyGraph.addEdge(reaction, a)
            }
            // Only necessary if we want to add actions to the dependency graph.
            if (a instanceof Action) {
                // dep
            }
            if (a instanceof SchedulableAction) {
                // antidep
            }
            if (a instanceof WritablePort) {
                this.dependencyGraph.addEdge(a.getPort(), reaction)
                effects.add(a.getPort())
            }
        }
        // Make effects dependent on sources.
        for (let effect of effects) {
            this.causalityGraph.addEdges(effect, sources)
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
            if (trigs.list.length > 1) {
                // A procedure can only have a single trigger.
                throw new Error("Procedure has multiple triggers.")
            }
            let port = calleePorts[0] as CalleePort<Present, Present>
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
            this._recordDeps(procedure);
            port.getManager(this.getKey(port)).setLastCaller(this._getLastReactionOrMutation())
            port.getManager(this.getKey(port)).addReaction(procedure as unknown as Reaction<unknown>) // FIXME: Tweak the manager API
            this._reactions.push(procedure);    
            //(calleePorts[0] as CalleePort<Present, Present>).update()
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
        
        graph.merge(this.dependencyGraph)

        if (depth > 0 || depth < 0) {
            if (depth > 0) {
                depth--
            }
            for (let r of this._getChildren()) {
                graph.merge(r.getPrecedenceGraph(depth));
            }
        }
        
        // Check if there are any callee ports owned by this reactor.
        // If there are, add a dependency from its last caller to the antidependencies
        // of the procedure (excluding the callee port itself).
        let calleePorts = this._findOwnCalleePorts()
        for (let p of calleePorts) {
            let procedure = p.getManager(this.getKey(p)).getProcedure()
            let lastCaller = p.getManager(this.getKey(p)).getLastCaller()
            if (procedure && lastCaller) {
                let antideps = graph.getBackEdges(procedure)
                console.log(">>>>>>>>>>>> last caller:" + lastCaller)
                for (let a of antideps) {
                    if (!(a instanceof CalleePort)) {
                        graph.addEdge(a, lastCaller)
                    }
                }
            } else {
                Error("No procedure")
            }
        }

        //this._collectDependencies(graph, this._getReactionsAndMutations())

        return graph;

    }
    
    private _startupChildren() {
        for (let r of this._getChildren()) {
            Log.debug(this, () => "Propagating startup: " + r.startup);
            // Note that startup reactions are scheduled without a microstep delay
            r.startup.asSchedulable(this.getKey(r.startup)).schedule(0, null)
        }
    }

    private _shutdownChildren() {
        Log.global.debug("Shutdown children was called")
        for (let r of this._getChildren()) {
            Log.debug(this, () => "Propagating shutdown: " + r.shutdown);
            r.shutdown.asSchedulable(this.getKey(r.shutdown)).schedule(0, null)
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
        
        // Validate connections between callers and callees.
        if (src instanceof CalleePort) {
            return false
        }
        if (src instanceof CallerPort) {
            if (dst instanceof CalleePort && 
                src.isGrandChildOf(this) && dst.isGrandChildOf(this)) {
                return true
            }
            return false
        }

        // Rule out write conflicts.
        //   - (between reactors)
        if (!(dst instanceof CalleePort) && 
                this.dependencyGraph.getBackEdges(dst).size > 0) {
            return false;
        }

        //   - between reactors and reactions (NOTE: check also needs to happen
        //     in addReaction)
        //var antideps = this._dependsOnReactions.get(dst);
        var deps = this.dependencyGraph.getEdges(dst) // FIXME this will change with multiplex ports
        if (deps != undefined && deps.size > 0) {
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
                // Register the caller in the callee reactor so that it can
                // establish dependencies on the callers.
                let calleeManager = dst.getManager(this.getKey(dst))
                let callerManager = src.getManager(this.getKey(src))
                let container = callerManager.getContainer()
                let callers = new Set<Reaction<any>>()
                
                //console.log(container.dependencyGraph.getBackEdges(src))
                container.dependencyGraph.getBackEdges(src).forEach((dep) => {if (dep instanceof Reaction) {callers.add(dep)}})
                console.log(callers)
                let first = container._getFirst(callers)
                console.log("first: \n" + first)
                let last = container._getLast(callers)
                console.log("last: \n" + last)
                let lastCaller = calleeManager.getLastCaller()
                if (lastCaller !== undefined) {
                    // This means the callee port is bound to a reaction and there may be zero or more callers.
                    // We now continue building a chain of callers. Ultimately, the last caller will be come a
                    // dependency of any reaction that might come after the 
                    if (first) {
                        this.dependencyGraph.addEdge(first, lastCaller)
                    } else {
                        this.dependencyGraph.addEdge(src, dst)
                    }
                    if (last)
                        calleeManager.setLastCaller(last)
                } else {
                    throw new Error("No procedure linked to callee port.")
                }
                

                // callerContainer?._dependsOnReactions.get(src)?.
                //         forEach((reaction) => callers?.add(reaction))

            } else if (src instanceof IOPort && dst instanceof IOPort) {
                Log.debug(this, () => "connecting " + src + " and " + dst);
                // Set up sources and destinations for value propagation.
                this.dependencyGraph.addEdge(dst, src);
                this.causalityGraph.addEdge(dst, src);

                src.getManager(this.getKey(src)).addReceiver(dst.asWritable(this.getKey(dst)) as WritablePort<S>);
                // this._destinationPorts.set(src, dests);
                // this._sourcePort.set(dst, src);
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
        let ifGraph = this.causalityGraph
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
                        search(output, self.dependencyGraph.getEdges(output))
                    }
                }
            }
        }

        // For each output, walk the graph and add dependencies to 
        // the inputs that are reachable.
        for (let output of outputs) {
            search(output, this.dependencyGraph.getEdges(output))
            visited.clear()
        }
        
        return ifGraph
    }

    protected _findOwnCalleePorts() {
        let ports = new Set<CalleePort<Present, Present>>()
        for(let component of this.keys.keys()) {
            if (component instanceof CalleePort) {
                ports.add(component)
            }
        }
        return ports
    }

    protected _findOwnInputs() {
        let inputs = new Set<InPort<Present>>()
        for(let component of this.keys.keys()) {
            if (component instanceof InPort) {
                inputs.add(component)
            }
        }
        return inputs
    }

    protected _findOwnOutputs() {
        let outputs = new Set<OutPort<Present>>()
        for(let component of this.keys.keys()) {
            if (component instanceof InPort) {
                outputs.add(component)
            }
        }
        return outputs
    }

    protected _findOwnReactors() {
        let reactors = new Set<Reactor>()
        for(let component of this.keys.keys()) {
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
        this.util.schedule(new TaggedEvent(timer, this.util.getCurrentTag().getLaterTag(timer.offset), null));
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
     * Iterate through this reactor's attributes and return the set of its
     * ports.
     * @deprecated
     */
    private _getPorts(): Set<Port<any>> { // FIXME: replace this
        // Log.global.debug("Getting ports for: " + this)
        let ports = new Set<Port<any>>();
        for (const [key, value] of Object.entries(this)) {
            if (value instanceof Port) {
                ports.add(value);
            }
        }
        return ports;
    }

    /**
     * Return the fully qualified name of this reactor.
     */
    toString(): string {
        return this.getFullyQualifiedName();
    }
}

export abstract class Port<T extends Present> extends Trigger implements Read<T> {
    
    /** The time stamp associated with this port's value. */
    protected tag: Tag | undefined;

    /** The value associated with this port. */
    protected value: T | Absent;

    abstract get(): T | undefined;

    abstract getManager(key: Symbol | undefined): PortManager<T>;

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
    public getManager(key: Symbol | undefined): PortManager<T> {
        if (this.key == key) {
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
            this.port.tag = this.port.__container__.util.getCurrentTag();
            // Set values in downstream receivers.
            this.port.receivers.forEach(p => p.set(value))
            // Stage triggered reactions for execution.
            this.port.reactions.forEach(r => this.port.stage(r))
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
        getContainer(): Reactor {
            return this.port.__container__
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
        return this.getFullyQualifiedName();
    }
}

interface TriggerManager {
    getContainer():Reactor;
    addReaction(reaction: Reaction<unknown>): void;
    delReaction(reaction: Reaction<unknown>): void;    
}

interface PortManager<T extends Present> extends TriggerManager {
    addReceiver(port: WritablePort<T>): void; // addLink(port:Port<T>) and iff WritablePort use as receiver (sender otherwise)
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
    public getManager(key: Symbol | undefined): PortManager<R> {
        if (this.key == key) {
            return this.manager
        }
        throw Error("Unable to grant access to manager.")
    }


    protected manager:PortManager<R> = new class implements PortManager<R> {
        constructor(private port:CallerPort<A, R>) {}
        getContainer(): Reactor {
            return this.port.__container__
        }
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

    toString() {
        return "CallerPort"
    }

}

interface CalleeManager<T extends Present> extends PortManager<T> {
    setLastCaller(reaction: Reaction<unknown> | undefined):void;
    getLastCaller(): Reaction<unknown> | undefined;
    getProcedure(): Reaction<unknown> | undefined;
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

    private lastCaller: Reaction<unknown> | undefined
    
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
    public getManager(key: Symbol | undefined): CalleeManager<A> {
        if (this.key == key) {
            return this.manager
        }
        throw Error("Unable to grant access to manager.")
    }

    protected manager:CalleeManager<A> = new class implements CalleeManager<A> {
        constructor(private port:CalleePort<A, Present>) {}
        getContainer(): Reactor {
            return this.port.__container__
        }
        addReceiver(port: WritablePort<A>): void {
            throw new Error("Method not implemented.");
        }
        delReceiver(port: WritablePort<A>): void {
            throw new Error("Method not implemented.");
        }
        addReaction(reaction: Reaction<unknown>): void {
            this.port.reaction = reaction
        }
        delReaction(reaction: Reaction<unknown>): void {
            throw new Error("Method not implemented.");
        }
        setLastCaller(reaction: Reaction<unknown> | undefined):void {
            this.port.lastCaller = reaction
        }
        getProcedure(): Reaction<unknown> | undefined {
            return this.port.reaction
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

    public getLoader(): (reaction: Reaction<unknown>) => void {
        return (r:Reaction<unknown>) => this._reactionQ.push(r);
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

    // /**
    //  * Report a timer to the app so that it gets scheduled.
    //  * @param timer The timer to report to the app.
    //  */
    // public _setTimer(timer: Timer) {
        
    // }


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
                    nextEvent.trigger.update(nextEvent);
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
                    this.snooze.asSchedulable(this.getKey(this.snooze)).schedule(0, this._currentTag);
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
            e.trigger.update(e)
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
        
        // Obtain the precedence graph, ensure it has no cycles, 
        // and assign a priority to each reaction in the graph.
        var apg = this.getPrecedenceGraph();

        Log.debug(this, () => apg.toString());
        var collapsed = new SortableDependencyGraph()
        
        // FIXME:
        // 1. Collapse dependencies and weed out the ports.
        let leafs = apg.leafNodes()

        console.log("leaf nodes: " + Array.from(leafs))

        let visited = new Set()

        function search(reaction: Reaction<unknown>, nodes: Set<Port<Present> | Reaction<unknown>>) {
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
        // FIXME: is there a way to do this without creating a whole new dependency
        
        Log.debug(this, () => collapsed.toString());

        if (collapsed.updatePriorities(true)) {
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
