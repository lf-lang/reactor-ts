/**
 * Core of the reactor runtime.
 * 
 * @author Marten Lohstroh (marten@berkeley.edu),
 * @author Matt Weber (matt.weber@berkeley.edu)
 */

import {PrecedenceGraph, PrecedenceGraphNode, PrioritySetNode, PrioritySet} from './util';
import "./time";
import { TimeInterval, TimeInstant, compareTimeInstants, Origin, TimestampedValue, NumericTimeInterval, microtimeToNumeric, compareNumericTimeIntervals, timeIntervalIsZero, timeIntervalToNumeric, timeInstantsAreEqual, numericTimeSum, numericTimeMultiple, numericTimeDifference } from './time';
// import * as globals from './globals'

//---------------------------------------------------------------------//
// Modules                                                             //
//---------------------------------------------------------------------//

//Must first declare require function so compiler doesn't complain
declare function require(name:string);

const microtime = require("microtime");
const NanoTimer = require('nanotimer');

//---------------------------------------------------------------------//
// Types and Helper Functions                                          //
//---------------------------------------------------------------------//

/**
 * A trigger can cause the invocation of a reaction.
 */
export type Trigger = Action<unknown> | Port<unknown> | Timer
export type Priority = number;
export type AbstractReaction = Reaction<unknown>;
export type ArgType<T> = T extends any[] ? T : never;

export type VarList = Variable<unknown>[];
//export type TrigList = Trigger[];

export const Args = <T extends VarList>(...args: T) => args;

export const Trigs = <T extends VarList>(...args: T) => args;



// type Meet<X,T> = T extends X ? never : T;

// type Join<X,T> = X extends T ? never : X;
//---------------------------------------------------------------------//
// Runtime Functions                                                   //
//---------------------------------------------------------------------//

//---------------------------------------------------------------------//
// Interfaces                                                          //
//---------------------------------------------------------------------//

/**
 * A variable is a port, timer, or action that has a parent that is a reactor.
 */
export interface Variable<T> {
    get: () => T | null;
    isPresent: () => boolean;
    //set: (value: T | null) => void;
    //getParent: () => Reactor;
}

/**
 * For objects that have a name.
 */
export interface Named {
    /* Return the fully qualified name of this object. */
    _getFullyQualifiedName(): string;

    /* Get the name of this object. */
    _getName(): string;
}

/**
 * For (re)nameable objects.
 */
export interface Nameable extends Named {
 
    /* Set the name of this object. */
    _setName(name: string):void;
}

//---------------------------------------------------------------------//
// Core Reactor Classes                                                //
//---------------------------------------------------------------------//

// SECOND: remove second type parameter
// THIRD: see if its possble to force the use of Args() (probably not)

/**
 * Base class for reactions.
 */
export abstract class Reaction<T> implements PrecedenceGraphNode<Priority>, PrioritySetNode<Priority> {
    
    /** Priority derived from this reaction's location in 
     *  the directed acyclic precedence graph. */
    private priority: Priority;

    state;

    next: PrioritySetNode<Priority> | null = null;

    getID(): AbstractReaction {
        return this;
    }

    getNext(): PrioritySetNode<Priority> | null {
        return this.next;
    }

    setNext(node: PrioritySetNode<Priority> | null) {
        this.next = node;
    }

    getDependencies(): [Set<Variable<unknown>>, Set<Variable<unknown>>] {
        var deps:Set<Variable<unknown>> = new Set();
        var antideps: Set<Variable<unknown>> = new Set();
        var vars = new Set();
        for (let a of this.args.concat(this.trigs)) {
            if (a instanceof Port) {
                // Look at variables at the level of the parent.
                if (a.isChildOf(this.parent)) {
                    if (a instanceof InPort || a instanceof Timer) {
                        deps.add(a);
                        continue;
                    }
                    if (a instanceof OutPort || a instanceof Action) {
                        antideps.add(a)
                        continue;
                    }
                } else if (a.isGrandChildOf(this.parent)) {
                    // Look at variables at the level of the parent's children.
                    if (a instanceof InPort) {
                        antideps.add(a);
                        continue;
                    }
                    if (a instanceof OutPort) {
                        deps.add(a)
                        continue;
                    }
                }
            }
        }
        return [deps, antideps];
    }

    getPriority(): Priority {
        return this.priority;
    }

    hasPriorityOver(node: PrioritySetNode<Priority> | null): boolean {
        if (node != null && this.getPriority() < node.getPriority()) {
            return true;
        } else {
            return false;
        }
    }

    updateIfDuplicateOf(node:PrioritySetNode<Priority>|null) {
        return Object.is(this, node);
    }

    //A reaction defaults to not having a deadline  FIXME: we want the deadline to have access to the same variables
    deadline: null| Deadline = null;

    /** 
     * Construct a new Reaction by passing in a reference to the reactor that contains it,
     * the variables that trigger it, and the arguments passed to the react function.
     * @param state state shared among reactions
     */
    constructor(protected parent:Reactor, public trigs:Variable<unknown>[], public args:ArgType<T>) {
        this.state = parent.state;
    }

    /**
     * Derived classes must implement this method. Because it is used in a very unusual
     * way -- only by the execution engine, which will apply it to the arguments that
     * were passed into the constructor -- TypeScript will report errors that have to
     * be suppressed by putting //@ts-ignore on the line before the definitions of derived
     * implementations of this method.
     * @param args The arguments to with this function is to be applied.
     */
    public abstract react(...args:ArgType<T>): void;

    public doReact() {
        this.react.apply(this, this.args);
    }

    /**
     * Setter for reaction priority. This should
     * be determined by topological sort of reactions.
     * @param priority The priority for this reaction.
     */
    public setPriority(priority: number){
        console.log("********setting prio")
        this.priority = priority;
    }
}

/**
 * The abstract class for a reaction deadline. A deadline is an optional relation
 * between logical time and physical time for a reaction. A reaction possessing a
 * deadline with a timeout of x seconds will invoke the deadline's handler()
 * function instad of its ordinary react() function if the reaction is invoked with 
 * physical time > logical time + timeout.
 */
export abstract class Deadline {

    /**
     * The time after which the deadline miss's handler is invoked.
     */
    private timeout: TimeInterval;

    /**
     * Getter for timeout.
     */
    public getTimeout(){
        return this.timeout;
    }

    /**
     * This handler function must be overriden by a concrete handler.
     */
    handler(){
        throw new Error("handler function hasn't been defined.")
    }

    /**
     * Deadline constructor.
     * @param timeout Time after which the deadline has been missed and the deadline
     * miss handler should be invoked.
     */
    constructor(timeout: TimeInterval){
        this.timeout = timeout;
    }
}

