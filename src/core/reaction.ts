import {
    Sortable, PrioritySetElement, Log,
    ReactionSandbox, Timer, MutationSandbox,
    Reactor, TimeValue, Tag,
    ArgList, Args, Triggers,
    Startup
} from "./internal"

/**
 * A number that indicates a reaction's position with respect to other
 * reactions in an acyclic precendence graph.
 * @see ReactionQueue
 */
export type Priority = number;

/**
 * Generic base class for reactions. The type parameter `T` denotes the type of
 * the argument list of the `react` function that that is applied to when this
 * reaction gets triggered.
 * 
 * @author Marten Lohstroh (marten@berkeley.edu)
 */
export class Reaction<T> implements Sortable<Priority>, PrioritySetElement<Priority> {

    /** 
     * Priority derived from this reaction's location in the dependency graph
     * that spans the entire hierarchy of components inside the top-level reactor
     * that this reaction is also embedded in.
     */
    private priority: Priority = 0 //Number.MAX_SAFE_INTEGER;

    /**
     * Pointer to the next reaction, used by the runtime when this reaction is staged
     * for execution at the current logical time.
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

    /**
     * Indicates whether or not this reaction is active. A reaction become
     * active when its container starts up, inactive when its container
     * shuts down.
     */
    public active = false

    /**
     * Return true if this reaction is triggered immediately (by startup or a
     * timer with zero offset).
     */
    isTriggeredImmediately(): boolean {
        return (this.trigs.list.filter(trig => (
            trig instanceof Startup || (trig instanceof Timer && trig.offset.isZero())
        )).length > 0)
    }

    /**
     * Return the priority of this reaction. It determines the execution order among
     * reactions staged for execution at the same logical time.
     */
    getPriority(): Priority {
        return this.priority;
    }

    /**
     * Return whether or not this reaction has priority over another.
     * @param another Reaction to compare this reaction's priority against.
     */
    hasPriorityOver(another: PrioritySetElement<Priority> | undefined): boolean {
        if (another != null && this.getPriority() < another.getPriority()) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Return whether another, newly staged reaction is equal to this one.
     * Because reactions are just object references, no updating is necessary.
     * Returning true just signals that the scheduler shouldn't stage it twice.
     * @param node 
     */
    updateIfDuplicateOf(node: PrioritySetElement<Priority> | undefined) {
        return Object.is(this, node);
    }

    /**
     * Invoke the react function in the appropriate sandbox and with the argument
     * list that was specified upon the construction of this reaction object.
     */
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
                .isSmallerThan(new Tag(this.sandbox.util.getCurrentPhysicalTime(), 0))) {
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

    /**
     * Return string representation of the reaction.
     */
    public toString(): string {
        return this.reactor._getFullyQualifiedName() + "[R" + this.reactor._getReactionIndex(this) + "]";
    }
}


export class Procedure<T> extends Reaction<T> {

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
        return this.parent._getFullyQualifiedName() + "[M" + this.parent._getReactionIndex(this) + "]";
    }
    
}