/**
 * An event is caused by a timer or a scheduled action. 
 * Each event is tagged with a time instant and may carry a value 
 * of arbitrary type. The tag will determine the event's position
 * with respect to other events in the event queue.
 */
export class Event<T> implements PrioritySetNode<TimeInstant> {

    private next: Event<unknown> | null = null;

    /**
     * Constructor for an event.
     * @param trigger The trigger of this event.
     * @param time The time instant when this event occurs.
     * @param value The value associated with this event. 
     * 
     */
    constructor(public trigger: Trigger, public time: TimeInstant, public value:T){
    }

    hasPriorityOver(node: PrioritySetNode<TimeInstant> | null) {
        if (node) {
            return compareTimeInstants(this.getPriority(), node.getPriority());
        } else {
            return false;
        }
    }

    updateIfDuplicateOf(node: PrioritySetNode<TimeInstant> | null) {
        if (node instanceof Event) {
            if (this.trigger === node.trigger && this.time == node.time) {
                node.value = this.value; // update the value
                return true;
            } 
        }
        return false;
    }

    getID(): [Trigger, TimeInstant] {
        return [this.trigger, this.time];
    }

    getNext(): Event<unknown> | null {
        return this.next;
    }

    setNext(node: Event<unknown> | null) {
        this.next = node;
    }
    
    getPriority(): TimeInstant {
        return this.time;
    }
 }

export class TriggerOnly<T> implements Variable<T> {
    
    constructor(private action:Action<T>) {
    }
    
    get() {
        return this.action.get();
    };

    isPresent() {
        return this.action.isPresent();
    };

    getParent() {
        return this.action.getParent();
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
export class Action<T> implements Variable<T> {

    // The constructor for a reactor sets this attribute for each
    // of its attached timers.
    parent: Reactor;

    origin: Origin;
    minDelay: TimeInterval;
    name: string;

    // A value is available to any reaction triggered by this action.
    // The value is not directly associated with a timestamp because
    // every action needs a timestamp (for _isPresent()) and only
    // some actions carry values. 
    
    value: T;
    
    // The most recent time this action was scheduled.
    // Used by the isPresent function to tell if this action
    // has been scheduled for the current logical time.
    
    //FIXME: make private?
    timestamp: TimeInstant | null;

    /**
     * Returns true if this action was scheduled for the current
     * logical time. This result is not affected by whether it
     * has a value.
     */
    public isPresent(){
        if(this.timestamp == null){
            // This action has never been scheduled before.
            return false;
        }
        if(timeInstantsAreEqual(this.timestamp, this.parent._app._getcurrentlogicaltime())){
            return true;
        } else {
            return false;
        }
    }

    /**
     * Called on an action within a reaction to acquire the action's value.
     * The value for an action is set by a scheduled action event, and is only
     * present for reactions executing at that logical time. When logical time
     * advances, that previously available value is now unavailable.
     * If the action was scheduled with no value, this function returns null.
     */
    public get(): T | null{
        if(this.value && this.isPresent()){
            return this.value;
        } else {
            return null;
        }
    }

    /** 
     * Action Constructor
     * @param parent The Reactor containing this action.
     * @param timeType Optional. Defaults to physical. If physical,
     *  then the physical clock on the local platform is used to assign a timestamp
     *  to the action when it is enabled. If logical, the current physical time is
     *  ignored and the timestamp of the action is the current logical time (plus
     *  one microstep) or, if a minimum delay is given and is greater than zero,
     *  the current logical time plus the minimum delay.
     * @param minDelay Optional. Defaults to 0. If a minDelay is given, then it 
     *  specifies a minimum delay, the minimum logical time that must elapse between
     *  when the action is enabled and when it triggers. If the delay parameter to the
     *  schedule function and the mindelay parameter are both zero and the physical
     *  keyword is not given, then the action is timestamped one microstep later.
     */
    constructor(parent: Reactor, origin: Origin = Origin.physical, minDelay: TimeInterval = 0){
        this.parent = parent;
        this.origin = origin;
        this.minDelay = minDelay;
        this.name = name;
    }

    /**
     * Schedule this action. An event for this action will be
     * created and pushed onto the event queue. If the same action
     * is scheduled multiple times for the same logical time, the value
     * associated with the last invocation of the this function determines
     * the value attached to the action at that logical time.
     * @param delay The time difference between now and the future when 
     * this action should occur. 
     * @param value An optional value to be attached to this action.
     * The value will be available to reactions depending on this action.
     */
    schedule(delay: TimeInterval, value?: T){
        console.log("Scheduling action.");
        if(delay === null){
            throw new Error("Cannot schedule an action with a null delay");
        }

        let timestamp: TimeInstant;
        let wallTime: NumericTimeInterval; 

        //FIXME: I'm not convinced I understand the spec so,
        //Probably something wrong in one of these cases...
        if(this.origin == Origin.physical){
            //physical
            wallTime = microtimeToNumeric(microtime.now());
            if(compareNumericTimeIntervals( this.parent._app._getcurrentlogicaltime()[0], wallTime )){
                timestamp = [this.parent._app._getcurrentlogicaltime()[0], this.parent._app._getcurrentlogicaltime()[1] + 1 ];
            } else {
                timestamp = [wallTime, 0 ];
            }
        } else {
            //logical
            if( timeIntervalIsZero(this.minDelay) && timeIntervalIsZero(delay)) {
                timestamp = [this.parent._app._getcurrentlogicaltime()[0], this.parent._app._getcurrentlogicaltime()[1] + 1 ];
            } else {
                //Take min of minDelay and delay
                let numericMinDelay = timeIntervalToNumeric(this.minDelay);
                let numericDelay = timeIntervalToNumeric(delay);
                let actionTime: NumericTimeInterval;
                if(compareNumericTimeIntervals(numericMinDelay, numericDelay )){
                    actionTime = numericMinDelay;
                } else{
                    actionTime = numericDelay;
                }
                timestamp = [actionTime, this.parent._app._getcurrentlogicaltime()[1]];
            }
        }

        let actionEvent = new Event(this, timestamp, value);
        // let actionPriEvent = new PrioritizedEvent(actionEvent, this.parent.app.getEventID());
        this.parent._app._scheduleEvent(actionEvent);    
    }

    /**
     * Setter method for an action's parent attribute.
     * @param parent The reactor this action is attached to.
     */
    public setParent(parent: Reactor){ // FIXME: not sure if we want to expose this
        this.parent = parent;
    }

    /**
     * Getter method for an action's parent attribute.
     */
    public getParent(){
        return this.parent;
    }

    public toString(){
        return "Action of " + this.parent;
    }

}

/**
 * A timer is an attribute of a reactor which periodically (or just once)
 * creates a timer event. A timer has an offset and a period. Upon initialization
 * the timer will schedule an event at the given offset from starting wall clock time.
 * Whenever this timer's event comes off the event queue, it will 
 * reschedule the event at the current logical time + period in the future. A 0 
 * period indicates the timer's event is a one-off and should not be rescheduled.
 */
export class Timer implements Variable<TimeInstant> {
    get: () => [[number, number], number] | null;
    isPresent: () => boolean;
    
    // The reactor this timer is attached to.
    parent: Reactor;

    //For reference, the type of a TimeInterval is defined as:
    //TimeInterval = null | [number, TimeUnit] | 0;
    period: TimeInterval;
    offset: TimeInterval;

    //Private variables used to keep track of rescheduling
    _timerFirings: number = 0;
    _offsetFromStartingTime: NumericTimeInterval;

    //The setup function is used by an app to create the first timer event.
    //It must be called before reschedule, or else _offsetFromStartingTime will
    //not be set.
    setup(){
        if(this.offset === 0 || this.offset[0] >= 0){
            
            let numericOffset = timeIntervalToNumeric(this.offset);
            this._offsetFromStartingTime =  numericTimeSum( numericOffset, this.parent._app._getStartingWallTime() );
            let timerInitInstant: TimeInstant = [this._offsetFromStartingTime, 0];
            let timerInitEvent: Event<null> = new Event(this, timerInitInstant, null);

            this.parent._app._scheduleEvent(timerInitEvent);

            console.log("Scheduled timer init for timer with period " + this.period + " at " + timerInitInstant);
        } else {
            throw new Error("Cannot setup a timer with a negative offset.");
        }
    }

    /**
     * The reschedule function for a timer schedules the next timer event using the period.
     * A period of 0 indicates the timer should not be scheduled again.
     * Note that rescheduling is based on a multiple of the period and does not "slip"
     * if the last scheduling happened late.
     */
    reschedule() {
        this._timerFirings++;
        if((this.period === 0 || this.period[0] >= 0)){
            if( !timeIntervalIsZero(this.period)){

                let numericPeriod = timeIntervalToNumeric(this.period);
                let nextLogicalTime: NumericTimeInterval = numericTimeSum(this._offsetFromStartingTime, 
                                    numericTimeMultiple(numericPeriod , this._timerFirings) ); 
                let nextTimerInstant: TimeInstant = [nextLogicalTime, 0];
                let nextTimerEvent: Event<null> = new Event(this, nextTimerInstant, null);
                // console.log("In reschedule, this.parent : " + this.parent);
                this.parent._app._scheduleEvent(nextTimerEvent);

                console.log("Scheduling next event for timer with period " + this.period + " for time: " + nextTimerInstant);
            }

        } else {
            throw new Error("Cannot reschedule a timer with a negative period.");
        }
    };

    /**
     * Timer constructor. 
     * @param parent The reactor this timer is attached to.
     * @param offset The interval between the start of execution and the first
     * timer event. Cannot be negative.
     * @param period The interval between rescheduled timer events. If 0, will
     * not reschedule. Cannot be negative.
     */
    constructor(parent: Reactor, offset:TimeInterval, period:TimeInterval) {
        this.parent = parent;
        this.period = period;
        this.offset = offset;

        if(offset[0] < 0){
            throw new Error("A timer offset may not be negative.");
        }

        if(period[0] < 0){
            throw new Error("A timer period may not be negative.");
        }
    }

    /**
     * Setter method for a timer's parent attribute.
     * @param parent The reactor containing this timer.
     */
    public setParent(parent: Reactor){ // FIXME: not sure that we want this
        this.parent = parent;
        // console.log("Setting parent for " + this);
    }

    /**
     * Getter method for a timer's parent attribute.
     */
    public getParent(){
        return this.parent;
    }

    public toString(){
        return "Timer with period: " + this.period + " offset: " + this.offset;
    }

    /**
     * FIXME: not implemented yet. Do we need this?
     * @param period 
     */
    adjustPeriod(period: TimeInterval):void {   
        // FIXME
    }
}

/**
 * A reactor is a software component that reacts to input events,
 * timer events, and action events. It has private state variables
 * that are not visible to any other reactor. Its reactions can
 * consist of altering its own state, sending messages to other
 * reactors, or affecting the environment through some kind of
 * actuation or side effect.
 */
export abstract class Reactor implements Nameable {
    
    public state = {};

    private _startupActions: Set<Action<unknown>> = new Set();

    private _shutdownActions: Set<Action<unknown>> = new Set();

    /** Reactions added by the implemented of derived reactor classes. */
    protected _reactions: Reaction<unknown>[] = [];

    private _mutations: Reaction<unknown>[]; // FIXME: introduce mutations
    
    protected startup: Action<unknown> = new Action(this);

    protected shutdown: Action<undefined> = new Action(this);

    private _myName: string;
    private _myIndex: number | null;

    protected _parent: Reactor|null = null;
    
    public _app:App;

    protected addReaction<T>(reaction: Reaction<T>) : Reaction<T> {
        // Ensure that arguments are compatible with implementation of react().
        (function<X>(args: ArgType<X>, fun: (...args:ArgType<X>) => void): void {
        })(reaction.args, reaction.react);
        this._reactions.push(reaction);
        return reaction;
    }

    public getPrecedenceGraph() {
        for (let r of this._reactions) {
            let deps = r.getDependencies();
        }
    }

    /**
     * Put reactions on the reaction queue when they are triggered by the given port.
     * @param trigger Port A port that is written to.
     */
    public enqueueReactions(trigger: Port<unknown>) {
        if(this instanceof InPort){
            // Input ports can trigger reactions for the reactor
            // they are attached to.
            if(trigger.isChildOf(this)) {
                for (let r of this._reactions) {
                    if (r.triggers.includes(this)) {
                        // Put this reaction on the reaction queue.
                        this._app._scheduleReaction(r);
                    }
                }
            }
        } else {
            // Output ports can trigger reactions for a reactor containing the
            // reactor they are attached to.
            if(trigger.isGrandChildOf(this)) {
                for (let c of this._getChildren()) {
                    c.enqueueReactions(trigger);
                }
            }
        }

    }

    /**
     * Reactor Constructor.
     * Create a new component; use the constructor name
     * if no name is given.
     * @param {string=} name - Given name
     */
    constructor(parent: Reactor | null, name?:string) {

        this._parent = parent;    
        this._myName = this.constructor.name; // default
        this._myIndex = null; // FIXME: looks like we're not using this anymore?

        // Set this component's name if specified.
        if (name != null) {
            this._myName = name;
        }
        // Inform parent of this reactor's startup and shutdown action.
        if (parent != null) {
            parent._registerStartupShutdown(this.startup, this.shutdown);
        }

        // Add default startup reaction.
        var startup = new class<T> extends Reaction<T> {
            // @ts-ignore
            react(startup: Action<unknown>):void {
                    // Schedule startup for all contained reactors.
                }
            }(this, Trigs(this.startup), Args(this.startup));
        this.addReaction(startup);

        // Add default shutdown reaction.
        var shutdown = new class<T> extends Reaction<T> {
            // @ts-ignore
            react(shutdown: Action<unknown>):void {
                // Schedule shutdown for all contained reactors.
            }
        }(this, Trigs(this.shutdown), Args(this.shutdown));
        this.addReaction(shutdown);
    }

    public isChildOf(parent: Reactor) {
        if (this._parent === parent) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Obtain the set of this reactor's child reactors.
     * Watch out for cycles!
     * This function ignores reactor attributes which reference
     * this reactor's parent and this reactor's app.
     * It is an error for a reactor to be a child of itself.
     */
    private _getChildren(): Set<Reactor> {
        let children = new Set<Reactor>();
        for (const [key, value] of Object.entries(this)) {
            // If pointers to other non-child reactors in the hierarchy are not
            // excluded (eg. value != this.parent) this function will loop forever.
            if (value instanceof Reactor && value != this._parent && value != this._app) {
                // A reactor may not be a child of itself.
                if(value == this){
                    throw new Error("A reactor may not have itself as an attribute." +
                                    " Reactor attributes of a reactor represent children" +
                                    " and a reactor may not be a child of itself");
                }
                children.add(value);
            }
        }
        return children;
    }

    protected mutations = new class implements Mutations {
        constructor(public superThis: Reactor) {
        }
        public connect<D, S extends D>(src:Port<S>, dst:Port<D>) {
            return this.superThis._connect(src, dst);
        }
    }(this);

    public _registerStartupShutdown(startup: Action<unknown>, shutdown: Action<unknown>) {
        // FIXME: do hierarchy check to ensure that this reactors should have access to these actions.
        this._startupActions.add(startup);
        this._shutdownActions.add(shutdown);
    }
    
    /**
     * Returns the set of reactions owned by this reactor.
     */
    public _getReactions(): Set<Reaction<unknown>> {
        var set:Set<Reaction<unknown>> = new Set();
        for (let entry of this._reactions) {
            set.add(entry);
        }
        return set;
    }

    public _isValidDependency() {

    }

    // public _inScope(var: Variable<any>): boolean {
    //     return false;
    // }



    /**
     * Returns true if a given source port can be connected to the
     * given destination port. False otherwise. Valid connections
     * must:
     * (1) satisfy particular hierachical constraints following 
     * from the scope rules of reactors; and
     * (2) not introduce cycles.
     * @param src The start point of the tried connection.
     * @param dst The end point of the tried connection.
     */
    public canConnect<D, S extends D>(src: Port<S>, dst: Port<D>): boolean {

        // Rule out trivial self loops.
        if(src === dst){
            return false;
        }

        // FIXME: check the local dependency graph to figure out whether this
        // change introduces zero-delay feedback.
        

        if (src instanceof OutPort) {
            if(dst instanceof InPort){ 
                // OUT to IN
                if(src.isGrandChildOf(this) && dst.isGrandChildOf(this)) {
                    return true;
                } else {
                    return false;
                }
            } else {
                // OUT to OUT
                if(src.isGrandChildOf(this) && dst.isChildOf(this)) {
                    return true;
                } else {
                    return false;
                }
            }
        } else {
            if(src === dst){
                return false;
            }
            if(dst instanceof InPort){
                // IN to IN
                if(src.isChildOf(this) && dst.isGrandChildOf(this)){
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

    protected _connect<D, S extends D>(src:Port<S>, dst:Port<D>) {
        //***********
        if (this.canConnect(src, dst)) {
            console.log("connecting " + this + " and " + dst);
            src._connectedSinkPorts.add(dst);
            dst._connectedSourcePort = src;   
        }
    }

    protected _disconnect(src:Port<unknown>, dst: Port<unknown>) {
        if (src instanceof InPort) {
            src._connectedSinkPorts.delete(src);
            dst._connectedSourcePort = null;    
        } else if (src instanceof OutPort) {
            src._connectedSinkPorts.delete(src);
            dst._connectedSourcePort = null;    
        }
    }

    /**
     * Returns the set of reactions directly owned by this reactor combined with 
     * the recursive set of all reactions of contained reactors.
     */
    // public _getAllReactions(): Set<Reaction<unknown>> {
    //     let reactions = this._getReactions();

    //     // Recursively call this function on child reactors
    //     // and add their timers to the timers set.
    //     let children = this._getChildren();
    //     if(children){
    //         for(const child of children){
    //             if(child){
    //                 let subReactions = child._getAllReactions();
    //                 for(const subReaction of subReactions){
    //                     reactions.add(subReaction);
    //                 }                     
    //             }
    //         }
    //     }
    //     return reactions;
    // }

    /**
     * Iterate through this reactor's attributes,
     * and return the set of its timers.
     */
    public _getTimers(): Set<Timer>{
        // console.log("Getting timers for: " + this)
        let timers = new Set<Timer>();
        for (const [key, value] of Object.entries(this)) {
            if (value instanceof Timer) {
                timers.add(value);
            }
        }
        return timers;
    }

    /**
     * Returns the set of timers directly owned by this reactor combined with 
     * the recursive set of all timers of contained reactors.
     */
    public _getAllTimers(): Set<Timer> {
        // Timers part of this reactor
        let timers = this._getTimers();

        // Recursively call this function on child reactors
        // and add their timers to the timers set.
        let children = this._getChildren();
        if(children){
            for(const child of children){
                if(child){
                    let subTimers = child._getAllTimers();
                    for(const subTimer of subTimers){
                        timers.add(subTimer);
                    }                     
                }
            }
        }
        return timers;
    }

    /**
     * Iterate through this reactor's attributes,
     * and return the set of its ports.
     */
    public _getPorts(): Set<Port<any>>{
        // console.log("Getting ports for: " + this)
        let ports = new Set<Port<any>>();
        for (const [key, value] of Object.entries(this)) {
            if (value instanceof Port) {
                ports.add(value);
            }
        }
        return ports;
    }

    /**
     * Iterate through this reactor's attributes,
     * and return the set of its actions.
     */
    public _getActions(): Set<Action<any>>{
        // console.log("Getting actions for: " + this)
        let actions = new Set<Action<any>>();
        for (const [key, value] of Object.entries(this)) {
            if (value instanceof Action) {
                actions.add(value);
            }
        }
        return actions;
    }

    /**
     * Return a string that identifies this component.
     * The name is a path constructed as TopLevelParentName/.../ParentName/ThisReactorsName
     */
    _getFullyQualifiedName(): string {
        
        var path = "";
        if (this._parent != null) {
            path = (this._parent as Reactor)._getFullyQualifiedName();
        }
        if (path != "") {
            path += "/" + this._getName();
        } else {
            path = this._getName();
        }
        return path;
    }

    _getName():string {
        if (this._myIndex != null && this._myIndex != 0) {
            return this._myName + "(" + this._myIndex + ")";
        } else {
            return this._myName;
        }
    }

    public _setName(name: string) {
        if (this._parent != null && (name != this._myName || this._myIndex == null)) {
            //myIndex = parent._getFreshIndex(name); //FIXME: look at former composite
            this._myName = name;
        }
    }

    //A reactor's priority represents its order in the topological sort.
    //The default value of -1 indicates a priority has not been set.
    _priority: number = -1;

    //FIXME: assign in constructor?
    _getPriority(){
        return this._priority;
    }

    _setPriority(priority: number){
        this._priority = priority;
    }

    toString(): string {
        return this._getFullyQualifiedName();
    }

    /**
     * Recursively sets the app attribute for this reactor and all contained reactors to app.
     * @param app The app for this and all contained reactors.
     */
    public _setApp(app: App){
        // console.log("Starting _setApp for: " + this._getFullyQualifiedName());
        console.log("Setting app for: " + this);
        this._app = app;
        // Recursively set the app attribute for all contained reactors to app.
        let children = this._getChildren();
        if(children){
            for(let child of children){
                child._setApp(app);
            }
        }
    }

    /**
     * Recursively traverse all reactors and verify the 
     * parent property of each component correctly matches its location in
     * the reactor hierarchy.
     */
    public _checkAllParents(parent: Reactor | null){
        if(this._parent != parent) throw new Error("The parent property for " + this
            + " does not match the reactor hierarchy.");
        // this._parent = parent;
        let children = this._getChildren();
        for(let child of children){
            child._checkAllParents(this);
        }

        let timers = this._getTimers();
        for(let timer of timers){
            if(timer.getParent() != this) throw new Error("The parent property for " + timer
            + " does not match the reactor hierarchy.");
            // timer._setParent(this);
        }

        // Ports have their parent set in constructor, so verify this was done correctly.
        let ports = this._getPorts();
        for(let port of ports){
            if(!port.isChildOf(this)){
                throw new Error("A port has been incorrectly constructed as an attribute of " +
                                "a different reactor than the parent it was given in its constructor: "
                                + port);
            }
            // port._setParent(this);
        }

        let actions = this._getActions();
        for(let action of actions){
            if(action.getParent() != this) throw new Error("The parent property for " + action
            + " does not match the reactor hierarchy.");
            // action._setParent(this);
        }

    }

    public _acquire(newParent: Reactor): boolean {
        if (this._parent == null) {
            this._parent = newParent;
            return true;
        } else {
            return false;
        }
    }

    public _release(oldParent: Reactor): boolean {
        if (this._parent == oldParent) {
            this._parent = null;
            this._myIndex = null
            return true;
        } else {
            return false;
        }
    }

    /**
     * Setter method for this reactor's parent.
     * @param parent The reactor containing this one.
     */
    public _setParent(parent: Reactor| null){
        this._parent = parent;
    }   
}

export abstract class Port<T> implements Named, Variable<T> {
    
    /** The reactor containing this port */ 
    protected parent: Reactor;

    /** The time stamp associated with this port's value. */  
    protected tag: TimeInstant;

    /** The value associated with this port. */  
    protected value: T | null = null;
    
    public _connectedSinkPorts: Set<Port<unknown>> = new Set<Port<T>>(); // FIXME: change this into a private map hosted in the reactor
    public _connectedSourcePort: Port<T>| null = null; // FIXME: change this into a private map hosted in the reactor

    public _getFullyQualifiedName(): string {
        return this.parent._getFullyQualifiedName() 
            + "/" + this._getName();
    }

    public isChildOf(r: Reactor): boolean {
        if (this.parent && this.parent === r) {
            return true;
        }
        return false;
    }

    public isGrandChildOf(r: Reactor): boolean {
        if (this.parent && this.parent.isChildOf(r)) {
            return true;
        }
        return false;
    }

    /* Return a globally unique identifier. */
    public _getName(): string {
        var alt = "";
        for (const [key, value] of Object.entries(this.parent)) {
            if (value === this) { // do hasOwnProperty check too?
                return `${key}`;
            }
        }
        return "anonymous";
    }

    /**
     * Assign a value to this port at the current logical time.
     * Put the reactions this port triggers on the reaction 
     * queue and recursively invoke this function on all connected output ports.
     * @param value The value to assign to this port.
     */
    protected writeValue(value: T):void {
        // console.log("calling _writeValue on: " + this);
        this.value = value;
        this.tag = this.parent._app._getcurrentlogicaltime();
        
        this.parent.enqueueReactions(this);

        for(const port of this._connectedSinkPorts){
            port.writeValue(value);
        }
    }

    /**
     * Returns true if the connected port's value has been set.
     * an output port or an input port with a value set at the current logical time
     * Returns false otherwise
     */
    public isPresent(){
        if(this.value && timeInstantsAreEqual(this.tag, this.parent._app._getcurrentlogicaltime() )){
            return true;
        } else {
            return false;
        }
    }

    /**
    * Write a value to this Port and recursively transmit the value to connected
    * ports while triggering reactions triggered by that port. Uses push semantics,
    * so the value of a downstream port is determined by the last call to set on an
    * upstream port.
    * @param value The value to be written to this port.
    */
    public set(value: T):void {
        this.writeValue(value);
    }

    /**
     * Obtains the value set to this port. Values are either set directly by calling set()
     * on this port, or indirectly by calling set() on a connected upstream port.
     * Will return null if the connected output did not have its value set at the current
     * logical time.
     */
    public get(): T | null {
        if(this.value && this.isPresent()){
            return this.value;
        } else {
            return null;
        }
    }

    /* Construct a new port. */
    /**
     * Port constructor.
     * @param parent 
     */
    constructor(parent: Reactor) {
        this.parent = parent;
    }

    toString(): string {
        return this._getFullyQualifiedName();
    }
}


export class OutPort<T> extends Port<T> implements Port<T> {

    // _connectedSinkPorts: Set<Port<T>> = new Set<Port<T>>();
    // _connectedSourcePort: Port<T> | null = null;

    /**
     * Return the set of all InPorts connected to this OutPort
     * directly or indirectly as a sink.
     */
    public getAllConnectedSinkInPorts(){
        let sinkInPorts = new Set<InPort<any>>();
        for( let connected of this._connectedSinkPorts){
            if(connected instanceof InPort){
                sinkInPorts.add(connected);
            } else {
                let recursiveSinkInPorts = (connected as OutPort<any>).getAllConnectedSinkInPorts();
                for (let newSink of recursiveSinkInPorts){
                    sinkInPorts.add(newSink);
                }
            }
        }
        return sinkInPorts;
    }

    toString(): string {
        return this._getFullyQualifiedName();
    }

}

export class InPort<T> extends Port<T> {

    /**
     * If an InPort has a null value for its connectedPort it is disconnected.
     * A non-null connectedPort is connected to the specified port.
     */
    _connectedSinkPorts: Set<Port<T>> = new Set<Port<T>>();
    _connectedSourcePort: Port<T> | null = null;

    //_receivers: Set<Port<T>>;
    //_persist: boolean;

    toString(): string {
        return this._getFullyQualifiedName();
    }

}

/**
 * This class matches a Trigger to the Reactions it triggers.
 * When an event caused by a Trigger comes off the event queue, its
 * matching reactions should be put on the the reaction queue 
 */
// export class TriggerMap {
//     _tMap: Map<Trigger<any>, Set<Reaction>> = new Map();
//     _aMap: Map<Reaction, Array<Readable<any>|Writable<any>>> = new Map();
//     _comesAfter: Map<Reaction, Reaction> = new Map();

//     /**
//      * Establish the mapping for a Reaction.
//      */
//     registerReaction(previous: Reaction | null, current: Reaction, triggers:Array<Trigger<any>>, args:Array<Readable<any>|Writable<any>>){
//         for(let trigger of triggers){
//             let reactionSet = this._tMap.get(trigger);
//             if(reactionSet) {
//                 if(! reactionSet.has(current)) {
//                     reactionSet.add(current);
//                     this._tMap.set(trigger, reactionSet);
//                 }
//                 //If this reaction is already mapped to the trigger,
//                 //do nothing.
//             } else {
//                 //This is the first reaction mapped to this trigger,
//                 //so create a new reaction set for it.
//                 reactionSet = new Set<Reaction>();
//                 reactionSet.add(current);
//                 this._tMap.set(trigger, reactionSet);
//             }
//             this._aMap.set(current, args);
//             if (previous != null) {
//                 this._comesAfter.set(current, previous)
//             }
//         }
//     }

//     /**
//      * Get the set of reactions for a trigger.
//      */
//     getReactions(t: Trigger){
//         return this._tMap.get(t);
//     }

//     /**
//      * FIXME
//      */
//     deregisterReaction(e: Event<any>){ // FIXME: weird
//         //FIXME
//     }
// }

class ReactionQueue extends PrioritySet<Priority> {

}

class EventQueue extends PrioritySet <TimeInstant> {

}

export class App extends Reactor {
    
    // // FIXME: add some logging facility here

    /**
     * If not null, finish execution with success, this time interval after
     * the start of execution.
     */
    private _executionTimeout:TimeInterval | null = null;

    /**
     * The numeric time at which execution should be stopped.
     * Determined from _executionTimeout and startingWallTime.
     */
    private _relativeExecutionTimeout: NumericTimeInterval;

    /**
     * Prioritized queues used to manage the execution of reactions and events.
     */
    private _reactionQ = new ReactionQueue();
    private _eventQ = new EventQueue();

    /**
     * The current time, made available so actions may be scheduled relative to it.
     */
    private _currentLogicalTime: TimeInstant;

    /**
     * The physical time when execution began expressed as [seconds, nanoseconds]
     * elapsed since January 1, 1970 00:00:00 UTC.
     * Initialized in start()
     */
    private _startingWallTime: NumericTimeInterval;

    /**
     * Used to look out for the same action scheduled twice at a logical time. 
     */ 
    private _observedActionEvents : Map<Action<any>, Event<any>> = new Map<Action<any>, Event<any>>();


    public success = () => {};
    public fail  = () => {};
    
    /**
     * Acquire all the app's timers and call setup on each one.
     */
    private _startTimers = function(){
        let timers: Set<Timer> = this._getAllTimers();
        for(let t of timers){
            console.log("setting up timer " + t);
            t.setup();
        }
    };


    // FIXME: stuff from earlier when I was in the middle of a refactoring.
    // register() {
    //      // for (let r of this._reactions) { // FIXME: why can't top-level have reactions?
    //      //     this.app.triggerMap.registerReaction(r.reaction, r.triggers);
    // }

    // /**
    //  * Register all the app's reactions with their triggers.
    //  */
    // private _registerReactions = function(){
    //     let reactions: Set<Reaction<unknown>> = this._getAllReactions();
    //     // console.log("reactions set in _registerReactions is: " + reactions);
    //     for(let r of reactions){
    //         // console.log("registering: " + r);
    //         r.register();
    //     }
    // }


    /**
     * Wait until physical time matches or exceeds the time of the least tag
     * on the event queue. After this wait, advance current_time to match
     * this tag. Then pop the next event(s) from the event queue that all 
     * have the same tag, and extract from those events the reactions that
     * are to be invoked at this logical time.
     * Sort those reactions by index (determined by a topological sort)
     * and then execute the reactions in order. Each reaction may produce
     * outputs, which places additional reactions into the index-ordered
     * priority queue. All of those will also be executed in order of indices.
     * If the execution timeout given to this app in its constructor
     * has a non-null value, then call successCallback (and end this loop) 
     * when the logical time from the start of execution matches the
     * specified duration. If execution timeout is null, execution will be
     * allowed to continue indefinately.
     * Otherwise, call failureCallback when there are no events in the queue.
     * 
     * FIXME: Implement a keepalive option so execution may continue if
     * there are no more events in the queue.
     * @param successCallback Callback to be invoked when execution has terminated
     * in an expected way.
     * @param failureCallback Callback to be invoked when execution has terminated
     * in an unexpected way.
     */
    private _next(successCallback: ()=> void, failureCallback: () => void){
        // console.log("starting _next");
        let currentHead = this._eventQ.peek();
        while(currentHead){
            let currentPhysicalTime:NumericTimeInterval = microtimeToNumeric(microtime.now());
            // console.log("current physical time in next is: " + currentPhysicalTime);
            
            //If execution has gone on for longer than the execution timeout,
            //terminate execution with success.
            if(this._executionTimeout){
                //const timeoutInterval: TimeInterval= timeIntervalToNumeric(_executionTimeout);
                if(compareNumericTimeIntervals( this._relativeExecutionTimeout, currentPhysicalTime)){
                    console.log("Execution timeout reached. Terminating runtime with success.");
                    successCallback();
                    return;
                }
            }
            if(compareNumericTimeIntervals(currentPhysicalTime, currentHead.getPriority()[0])){
                //Physical time is behind logical time.
                let physicalTimeGap = numericTimeDifference(currentHead.getPriority()[0], currentPhysicalTime, );
            
                //Wait until min of (execution timeout and the next event) and try again.
                let timeout:NumericTimeInterval;
                if(this._executionTimeout && compareNumericTimeIntervals(this._relativeExecutionTimeout, physicalTimeGap)){
                    timeout = this._relativeExecutionTimeout;
                } else {
                    timeout = physicalTimeGap;
                }
                console.log("Runtime set a timeout at physical time: " + currentPhysicalTime +
                 " for an event with logical time: " + currentHead.getPriority()[0]);
                // console.log("Runtime set a timeout with physicalTimeGap: " + physicalTimeGap);
                // console.log("currentPhysicalTime: " + currentPhysicalTime);
                // console.log("next logical time: " + currentHead._priority[0]);
                // console.log("physicalTimeGap was " + physicalTimeGap);

                //Nanotimer https://www.npmjs.com/package/nanotimer accepts timeout
                //specified by a string followed by a letter indicating the units.
                //Use n for nanoseconds. We will have to 0 pad timeout[1] if it's
                //string representation isn't 9 digits long.
                let nTimer = new NanoTimer();
                let nanoSecString = timeout[1].toString();

                //FIXME: this test will be unecessary later on when we're more
                //confident everything is working correctly.
                if( nanoSecString.length > 9){
                    throw new Error("Tried to set a timeout for an invalid NumericTimeInterval with nanoseconds: " +
                        nanoSecString );
                }

                //Convert the timeout to a nanotimer compatible string.
                let padding = "";
                for(let i = 0; i < 9 - nanoSecString.length; i++){
                    padding = "0" + padding 
                }
                let timeoutString = timeout[0].toString() + padding + nanoSecString + "n"; 
                nTimer.setTimeout(this._next.bind(this), [successCallback, failureCallback], timeoutString);
                
                return;
            } else {
                //Physical time has caught up, so advance logical time
                this._currentLogicalTime = currentHead.getPriority();
                console.log("At least one event is ready to be processed at logical time: "
                 + currentHead.getPriority() + " and physical time: " + currentPhysicalTime );
                // console.log("currentPhysicalTime: " + currentPhysicalTime);
                //console.log("physicalTimeGap was " + physicalTimeGap);

                // Using a Set data structure ensures a reaction triggered by
                // multiple events at the same logical time will only react once.
                let triggersNow = new Set<Reaction<unknown>>();

                // Keep track of actions at this logical time.
                // If the same action has been scheduled twice
                // make sure it gets the correct (last assigned) value.
                this._observedActionEvents.clear();


                // Remove all simultaneous events from the queue.
                // Reschedule timers, assign action values, and put the triggered reactions on
                // the reaction queue.
                // This loop should always execute at least once.
                while(currentHead && timeInstantsAreEqual(currentHead.getPriority(), this._currentLogicalTime)){

                    //An explicit type assertion is needed because we know the
                    //eventQ contains PrioritizedEvents, but the compiler doesn't know that.
                    let trigger: Trigger = currentHead[0];
                    
                    if(trigger instanceof Timer){
                        trigger.reschedule();
                    }

                    if(trigger instanceof Action){
                        // Check if this action has been seen before at this logical time.
                        if(this._observedActionEvents.has(trigger) ){
                            // Whichever event for this action has a greater eventID
                            // occurred later and it determines the value. 
                            // FIXME: I don't understand what's going on here.
                            if( (currentHead as Event<any>).time > (this._observedActionEvents.get(trigger) as Event<any>).time ){
                                trigger.value = (currentHead as Event<any>).value;
                                trigger.timestamp = this._currentLogicalTime;
                            }
                        } else {
                            // Action has not been seen before.
                            this._observedActionEvents.set(trigger, (currentHead as Event<any>));
                            trigger.value = (currentHead as Event<any>).value;
                            trigger.timestamp =  this._currentLogicalTime;
                        }
                    }
                    // console.log("Before triggermap in next");
                    
                    // FIXME: removed trigger map, so need to figure out what's going on here.
                    let toTrigger = [];//this._triggerMap.getReactions(trigger);
                    // console.log(toTrigger);
                    // console.log("after triggermap in next");
                    if(toTrigger){
                        for(let reaction of toTrigger){

                            //Push this reaction to the queue when we are done
                            //processing events.
                            triggersNow.add(reaction);
                        }
                    }
                    this._eventQ.pop();
                    currentHead = this._eventQ.peek();
                }
                
                for (let reaction of triggersNow){
                    // console.log("Pushing new reaction onto queue");
                    // console.log(reaction);
                    this._reactionQ.push(reaction);
                }
                
                let headReaction = this._reactionQ.pop();
                while(headReaction){
                    // Explicit type annotation because reactionQ contains PrioritizedReactions.
                    let r = headReaction;
                    
                    // Test if this reaction has a deadline which has been violated.
                    // This is the case if the reaction has a registered deadline and
                    // logical time + timeout < physical time
                    // FIXME: deadlines are temporarily disabled.
                    // if(r.deadline && compareNumericTimeIntervals( 
                    //         numericTimeSum(this._currentLogicalTime[0], timeIntervalToNumeric(r.deadline.getTimeout())),
                    //         currentPhysicalTime)){
                    //     console.log("handling deadline violation");
                    //     r.deadline.handler();
                    // } else {
                    //     console.log("reacting...");
                    //     r.react();
                    // }
                    headReaction = this._reactionQ.pop();
                }

                //A new Action event may have been pushed onto the event queue by one of
                //the reactions at this logical time.
                currentHead = this._eventQ.peek();
            }

            //The next iteration of the outer loop is ready because
            //currentHead is either null, or a future event
        }
        //Falling out of the while loop means the eventQ is empty.
        console.log("Terminating runtime with failure due to empty event queue.");
        failureCallback();
        return;
        //FIXME: keep going if the keepalive command-line option has been given
    }

    /**
     * FIXME
     * @param executionTimeout 
     * @param name 
     */
    constructor(executionTimeout: TimeInterval | null, name?:string, success?: ()=> void, fail?: ()=>void) {
        super(null, name);
        if (success != null && typeof(success) === typeof(Function)) {
            this.success = success;
        }
        if (fail != null && typeof(fail) === typeof(Function)) {
            this.fail = fail;
        }
        // Note: this.parent is initialized to null because an app is a top
        // level reactor.
        this._parent = null;

        this._executionTimeout = executionTimeout;
        this._currentLogicalTime = [[0,0],0];
    }

    // /**
    //  * Maps triggers coming off the event queue to the reactions they trigger.
    //  * Public because reactions need to register themselves with this structure
    //  * when they're created. 
    //  */
    // public _triggerMap: TriggerMap = new TriggerMap();

    /**
     * Public method to push events on the event queue. 
     * @param e Prioritized event to push onto the event queue.
     */
    public _scheduleEvent(e: Event<any>){  
        this._eventQ.push(e);
    }

    /**
     * Public method to push reaction on the reaction queue. 
     * @param e Prioritized reaction to push onto the reaction queue.
     */
    public _scheduleReaction(r: Reaction<unknown>){  
        this._reactionQ.push(r);
    }

    /**
     * Public getter for logical time. 
     */
    public _getcurrentlogicaltime(){
        return this._currentLogicalTime;
    }
    
    /**
     * Public getter for starting wall time.
     */
    public _getStartingWallTime(){
        return this._startingWallTime
    }

    // /**
    //  * Assign a priority to each reaction in the app.
    //  * A lower priority signifies precedence for one reaction
    //  * over another. 
    //  */
    // private _setReactionPriorities(){
    //     let unsetReactions = this._getAllReactions();
    //     let setReactions = new Set<Reaction>();
    //     let unsetOutPorts = new Set<OutPort<any>>();

    //     // InPorts connected to set OutPorts
    //     let setInPorts = new Set<InPort<any>>();

    //     // A map relating OutPorts to the reactions
    //     // which must be set first. 
    //     let outPortDependsOn = new Map<OutPort<any>, Set<Reaction>>();

    //     // A map relating reactions to the InPorts
    //     // or reactions which must first be set.
    //     let reactionDependsOn = new Map<Reaction, Set<Reaction | InPort<any>>>();

    //     // Initialize outPortDependsOn and unsetOutPorts
    //     for(let r of unsetReactions){
    //         for(let e of r.getEffects()){
    //             if(e instanceof OutPort){
    //                 unsetOutPorts.add(e);
    //                 if(outPortDependsOn.has(e)){
    //                     (outPortDependsOn.get(e) as Set<Reaction>).add(r);
    //                 } else {
    //                     let newReactionSet = new Set<Reaction>();
    //                     newReactionSet.add(r);
    //                     outPortDependsOn.set(e, newReactionSet);
    //                 }
    //             }
    //         }
    //     }

    //     // Initialize reactionDependsOn
    //     for(let r of unsetReactions){
    //         reactionDependsOn.set(r, new Set<Reaction| InPort<any>>());
    //         // Add InPorts from uses
    //         for(let u of r.getUses()){
    //             (reactionDependsOn.get(r) as Set<Reaction| InPort<any>> ).add(u);
    //         }
    //         let parentReactions = r.state._reactions;
    //         if(! parentReactions.includes(r)){
    //             throw new Error(" Reaction " + r + "is not included in its parent's "
    //             + " array of reactions");
    //         }
    //         // Add preceding reactions from parent's reactions array
    //         for (let i = 0; parentReactions[i] != r ; i++ ){
    //             (reactionDependsOn.get(r) as Set<Reaction| InPort<any>> ).add(parentReactions[i]);
    //         }
    //     }

    //     let priorityCount = 0;
    //     while(unsetReactions.size > 0){
    //         // Find a reaction in unsetReactions with no unset dependencies.
    //         // Assign it the next lowest priority, and remove
    //         // it from unsetReactions. Throw an error, identifying a cycle if 
    //         // this process stops before all reactions are set.
    //         let newlySetReactions = new Set<Reaction>();
    //         for( let r of unsetReactions ){
    //             let ready = true;
    //             for( let depend of (reactionDependsOn.get(r) as Set<Reaction | InPort<any>>)){
    //                 if(depend instanceof Reaction){
    //                     if (unsetReactions.has(depend)){
    //                         ready = false;
    //                         break;
    //                     }
    //                 } else {
    //                     if (! setInPorts.has(depend)){
    //                         ready = false;
    //                         break;
    //                     }
    //                 }
    //             }
    //             if(ready){
    //                 console.log("Setting priority for reaction " + r + " to " + priorityCount);
    //                 // This reaction has no dependencies. Set its priority.
    //                 r.setPriority(priorityCount++);
    //                 newlySetReactions.add(r);
    //             }
    //         }

    //         // If no new reactions with met dependencies are
    //         // found on this iteration while unset reactions remain,
    //         // there must be a cycle.
    //         if(newlySetReactions.size == 0){
    //             throw new Error("Cycle detected in reaction precedence graph.");
    //         }

    //         // Move newlySetReactions from unsetReactions
    //         // to setReactions.
    //         for(let toSet of newlySetReactions){
    //             unsetReactions.delete(toSet);
    //             setReactions.add(toSet)
    //         }

    //         // See if any OutPorts are ready to be set
    //         for(let o of unsetOutPorts){
    //             let ready = false;
    //             for(let portReaction of (outPortDependsOn.get(o) as Set<Reaction<unknown>>)){
    //                 if(unsetReactions.has(portReaction)){
    //                     ready = false;
    //                     break;
    //                 }
    //             }
    //             if(ready){
    //                 // Remove the OutPort from unsetOutPorts and set all connected
    //                 // InPorts
    //                 unsetOutPorts.delete(o);
    //                 let connectedInPorts = o.getAllConnectedSinkInPorts();
    //                 for(let connectedInPort of connectedInPorts){
    //                     setInPorts.add(connectedInPort);
    //                 }
    //             }
    //         }
    //     }
    // }

    public _start(successCallback: () => void , failureCallback: () => void):void {
        // Recursively check the parent attribute for this and all contained reactors and
        // and components, i.e. ports, actions, and timers have been set correctly.
        this._checkAllParents(null);
        // Recursively set the app attribute for this and all contained reactors to this.
        this._setApp(this);
        // Set reactions using a topological sort of the dependency graph.
        this.getPrecedenceGraph();
        
        // Recursively register reactions of contained reactors with triggers in the triggerMap.
        //this.registerAll();
        // console.log(this.triggerMap);
        this._startingWallTime = microtimeToNumeric(microtime.now());
        this._currentLogicalTime = [ this._startingWallTime, 0];
        if(this._executionTimeout !== null){
            this._relativeExecutionTimeout = numericTimeSum(this._startingWallTime, timeIntervalToNumeric(this._executionTimeout));
        }
        this._startTimers();
        this._next(successCallback, failureCallback);

    }    

}

export interface Mutations {
    connect<D, S extends D>(src:Port<S>, dst:Port<D>): void;
}
