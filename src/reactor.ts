/**
 * Core of the reactor runtime.
 * 
 * @author Marten Lohstroh (marten@berkeley.edu),
 * @author Matt Weber (matt.weber@berkeley.edu)
 */

import {PrecedenceGraph, PrecedenceGraphNode, PrioritySetNode, PrioritySet} from '../src/util';
// import * as globals from './globals'

//---------------------------------------------------------------------//
// Modules                                                             //
//---------------------------------------------------------------------//

//Must first declare require function so compiler doesn't complain
declare function require(name:string);

const microtime = require("microtime");
const NanoTimer = require('nanotimer');

//---------------------------------------------------------------------//
// Types                                                               //
//---------------------------------------------------------------------//

/** Units for time. */
export enum TimeUnit {
    nsec = 1,
    usec = 1000,
    msec = 1000000,
    sec = 1000000000,
    secs = 1000000000,
    minute = 60000000000,
    minutes = 60000000000,
    hour = 3600000000000,
    hours = 3600000000000,
    day = 86400000000000,
    days = 86400000000000,
    week = 604800000000000,
    weeks = 604800000000000
}


/** 
 * A time interval must be an integer accompanied by a time unit. Decimals are errors.
 */
export type TimeInterval = null | [number, TimeUnit] | 0;

/**
 * The internal representation of a TimeInterval broken up as: [seconds, nanoseconds]
 * 
 * If we used a Javascript number to hold the number of nanoseconds in the time interval,
 * the 2^53 bits of precision for a JavaScript number (double) would overflow after 0.29 years.
 * We use an array here, because in our experiments this representation is much faster
 * than a JavaScript BigInt. To avoid floating point errors, non-integer seconds or 
 * nanoseconds are not allowed.
 * 
 */
export type NumericTimeInterval = [number, number];

/** 
 * A superdense time instant, represented as a pair. The first element of the pair represents
 * elapsed time as a NumericTimeInterval. The second element denotes the micro step index.
 */ 
export type TimeInstant = [NumericTimeInterval, number];

/**
 * A descriptor for a time representation as either refering to the physical (wall)
 * timeline or the logical (execution) timeline. Logical time may get ahead of
 * physical time, or vice versa.
 */
export enum TimelineClass {
    physical,
    logical
}

/**
 * A value (of type T) which is present at a particular TimeInstant
 */
export type TimestampedValue<T> = [TimeInstant, T];

//---------------------------------------------------------------------//
// Helper Functions for Types                                                   //
//---------------------------------------------------------------------//

/**
 * Return true if t matches any of the zero representations for a TimeInterval
 * @param t the time interval to test if zero
 */
export function timeIntervalIsZero(t: TimeInterval){
    if(t === 0 || (t && t[0] == 0)){
        return true;
    } else {
        return false;
    }
}

/**
 * Return true if t0 < t1, otherwise return false.
 * @param t0 
 * @param t1 
 */
export function compareNumericTimeIntervals(t0: NumericTimeInterval, t1: NumericTimeInterval){
    if(t0[0] < t1[0]){
        return true;
    }
    if(t0[0] == t1[0] &&
            t0[1] < t1[1]){
        return true;
    }
    return false;
}

/**
 * Return true if t0 and t1 represent the same time instant. Otherwise return false.
 * @param t0 
 * @param t1 
 */
export function timeInstantsAreEqual(t0: TimeInstant, t1: TimeInstant){
    return t0[0][0] == t1[0][0] && t0[0][1] == t1[0][1] && t0[1] == t1[1];
}

/**
 * Return true if t0 < t1, otherwise return false.
 * @param t0 Left hand time instant.
 * @param t1 Right hand time instant.
 */
export function compareTimeInstants(t0: TimeInstant, t1: TimeInstant): boolean{
    if(compareNumericTimeIntervals(t0[0], t1[0])){
        return true;
    } else{
        if( t0[0][0] == t1[0][0] && t0[0][1] == t1[0][1] && t0[1] < t1[1] ){
            return true;   
        }
        return false;
    }
}

/**
 * Convert a TimeInterval to its corresponding representation as a NumericTimeInterval.
 * Attempting to convert a TimeInterval with sub-nanosecond precision to a
 * NumericTimeInterval will result in an error. Sub-nanosecond precision is not allowed
 * because:
 * 1) None of the timing related libraries support it.
 * 2) It may cause floating point errors in the NumericTimeInterval's
 *    number representation. Integers have up to 53 bits of precision to be exactly
 *    represented in a JavaScript number (i.e. a double), but anything right of the
 *    decimal point such as 0.1 may have a non-exact floating point representation.
 * @param t The numeric time interval to convert.
 */
export function timeIntervalToNumeric(t: TimeInterval): NumericTimeInterval{
    //Convert the TimeInterval to a BigInt in units of nanoseconds, then split it up.
    if(t === null){
        throw new Error('timeIntervalToNumeric cannot convert a null TimeInterval');
    }

    if(t === 0){
        return [0, 0];
    }

    if(Math.floor(t[0]) - t[0] !== 0){
        throw Error("Cannot convert TimeInterval " + t + " to a NumericTimeInterval "+
        "because it does not have an integer time.");
        //Allowing this may cause floating point errors.
    }

    const billion = BigInt(1000000000);

    let seconds: number;
    let nseconds: number;

    //To avoid overflow and floating point errors, work with BigInts.
    let bigT = BigInt(t[0]) * BigInt(t[1]);
    seconds = parseInt((bigT / billion).toString());
    nseconds = parseInt((bigT % billion).toString());

    return [seconds, nseconds];    

}

/**
 * Convert a number representing time in microseconds to a NumericTimeInterval
 * @param t the number in units of microseconds to convert
 */
export function microtimeToNumeric(t: number): NumericTimeInterval {
    const million = 1000000;
    const billion = 1000000000;

    //The associativity of these operations is very important because otherwise
    //there will be floating point errors.
    let seconds: number = Math.floor(t / million);
    let nseconds: number = t * 1000 - seconds * billion;
    return [seconds, nseconds];
}

/**
 * Calculate t1 - t2. Returns the difference as a NumericTimeInterval
 * Assumes t1 >= t2, and throws an error if this assumption is broken.
 * @param t1 minuend
 * @param t2 subtrahend
 */
export function numericTimeDifference(t1: NumericTimeInterval, t2: NumericTimeInterval): NumericTimeInterval {
    let difference:NumericTimeInterval = [0, 0];
    const billion = 1000000000;
    if(t1[1] >= t2[1]){
        difference[0] = t1[0] - t2[0];
        difference[1] = t1[1] - t2[1];
    } else {
        //Borrow a second
        difference[0] = t1[0] - 1 - t2[0];
        difference[1] = t1[1] + billion - t2[1];
    }
    if(difference[0] < 0 || difference[1] < 0){
        throw new Error("numericTimeDifference requires t1 >= t2");
    }
    return difference;
}

/**
 * Calculate t1 + t2. Returns the sum as a NumericTimeInterval
 * @param t1 addend 1
 * @param t2 addend 2
 */
export function numericTimeSum(t1: NumericTimeInterval, t2: NumericTimeInterval): NumericTimeInterval {
    const billion = 1000000000;

    let sum:NumericTimeInterval = [0, 0];
    
    if(t1[1] + t2[1] >= billion){
        //Carry the second
        sum[0] = t1[0] + t2[0] + 1;
        sum[1] = t1[1] + t2[1] - billion;
    } else {
        sum[0] = t1[0] + t2[0];
        sum[1] = t1[1] + t2[1];
    }
    return sum;
}

/**
 * Multiply a timeInterval t1, by a number t2. Returns the product as a NumericTimeInterval
 * @param t time interval to be multiplied
 * @param multiple number by which to multiply t
 */
export function numericTimeMultiple(t: NumericTimeInterval, multiple: number): NumericTimeInterval {
    const billion = 1000000000;
    let product:NumericTimeInterval = [0, 0];

    let nanoProduct = t[1] * multiple;
    let carry = Math.floor(nanoProduct/ billion)
    product[1] = nanoProduct - carry * billion;
    product[0] = t[0] * multiple + carry;
    
    return product;
}



//---------------------------------------------------------------------//
// Runtime Functions                                                   //
//---------------------------------------------------------------------//
// export function _schedule<T>(action:Action<T>, scheduleTime: TimeInstant) {
//     //FIXME
// }

// export function _schedule<T>(action:Action<T>, 
//     additionalDelay:TimeInterval, value:T | null): TimeInstant {
// return [0,0]
// }

//---------------------------------------------------------------------//
// Interfaces                                                          //
//---------------------------------------------------------------------//

/**
 * A Trigger is something which can cause an Event: a Timer, or an action.
 * Technically, inputs and output from contained reactors can also cause events,
 * but they can just directly put reactions on the reaction queue.
 * Reactions may register themselves as triggered by a Trigger. 
 */

export interface Trigger{}

// FIXME: I don't think we need this?
export interface Writable<T> {
    set: (value: T | null) => void;
}

// FIXME: I don't think we need this.
export interface Readable<T> {
    get: () => T | null;
}

// FIXME: I don't think we need this
/**
 * To be implemented by a top-level composite.  
 */
// export interface Executable {
//     start():void;
//     stop():void;
// }

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

// FIXME: call this a mutation?
export interface Transformation {
    
    container:Set<Reactor>;
    reactions:Array<Reaction>;

    new(container: Set<Reactor>, reactions:Array<Reaction>):Transformation;
}

/**
 * The reaction abstract class.
 * A concrete reaction class should extend Reaction, and implement a react function.
 */
export abstract class Reaction{

    //FIXME: for now state is the entire this for the parent reactor. This should be changed
    //to a custom data structure with only the state relevant to a reaction.
    state: Reactor;

    //Contains the timers, actions, and inputs that trigger this reaction.
    triggers: Array<Trigger>;
    priority: number;
    triggeringActions: Set<Action<any>>;

    //A reaction defaults to not having a deadline  
    deadline: null| Deadline = null;

    /**
     * Register this reaction's triggers with the app.
     * This step can't be handled in the constructor because
     * the app for this reaction is not known at that time.
     * The app will call this function later as part of its setup process.
     */
    public register(){
        console.log("Before register reaction");
        this.state.app.triggerMap.registerReaction(this);
        console.log("After register reaction");
    }

    constructor(state: Reactor, triggers: Array<Trigger>, priority: number){
        this.triggers = triggers;
        this.state = state;
        this.priority = priority;
    }

    /**
     * This react function must be overridden by a concrete reaction.
     */
    react(){
        throw new Error("react function hasn't been defined");
    }

    /**
     * More concise way to get logical time in a reaction.
     */
    public getCurrentLogicalTime(){
        return this.state.app.getCurrentLogicalTime();
    }
}

/**
 * The abstract class for a reaction deadline. A deadline is an optional relation
 * between logical time and physical time for a reaction. A reaction possessing a
 * deadline with a timeout of x seconds will invoke the deadline's handler()
 * function instad of its ordinary react() function if the reaction is invoked with 
 * physical time > logical time + timeout.
 */
export abstract class Deadline{

    timeout: TimeInterval;

    /**
     * This handler function must be overriden by a concrete handler.
     */
    handler(){
        throw new Error("handler function hasn't been defined.")
    }

    constructor(timeout: TimeInterval){
        this.timeout = timeout;
    }
}

/**
 * A prioritized reaction wraps a Reaction with a priority and precedence
 * and may be inserted into the reaction queue.
 * The priority of a reaction depends on the priority of its reactor, which is
 * determined by a topological sort of reactors.
 */
export class PrioritizedReaction implements PrecedenceGraphNode,
 PrioritySetNode<number,number>{

    r: Reaction;

    //Reaction attributes
    // triggers: Array<Trigger>;
    // react:(...args) => void;
    // state: Object;

    //Precedence graph node attributes
    _id: number;
    _next: PrioritySetNode<number,number> | null;
    _priority: number;

    constructor(r: Reaction, id: number) {
        this.r = r;
        this._id = id;
        this._next = null;
        this._priority = r.priority;
    }
    // constructor(reaction: Reaction, id: number,
    //     next: PrioritySetNode<number,number>|null, priority: number) {
    //     this.triggers = reaction.triggers;
    //     this.react = reaction.react;
    //     this.state = reaction.state;
    //     this._id = id;
    //     this._next = next;
    //     this._priority = priority;
    // }
    
    hasPrecedenceOver(node: PrioritySetNode<number,number>) {
        if (this._priority < node._priority) {
            return true;
        } else {
            return false;
        }
    }    
}

/**
 * An event is caused by a timer, caused by an input, or caused by an internal event
 * It occurs at a particular time instant and carries an arbitrary data type as payload.
 * There are three kinds of events: Timer, Input, and Internal.
 * They all have the same properties.
 */
//In the C implementation an event has a time, trigger, and payload.

//FIXME: Rename this class because it conflicts with a built in
//class in typescript 
export class Event {
    time: TimeInstant;
    cause: Trigger;
    payload: any;

    //FIXME: make payload optional
    constructor(cause: Trigger, time: TimeInstant, payload: any){
        this.time = time;
        this.cause = cause;
        this.payload = payload;
    }
}

//A prioritized reaction wraps an Event with a priority and precedence
//and may be inserted into the reaction queue.
//The priority of an Event is determined by its time. An Event with an earlier time
//than another has precedence.
export class PrioritizedEvent implements 
 PrioritySetNode<number,TimeInstant>{

    e: Event;

    //Precedence graph node attributes
    _id: number;
    _next: PrioritySetNode<number,TimeInstant> | null;
    _priority: TimeInstant;

    constructor(e: Event, id: number ){
        this.e = e;
        this._id = id;

        this._next = null;
        this._priority = e.time;
    }

    //TODO: remove leading underscore from _priority variable because it's not used
    //privately in cases like this?
    hasPrecedenceOver(node: PrioritySetNode<number,TimeInstant>) {
        return compareTimeInstants(this._priority, node._priority);
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


export class Action<T> implements Trigger {

    // The constructor for a reactor sets this attribute for each
    // of its attached timers.
    parent: Reactor;

    timeType: TimelineClass;
    minDelay: TimeInterval;
    name: string;

    //A payload is available to any reaction triggered by this action.
    //This timestamped payload can only be read as non
    _payload: TimestampedValue<T> | null;

    /**
     * @param parent The reactor containing this action.
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
    constructor(parent: Reactor, timeType: TimelineClass = TimelineClass.physical, minDelay: TimeInterval = 0){

        this.parent = parent;
        this.timeType = timeType;
        this.minDelay = minDelay;
        this.name = name;
    }

    schedule(delay: TimeInterval, payload?: T){
        console.log("Scheduling action.");
        if(delay === null){
            throw new Error("Cannot schedule an action with a null delay");
        }

        let timestamp: TimeInstant;
        let wallTime: NumericTimeInterval; 

        //FIXME: I'm not convinced I understand the spec so,
        //Probably something wrong in one of these cases...
        if(this.timeType == TimelineClass.physical){
            //physical
            wallTime = microtimeToNumeric(microtime.now());
            if(compareNumericTimeIntervals( this.parent.app.getCurrentLogicalTime()[0], wallTime )){
                timestamp = [this.parent.app.getCurrentLogicalTime()[0], this.parent.app.getCurrentLogicalTime()[1] + 1 ];
            } else {
                timestamp = [wallTime, 0 ];
            }
        } else {
            //logical
            if( timeIntervalIsZero(this.minDelay) && timeIntervalIsZero(delay)) {
                timestamp = [this.parent.app.getCurrentLogicalTime()[0], this.parent.app.getCurrentLogicalTime()[1] + 1 ];
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
                timestamp = [actionTime, this.parent.app.getCurrentLogicalTime()[1]];
            }
        }

        let actionEvent = new Event(this, timestamp, payload);
        let actionPriEvent = new PrioritizedEvent(actionEvent, this.parent.app.getEventID());
        this.parent.app.scheduleEvent(actionPriEvent);    
    }


    //FIXME Create isPresent function for actions? It would return true when the logical timestamps match.

    /**
     * Called on an action within a reaction to acquire the action's payload.
     * The payload for an action is set by a scheduled action event, and is only
     * present for reactions executing at that logical time. When logical time
     * advances, that previously available payload is now unavailable.
     */
    get(): T | null{
        if(this._payload && timeInstantsAreEqual(this._payload[0], this.parent.app.getCurrentLogicalTime())){
            return this._payload[1]
        } else {
            return null;
        }
    }
}


export class Timer{
    
    // The constructor for a reactor sets this attribute for each
    // of its attached timers.
    parent: Reactor;

    //For reference, the type of a TimeInterval is defined as:
    //TimeInterval = null | [number, TimeUnit] | 0;
    period: TimeInterval;
    offset: TimeInterval;
    
    //Timers always have top priority.
    // priority = 0;

    //A timer is only triggered by itself.
    triggers: Array<Trigger> = new Array();

    //Private variables used to keep track of rescheduling
    _timerFirings: number = 0;
    _offsetFromStartingTime: NumericTimeInterval;


    //The setup function should be used to start the timer using the offset.
    //It must be called before reschedule, or else _offsetFromStartingTime will
    //not be set.
    setup(){
        if(this.offset !== null && (this.offset === 0 || this.offset[0] >= 0)){
        //if(this.offset && this.offset[0] && this.offset[0] > 0 && this.offset[1]){
            
            let numericOffset = timeIntervalToNumeric(this.offset);
            this._offsetFromStartingTime =  numericTimeSum( numericOffset, this.parent.app.getStartingWallTime() );
            let timerInitInstant: TimeInstant = [this._offsetFromStartingTime, 0];
            let timerInitEvent: Event = new Event(this, timerInitInstant, null);
            let timerInitPriEvent: PrioritizedEvent = new PrioritizedEvent(timerInitEvent, this.parent.app.getEventID());
            
            console.log("In setup, this.parent is: " + this.parent);
            this.parent.app.scheduleEvent(timerInitPriEvent);

            console.log("Scheduled timer init for timer with period " + this.period + " at " + timerInitInstant);
        } else {
            throw new Error("Cannot setup a timer with a null or negative offset.");
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
        if(this.period !== null && (this.period === 0 || this.period[0] >= 0)){
            if(this.period !== 0 && this.period[0] > 0){
                // let numericOffset = timeIntervalToNumeric(this.offset);
                let numericPeriod = timeIntervalToNumeric(this.period);
                let nextLogicalTime: NumericTimeInterval = numericTimeSum(this._offsetFromStartingTime, 
                    numericTimeMultiple(numericPeriod , this._timerFirings) ); 
                let nextTimerInstant: TimeInstant = [nextLogicalTime, 0];
                let nextTimerEvent: Event = new Event(this, nextTimerInstant, null);
                let nextTimerPriEvent: PrioritizedEvent = new PrioritizedEvent(nextTimerEvent, this.parent.app.getEventID());
                console.log("In reschedule, this.parent : " + this.parent);
                this.parent.app.scheduleEvent(nextTimerPriEvent);

                console.log("Scheduling next event for timer with period " + this.period + " for time: " + nextTimerInstant);
            }

        } else {
            throw new Error("Cannot reschedule a timer with a null or negative period.");
        }
    };

    constructor(parent: Reactor, period:TimeInterval, offset:TimeInterval) {
        this.parent = parent;
        this.period = period;
        this.offset = offset;

        //Register this timer so it can be started when the runtime begins.
        // globals.timers.push(this);
    }

    adjustPeriod(period: TimeInterval):void {   
        // FIXME
    }
    
    // get():TimeInstant {
    //     // return current time
    //     return [0, 0];
    // }

    // 
}

//FIME: This comment seems out of date with the current LF spec
//regarding composites
/**
 * Each component has a name. It will typically also acquire a 
 * parent, unless it is a top-level composite. The parent property
 * is set/unset once a component is added to or removed from a 
 * container. Adding a component to a container will also ensure 
 * that it is uniquely indexed within that container.
 */
export abstract class Reactor implements Nameable {

    _transformations:Array<
            [   // triggers, transformation, transformation arguments
                Array<Trigger>, Transformation, any
            ]
    >;
    
    _reactions:Array<Reaction> = new Array<Reaction>();
    

    //_timers:Set<Timer> = new Set<Timer>();



    // _inputs:Map<string, InPort<any>> = new Map< string,InPort<any>>();
    // _outputs:Map<string, OutPort<any>> = new Map< string ,OutPort<any>>();
    // _actions:Map<string, Action<any>> = new Map<string, Action<any>>();

    parent: Reactor|null = null;
    app:App;
    //FIXME: Create getters and setters for children.
    children:Set<Reactor> = new Set<Reactor>();


    /**
     * Returns the set of reactions directly owned by this reactor combined with 
     * the recursive set of all reactions of contained reactors.
     */
    _getReactions(): Set<Reaction> {
        console.log("In _getReactions for: " + this._getFullyQualifiedName());
        var reactions = new Set<Reaction>();

        // Reactions part of this reactor
        for( let r of this._reactions){
            reactions.add(r);
        }

        // for (const [key, value] of Object.entries(this)) {
        //     console.log(key);
        //     if (value instanceof Reaction) {
        //         console.log("got a reaction!" + value);
        //         reactions.add(value);
        //     }
        // }

        // Recursively call this function on child reactors
        // and add their timers to the timers set.
        var subReactions: Set<Reaction>;
        if(this.children){
            for(const child of this.children){
                if(child){
                    subReactions = child._getReactions();
                    for(const subReaction of subReactions){
                        reactions.add(subReaction);
                    }                     
                }
            }
        }
        return reactions;
    }

    /**
     * Returns the set of timers directly owned by this reactor combined with 
     * the recursive set of all timers of contained reactors.
     */
    _getTimers(): Set<Timer> {
        var timers = new Set<Timer>();

        // Timers part of this reactor
        for (const [key, value] of Object.entries(this)) {
            if (value instanceof Timer) {
                timers.add(value);
            }
        }

        // Recursively call this function on child reactors
        // and add their timers to the timers set.
        var subTimers: Set<Timer>;
        if(this.children){
            for(const child of this.children){
                if(child){
                    subTimers = child._getTimers();
                    for(const subTimer of subTimers){
                        timers.add(subTimer);
                    }                     
                }
            }
        }
        return timers;
    }

    // addAction(a: Action<any>){
    //     this._actions.set(a.name, a);
    // }

    // //FIXME: return a copy
    // getAction(name: string){
    //     return this._actions.get(name);
    // }

    //FIXME: assign in constructor?
    // addPort(port: PortBase){
    //     if( port instanceof InPort){
    //         this._inputs.set(port._getName() ,port);
    //     } else if (port instanceof OutPort){
    //         this._outputs.set(port._getName() , port);
    //     } else {
    //         throw new Error("Can only addPorts to a reactor of type InPort or OutPort");
    //     }
    // }


    _setName: (string) => void;

    _acquire: (parent: Reactor) => boolean;

    _release: (parent: Reactor) => boolean;

    _getContainer: () => Reactor | null;

    _getName: () => string;

    _hasGrandparent: (container:Reactor) => boolean;

    _hasParent: (component: Reactor) => boolean;

    //A reactor's priority represents its order in the topological sort.
    //The default value of -1 indicates a priority has not been set.
    _priority: number = -1;

    //FIXME: assign in constructor?
    getPriority(){
        return this._priority;
    }

    setPriority(priority: number){
        this._priority = priority;
    }

    /**
     * Return a string that identifies this component.
     */
    _getFullyQualifiedName: () => string;


    /**
     * Recursively sets the app attribute for this reactor and all contained reactors to app.
     * @param app The app for this and all contained reactors.
     */
    public setApp( app: App){
        console.log("Starting setApp for: " + this._getFullyQualifiedName());
        this.app = app;
        // Recursively set the app attribute for all contained reactors to app.
        // Don't use reflection to find children because calling setApp on an
        // App which extends Reactor, results in infinite regress.
        if(this.children){
            for(let child of this.children){
                child.setApp(app);
            }
        }


        // for (const [key, value] of Object.entries(this)) {
        //     if (value instanceof Reactor) {
        //         value.setApp(app);
        //     }
        // }
    }



    //connect: <T>(source: Port<T>, sink:Port<T>) => void;
    // FIXME: connections mus be done sink to source so that we leverage contravariance of functions!!!
    /**
     * Create a new component; use the constructor name
     * if no name is given.
     * @param {string=} name - Given name
     */
    constructor(parent: null| Reactor, name?:string) {
        this.parent = parent;
        if(parent){
            parent.children.add(this);
        }
        
        var myName:string = this.constructor.name; // default
        var myIndex:number | null = null;
        // var relations: Map<Port<any>, Set<Port<any>>> = new Map();

        // Set this component's name if specified.
        if (name != null) {
            myName = name;
        }

        Object.assign(this, {
            _getFullyQualifiedName(): string {
                var path = "";
                if (parent != null) {
                    path = this.parent._getFullyQualifiedName();
                }
                if (path != "") {
                    path += "/" + this._getName();
                } else {
                    path = this._getName();
                }
                return path;
            }
        });

        Object.assign(this, {
            _getName():string {
                if (myIndex != null && myIndex != 0) {
                    return myName + "(" + myIndex + ")";
                } else {
                    return myName;
                }
            }
        });

        Object.assign(this, {
            _setName(name: string) {
                if (this.parent != null && (name != myName || myIndex == null)) {
                    //myIndex = parent._getFreshIndex(name); //FIXME: look at former composite
                    myName = name;
                }
            }
        });

        // Object.assign(this, {
        //     _hasGrandparent(container:Reactor): boolean {
        //         if (this.parent != null) {
        //             return this.parent._hasParent(container);
        //         } else {
        //             return false;
        //         }
        //     }
        // });

        Object.assign(this, {
            _hasParent(container:Reactor): boolean {
                if (this.parent != null && this.parent == container) {
                    return true;
                } else {
                    return false;
                }
            }
        });

        Object.assign(this, {
            _getContainer(): Reactor | null {
                return this.parent;
            }
        });

        // Object.assign(this, {
        //     _acquire(newParent: Reactor): boolean {
        //         if (this.parent == null) {
        //             parent = newParent;
        //             return true;
        //         } else {
        //             return false;
        //         }
        //     }
        // });
        
        // Object.assign(this, {
        //     _release(oldParent: Reactor): boolean {
        //         if (parent == oldParent) {
        //             parent = null;
        //             myIndex = null
        //             return true;
        //         } else {
        //             return false;
        //         }
        //     }
        // });

        // Object.assign(this, {
        //     connect<T>(source: Port<T>, sink: Port<T>):void {
        //         // bind T to constrain the type, check connection.
        //         if (source.canConnect(sink)) {
        //             var sinks = relations.get(source); 
        //             if (sinks == null) {
        //                 sinks = new Set();
        //             }
        //             sinks.add(sink);
        //             relations.set(source, sinks);
        //         } else {
        //             throw "Unable to connect."; // FIXME: elaborate error reporting.
        //             //throw "Cannot connect " + source.getFullyQualifiedName() + " to " + sink.getFullyQualifiedName() + ".";
        //         }
        //     // FIXME: check the graph for cycles, etc.
            
        //     }
        // });

        // Add it to a container if one is specified.
        // Note: the call to _add will invoke this._acquire,
        // so this code must be executed _after_ assigning
        // the _acquire function in the constructor.
        // if (parent != null) {
        //     //parent._add(this); // FIXME: add container capability to Reactor
        // }
    }

    
 
    // _getInputs(): Set<InPort<any>> {
    //     var inputs = new Set<InPort<any>>();
    //     for (const [key, value] of Object.entries(this)) {
    //         if (value instanceof InPort) {
    //             inputs.add(value);
    //         }
    //     }
    //     return inputs;
    // }

    // _getOutputs(): Set<OutPort<any>> {
    //     var outputs = new Set<OutPort<any>>();
    //     for (const [key, value] of Object.entries(this)) {
    //         if (value instanceof OutPort) {
    //             outputs.add(value);
    //         }
    //     }
    //     return outputs;
    // }

    // _getActions(): Set<Action<any>> {
    //     var actions = new Set<Action<any>>();
    //     for (const [key, value] of Object.entries(this)) {
    //         if (value instanceof Action) {
    //             actions.add(value);
    //         }
    //     }
    //     return actions;
    // }
    
}

export abstract class Port<T> implements Named {
    
    // The reactor containing this port
    // This attribute is set by the parent reactor's constructor.
    parent: Reactor;

    /***** Priviledged functions *****/

    /* Return a globally unique identifier. */
    _getFullyQualifiedName: () => string;
    _getName: () => string;

    hasGrandparent: (container:Reactor) => boolean;
    hasParent: (component: Reactor) => boolean; 

    connect: (source: Port<T>) => void;
    canConnect: (source: Port<T>)=> boolean;

    set: (value: T) => void;

    _connectedSinkPorts: Set<Port<T>> = new Set<Port<T>>();
    _connectedSourcePort: Port<T>| null = null;
    
    /* Construct a new port. */
    constructor(parent: Reactor) {
         this.parent = parent;

        Object.assign(this, {
            _getFullyQualifiedName(): string {
                return this.parent._getFullyQualifiedName() 
                    + "/" + this._getName();
            }

        });

        Object.assign(this, {
            hasParent(component: Reactor): boolean {
                if (component == this.parent) {
                    return true;
                } else {
                    return false;
                }
            }
        });
        
        Object.assign(this, {
            hasGrandparent(container:Reactor):boolean {
                if (container == this.parent._getContainer()) {
                    return true;
                } else {
                    return false;
                }
            }
        });

        Object.assign(this, {
            _getName(): string {
                var alt = "";
                for (const [key, value] of Object.entries(parent)) {

                    if (value === this) { // do hasOwnProperty check too?
                        return `${key}`;
                    }
                }
                return "anonymous";
            }
        });

        Object.assign(this, {
            /**
             * //FIXME: We will probably have to change something
             * here when we implement mutations.
             * Assigns a value to this port at the current logical time.
             * Put the reactions this port triggers on the reaction 
             * queue and recursively invoke this function on all connected output ports.
             * Note: It is considered incorrect for a reaction to directly call this
             * function on a port. Instead, reactions should call the "set()" function on 
             * an OutPort. InPorts should not be set().
             * @param value The value to assign to this output port.
             */
            _writeValue(value: T):void {
                console.log("calling _writeValue on: " + this);
                if(this instanceof InPort){
                    // Input ports can trigger reactions for the reactor
                    // they are attached to.
                    for (let r of this.parent._reactions) {
                        if (r.triggers.includes(this)) {
                            //Create a PrioritySetNode for this reaction and push the node to the reaction queue
                            let prioritizedReaction = new PrioritizedReaction(r, this.parent.app.getReactionID());
                            this.parent.app.scheduleReaction(prioritizedReaction);
                        }
                    }
                } else {
                    // Output ports can trigger reactions for a reactor containing the
                    // reactor they are attached to.
                    this.value = [this.parent.app.getCurrentLogicalTime(), value];
                    if(parent.parent){
                        for (let r of this.parent.parent._reactions) {
                            if (r.triggers.includes(this)) {
                                //Create a PrioritySetNode for this reaction and push the node to the reaction queue
                                let prioritizedReaction = new PrioritizedReaction(r, this.parent.app.getReactionID());
                                this.parent.app.scheduleReaction(prioritizedReaction);
                            }
                        }
                    }
                }

                for(const port of this._connectedSinkPorts){
                    port._writeValue(value);
                }
            }
       });
    }

    toString(): string {
        return this._getFullyQualifiedName();
    }
}


export class OutPort<T> extends Port<T> implements Port<T>, Writable<T> {

    value: TimestampedValue<T> | null = null;
    _connectedSinkPorts: Set<Port<T>> = new Set<Port<T>>();
    _connectedSourcePort: Port<T> | null = null;

    /***** Priviledged functions *****/
    canConnect: (destination: Port<T>) => boolean
    connect: (destination: Port<T>) => void;
    disconnect: () => void;
    set: (value: T ) => void;
    //get: () => T | null;

    /**
     * Create an OutPort.
     * @param parent The reactor containing this OutPort.
     */
    constructor(parent: Reactor) {
        super(parent);

        //FIXME: Delete? You should get() from an input port. 
        // Object.assign(this, {
        //     get(): T | null {
        //         return myValue;
        //     }
        // });
        

        Object.assign(this, {
            /**
             * Returns true if this port can be connected to sink. False otherwise. 
             * @param sink The port to test connection against. 
             */
            canConnect(sink: Port<T>): boolean {

                // Self-loops are not permitted.
                if(this == sink){
                    return false;
                }

                // OUT to In
                // Reactor with input port must be at the same level of hierarchy as
                // reactor with output port.
                if(sink instanceof InPort){ 
                    if(this.parent.parent == sink.parent.parent){
                        return true;
                    } else {
                        return false;
                    }
                
                // OUT to OUT
                // This reactor must be the child of sink's reactor 
                } else {
                    if(this.parent.parent == sink.parent){
                        return true;
                    } else {
                        return false;
                    }
                }
   
                // var thisComponent = parent;
                // var thisContainer = parent._getContainer();

                // if (sink instanceof InPort
                //     && thisContainer != null
                //     && sink.hasGrandparent(thisContainer) //
                //     && !sink.hasParent(thisComponent)) {
                //     // OUT to IN
                //     // - Component must be in the same container.
                //     // - Self-loops are not permitted.
                //     return true;
                // } else if (sink instanceof OutPort 
                //     && thisContainer instanceof Reactor 
                //     && sink.hasParent(thisContainer)) {
                //     // OUT to OUT
                //     // - Sink must be output port of composite that source component is contained by.
                //     return true;
                // }
                // else {
                //     return false;
                // }
                // solution: add Container here. Do tests prior to calling to verify it is the same
                return true;
            }
        });

        Object.assign(this, {

            /**
            * Write a value to this OutPort and recursively transmit the value to connected
            * ports while generating Port events for them. 
            * @param value The value to be written to this port.
            */
           set(value: T):void {
               this._writeValue(value);
           }
       });
        
        Object.assign(this, {

             /**
             * Connect this OutPort to a downstream port.
             * @param sink The port to which this OutPort should be connected.
             */
            connect(sink: Port<T>):void {
                console.log("connecting " + this + " and " + sink);
                this._connectedSinkPorts.add(sink);
                sink._connectedSourcePort = this;
             
                // var container = parent._getContainer();
                // if (container != null) {
                //     container.connect(this, sink);
                // } else {
                //     throw "Unable to connect: add the port's component to a container first.";
                // }
            }
        });

        Object.assign(this, {
            disconnect(sink: Port<T>): void {
                // this.connectedPort = null;
                this._connectedSinkPorts.delete(sink);
                sink._connectedSourcePort = null;
            }
            
            // disconnect(direction:"upstream"|"downstream"|"both"="both"): void {
            //     var component = parent;
            //     var container = component._getContainer();

            //     if (direction == "upstream" || direction == "both") {
            //         if (component instanceof Reactor) {    
            //             // OUT to OUT
            //             //component._disconnectContainedReceivers(this); //FIXME: add a transfer reaction
            //         }
            //     }

            //     if (direction == "downstream" || direction == "both") {
            //         // OUT to IN
            //         // OUT to OUT
            //         if (container != null) {
            //             //container._disconnectContainedSource(this);    //FIXME: add a transfer reaction
            //         }
            //     }
            // }
        });


    }

    //FIXME: Delete this comment? Sinks and sources aren't part of the LF spec.
    // NOTE: Due to assymmetry (subtyping) we cannot allow connecting 
    // sinks to sources. It must always be source to sink. Disconnect 
    // does not have this problem.
    // connect(sink: Port<$Supertype<T>>): void {
        
    // }

    toString(): string {
        return this._getFullyQualifiedName();
    }

}

export class InPort<T> extends Port<T> implements Readable<T> {

    /**
     * If an InPort has a null value for its connectedPort it is disconnected.
     * A non-null connectedPort is connected to the specified port.
     */
    _connectedSinkPorts: Set<Port<T>> = new Set<Port<T>>();
    _connectedSourcePort: Port<T> | null = null;
    // _name: string = "";
    //_receivers: Set<Port<T>>;
    //_parent: Component; // $ReadOnly ?
    //_persist: boolean;

    /***** Priviledged functions *****/
    canConnect:(source: Port<T>) => boolean;        
    connect: (source: Port<T>) => void;
    disconnect: (source: Port<T>) => void;
    //send: (value: ?$Subtype<T>, delay?:number) => void;
    get: () => T | null;
    //writeValue: (value: T ) => void;

    /**
     * Create a new InPort.
     * @param parent The reactor containing this InPort
     */
    constructor(parent: Reactor) {
        super(parent);
        
        Object.assign(this, {
            

            /**
             * Returns true if the connected port is directly or indirectly connected to
             * an output port with a value set at the current logical time. Returns false otherwise
             * Throws an error if not connected directly or indirectly to an output port.
             */
            isPresent():boolean {
                if(this._connectedSourcePort){
                    if(this._connectedSourcePort instanceof OutPort){
                        if(this._connectedSourcePort.value === null ||
                            ! timeInstantsAreEqual(this._connectedSourcePort.value[0], this.parent.app.getCurrentLogicalTime() )){
                                return false;
                            } else {
                                return true;
                            }
                    } else {
                        return this._connectedSourcePort.isPresent();
                    }
                } else {
                    throw new Error("Cannot test a disconnected input port for a present value.")
                }
            }
        });

        Object.assign(this, {

            /**
             * Obtains a value from the connected port. If connected to an output port, this
             * can be done directly. If connected to an input port, recursively call get on that.
             * Throws an error if this port is not connected to anything
             * or is connected to a chain of input ports which is not terminated by a connection
             * to an output port.
             * Will return null if the connected output did not have its value set at the current
             * logical time.
             */
            get():T | null {
                console.log("calling get on " + this);
                if(this._connectedSourcePort){
                    if(this._connectedSourcePort instanceof OutPort){
                        if(this.isPresent()){
                            return this._connectedSourcePort.value[1];
                        } else {
                            return null;
                        }
                    } else {
                        return this._connectedSourcePort.get();
                    }
                } else {
                    throw new Error("Cannot get value from a disconnected port.")
                }
            }
        });





        
        Object.assign(this, {   
            /**
             * Returns true if this port can be connected to source. False otherwise. 
             * @param sink The port to test connection against. 
             */
            canConnect(sink: Port<T>): boolean {
                
                //Self loops are not allowed.
                if(sink == this){
                    return false;
                }
                if(sink instanceof InPort){
                    // IN to IN
                    // sink's reactor must be the child of this one.
                    if(sink.parent.parent == this.parent){
                        return true;
                    } else {
                        return false;
                    }
                } else{
                    // IN to OUT
                    // An output port can't be the sink of an input port.
                    return false;

            //     var thisComponent = parent;
            //     var thisContainer = parent._getContainer();

            //     if (thisComponent instanceof Reactor 
            //         && sink instanceof InPort 
            //         && sink.hasGrandparent(thisComponent)) {
            //         return true;
            //     } else {
            //         return false;
            //     }


                }
            }
        });

        Object.assign(this, {
            /**
             * Connect this InPort to a downstream port.
             * @param sink the port to connect to.
             */
            connect(sink: Port<T>):void {
                console.log("connecting " + this + " and " + sink);
                this._connectedSinkPorts.add(sink)
                sink._connectedSourcePort = this;
            }
        });

        Object.assign(this, {
            disconnect(sink: Port<T>): void {
                this._connectedSinkPorts.delete(this);
                sink._connectedSourcePort = null;
                
            }
            // disconnect(direction:"upstream"|"downstream"|"both"="both"): void {
            //     var component = parent;
            //     var container = component._getContainer();

            //     if (direction == "upstream" || direction == "both") {
            //         if (container != null) {
            //             // OUT to IN
            //             // IN to IN
            //             //container._disconnectContainedReceivers(this); // FIXME: this should result in the removal of a transfer reactions
            //         }    
            //     }

            //     if (direction == "downstream" || direction == "both") {
            //         if (component instanceof Reactor) {
            //             // IN to IN
            //             //component._disconnectContainedSource(this);
            //         }
            //         if (container != null) {
            //             // IN to OUT
            //             //container._disconnectContainedSource(this);
            //         }
            //     }
            // }
        });
    }

    toString(): string {
        return this._getFullyQualifiedName();
    }
}


/**
 * This class matches a Trigger to the Reactions it triggers.
 * When an event caused by a Trigger comes off the event queue, its
 * matching reactions should be put on the the reaction queue 
 */
export class TriggerMap{
    _tMap: Map<Trigger, Set<Reaction>> = new Map<Trigger, Set<Reaction>>();

    /**
     * Establish the mapping for a Reaction.
     */
    registerReaction(r: Reaction){
        for(let trigger of r.triggers){
            let reactionSet = this._tMap.get(trigger);
            if(reactionSet){
                if(! reactionSet.has(r)){
                    reactionSet.add(r);
                    this._tMap.set(trigger, reactionSet);
                }
                //If this reaction is already mapped to the trigger,
                //do nothing.
            } else {
                //This is the first reaction mapped to this trigger,
                //so create a new reaction set for it.
                reactionSet = new Set<Reaction>();
                reactionSet.add(r);
                this._tMap.set(trigger, reactionSet);
            }
        }
    }

    /**
     * Get the set of reactions for a trigger.
     */
    getReactions(t: Trigger){
        return this._tMap.get(t);
    }

    /**
     * FIXME
     */
    deregisterReaction(e: Event){
        //FIXME
    }

}

//FIXME: Move runtime from globals into here.
export class App extends Reactor{
    
    // // FIXME: add some logging facility here
    // name: string;

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
    private _reactionQ = new PrioritySet<number,number>();
    private _eventQ = new PrioritySet<number,TimeInstant>();

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
    private _observedActionEvents : Map<Action<any>, PrioritizedEvent> = new Map<Action<any>, PrioritizedEvent>();

    // FIXME: Use BigInt instead of number?
    /** 
     * Track IDs assigned to reactions and events
     */
    private _reactionIDCount = 0;
    private _eventIDCount = 0;    

    /**
     * Acquire all the app's timers and call setup on each one.
     */
    private _startTimers = function(){
        let timers: Set<Timer> = this._getTimers();
        for(let t of timers){
            t.setup();
        }
    };

    /**
     * Register all the app's reactions with their triggers.
     */
    private _registerReactions = function(){
        let reactions: Set<Reaction> = this._getReactions();
        // console.log("reactions set in _registerReactions is: " + reactions);
        for(let r of reactions){
            console.log("registering: " + r);
            r.register();
        }
    }


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
        console.log("starting _next");
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
            if(compareNumericTimeIntervals(currentPhysicalTime, currentHead._priority[0] )){
                //Physical time is behind logical time.
                let physicalTimeGap = numericTimeDifference(currentHead._priority[0], currentPhysicalTime, );
            
                //Wait until min of (execution timeout and the next event) and try again.
                let timeout:NumericTimeInterval;
                if(this._executionTimeout && compareNumericTimeIntervals(this._relativeExecutionTimeout, physicalTimeGap)){
                    timeout = this._relativeExecutionTimeout;
                } else {
                    timeout = physicalTimeGap;
                }
                console.log("Runtime set a timeout at physical time: " + currentPhysicalTime +
                 " for an event with logical time: " + currentHead._priority[0]);
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
                
                //FIXME: Delete this comment when we're sure nanotimer is the right way to go.
                // setTimeout(  ()=>{
                //     _next(successCallback, failureCallback);
                //     return;
                // }, timeout);
                return;
            } else {
                //Physical time has caught up, so advance logical time
                this._currentLogicalTime = currentHead._priority;
                console.log("At least one event is ready to be processed at logical time: "
                 + currentHead._priority + " and physical time: " + currentPhysicalTime );
                // console.log("currentPhysicalTime: " + currentPhysicalTime);
                //console.log("physicalTimeGap was " + physicalTimeGap);

                // Using a Set data structure ensures a reaction triggered by
                // multiple events at the same logical time will only react once.
                let triggersNow = new Set<Reaction>();

                // Keep track of actions at this logical time.
                // If the same action has been scheduled twice
                // make sure it gets the correct (last assigned) payload.
                this._observedActionEvents.clear();


                // Remove all simultaneous events from the queue.
                // Reschedule timers, assign action values, and put the triggered reactions on
                // the reaction queue.
                // This loop should always execute at least once.
                while(currentHead && timeInstantsAreEqual(currentHead._priority, this._currentLogicalTime)){


                    //An explicit type assertion is needed because we know the
                    //eventQ contains PrioritizedEvents, but the compiler doesn't know that.
                    let trigger: Trigger = (currentHead as PrioritizedEvent).e.cause;
                    
                    if(trigger instanceof Timer){
                        trigger.reschedule();
                    }

                    if(trigger instanceof Action){
                        // Check if this action has been seen before at this logical time.
                        if(this._observedActionEvents.has(trigger) ){
                            // Whichever event for this action has a greater eventID
                            // occurred later and it determines the payload. 
                            if( currentHead._id > (this._observedActionEvents.get(trigger) as PrioritizedEvent)._id ){
                                trigger._payload = 
                                [ this._currentLogicalTime, (currentHead as PrioritizedEvent).e.payload];   
                            }
                        } else {
                            this._observedActionEvents.set(trigger, (currentHead as PrioritizedEvent));
                            trigger._payload = 
                            [ this._currentLogicalTime, (currentHead as PrioritizedEvent).e.payload];
                        }
                    }
                    console.log("Before triggermap in next");
                    let toTrigger = this.triggerMap.getReactions(trigger);
                    // console.log(toTrigger);
                    console.log("after triggermap in next");
                    if(toTrigger){
                        for(let reaction of toTrigger){

                            //FIXME: I think we can get rid of this with reflection
                            //what is actionArray used for?
                             //Ensure this reaction is matched to its actions 
                            // if(trigger instanceof Action){
                            //     let actionArray = reactionsToActions.get(reaction);
                            //     if( ! actionArray){
                            //         actionArray = new Set<Action<any>>();
                            //     } 
                            //     actionArray.add(trigger);
                            // }

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
                    let prioritizedReaction = new PrioritizedReaction(reaction, this.getReactionID());
                    this._reactionQ.push(prioritizedReaction);
                }
                
                let headReaction = this._reactionQ.pop();
                while(headReaction){
                    // Explicit type annotation because reactionQ contains PrioritizedReactions.
                    let r = (headReaction as PrioritizedReaction).r
                    
                    // Test if this reaction has a deadline which has been violated.
                    // This is the case if the reaction has a registered deadline and
                    // logical time + timeout < physical time
                    if(r.deadline && compareNumericTimeIntervals( 
                            numericTimeSum(this._currentLogicalTime[0], timeIntervalToNumeric(r.deadline.timeout)),
                            currentPhysicalTime)){
                        console.log("handling deadline violation");
                        r.deadline.handler();
                    } else {
                        console.log("reacting...");
                        r.react();
                    }
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

    //FIXME: just get the timers from reactors at the start.
    /**
     * Array of timers used to start all timers when the runtime begins.
     * _timers are registered here in their constructor.
     */
    // private var timers: Array<Timer> = [];



    /**
     * FIXME
     * @param executionTimeout 
     * @param name 
     */
    constructor(executionTimeout: TimeInterval | null, name?: string) {
        super(null, name)
        // Note: this.parent will be initialized to null in super because this app has
        // no parent to set it otherwise.

        this._executionTimeout = executionTimeout;
    }

        /**
     * Maps triggers coming off the event queue to the reactions they trigger.
     * Public because reactions need to register themselves with this structure
     * when they're created. 
     */
    public triggerMap: TriggerMap = new TriggerMap();

    /**
     * Public method to push events on the event queue. 
     * @param e Prioritized event to push onto the event queue.
     */
    public scheduleEvent(e: PrioritizedEvent){  
        this._eventQ.push(e);
    }

    /**
     * Public method to push reaction on the reaction queue. 
     * @param e Prioritized reaction to push onto the reaction queue.
     */
    public scheduleReaction(r: PrioritizedReaction){  
        this._reactionQ.push(r);
    }

    /**
     * Obtain a unique identifier for the reaction.
     */
    public getReactionID(){
        return this._reactionIDCount++;
    }

    /**
     * Public getter for logical time. 
     */
    public getCurrentLogicalTime(){
        return this._currentLogicalTime;
    }
    
    /**
     * Obtain a unique identifier for the event.
     * Note: The monotonicly increasing nature of eventIDs
     * is used to resolve priority between duplicate events with the same
     * timestamp in the eventQ.
     */
    public getEventID(){
        return this._eventIDCount++;
    }

    /**
     * Public getter for starting wall time.
     */
    public getStartingWallTime(){
        return this._startingWallTime
    }
    


    public start(successCallback: () => void , failureCallback: () => void):void {
        // Recursively set the app attribute for this and all contained reactors to this.
        this.setApp(this);
        // Recursively register reactions of contained reactors with triggers in the triggerMap.
        this._registerReactions();
        // console.log(this.triggerMap);
        this._startingWallTime = microtimeToNumeric(microtime.now());
        this._currentLogicalTime = [ this._startingWallTime, 0];
        if(this._executionTimeout !== null){
            this._relativeExecutionTimeout = numericTimeSum(this._startingWallTime, timeIntervalToNumeric(this._executionTimeout));
        }
        this._startTimers();
        this._next(successCallback, failureCallback);

    }



    //FIXME:
    // stop():void {

    // }

    //FIXME: What is this function supposed to do?
    // _checkTypes() {

    // }
}

//---------------------------------------------------------------------//
// Commented Out Code                                                 //
//---------------------------------------------------------------------//
//For whatever reason, code I don't want to delete just yet.


//Moved to commented section because this interface is redundant with new
//Port base class. I combined base class with these functions 
//WARNING: Out of date documentation.
/**
 * An interface for ports. Each port is associated with a parent component.
 * Ports may be connected to downstream ports using connect(). 
 * Connections between ports can be destroyed using disconnect().
 * Messages can be sent via a port using send(). Message delivery is immediate
 * unless a delay is specified.
 */
// export interface Port<T> extends  Named {

//     hasGrandparent: (container:Reactor) => boolean;
//     hasParent: (component: Reactor) => boolean;

//     connect: (source: Port<T>) => void;
//     canConnect(source: Port<T>): boolean;


// }


//FIXME: I don't know what the purpose of this is.
/**
 * A generic container for components.
 */
// export interface Container<T: Reactor> {

//     /**
//      * Add a list of elements to this container. Duplicate entries will
//      * not be kept.
//      * @param {T} element
//      */
//     _add(...elements: Array<T>): void;

//     /**
//      * Return whether or not the argument is present in the container.
//      * @param {T} element
//      */
//     _contains(element: T): boolean;

//     /**
//      * Remove an element from this container.
//      * @param {string} name
//      */
//     _remove(element: T): void;

//     //_move(element: T, destination: Container<T: Component>)

// }


//An interface for classes implementing a react function.
//Both reactions and timers react to events on the event queue
// export interface Reaction {
//     react:() => void;
//     triggers: Array<Trigger>;
//     priority: number;
// }


//Matt: An action is an internal event so I think there's a lot of overlap with
//that class and the below code.
//BEGIN COMMENTED OUT ACTION CLASS

/**
 * An action denotes a self-scheduled event. If an action is instantiated
 * without a delay, then the time interval between the moment of scheduling
 * this action (cause), and a resulting reaction (effect) will be determined
 * upon the call to schedule. If a delay _is_ specified, it is considered
 * constant and cannot be overridden using the delay argument in a call to 
 * schedule().
 */
// export class Action<T> implements Trigger {
//     get: () => T | null;

//     /**
//      * Schedule this action. If additionalDelay is 0 or unspecified, the action 
//      * will occur at the current logical time plus one micro step.
//      */
//     schedule: (additionalDelay?:TimeInterval, value?:T) => TimeInstant;

//     constructor(parent:Reactor, delay?:TimeInterval) { 
//         var _value: T;

//         Object.assign({
//             get(): T | null {
//                 return _value;
//             }
//             // FIXME: add writeValue
//         });

//         Object.assign(this, {
//             schedule(additionalDelay:TimeInterval, value?:T): TimeInstant {
//                 let numericDelay: number;
                
//                 //FIXME
//                 // if(additionalDelay == null || additionalDelay == 0
//                 //      || additionalDelay[0] == 0){


//                 // }

//                 // if ( (delay == null || delay === 0) &&  ) {
//                 //     numericDelay = timeIntervalToNumber(additionalDelay);
//                 // } else {
//                 //     if (additionalDelay != null && additionalDelay !== 0) {
//                 //         delay[0] += timeIntervalToNumber(additionalDelay);
//                 //     }
//                 // }
//                 // return _schedule(this, delay, value);
//             }
//         });
//     }

//     unschedule(handle: TimeInstant):void {
//         // FIXME
//     }
// }

//END COMMENTED OUT ACTION CLASS

// export interface Schedulable<T> {
//     schedule: (additionalDelay?:TimeInterval, value?:T) => TimeInstant;
//     unschedule(handle: TimeInstant):void;
// }

//FIXME: I believe the current LF spec has all inputs contained.
// class ContainedInput<T> implements Writable<T> {
    
//     set: (value: T | null) => void;

//     constructor(reactor:Reactor, port:InPort<T>) {
//         var valid = true;
//         if (!port.hasParent(reactor)) {
//             console.log("WARNING: port " + port._getFullyQualifiedName()
//                 + "is improperly used as a contained port; "
//                 + "set() will have no effect.");
//             valid = false;
//         }

//         Object.assign(this, {
//             set(value:T | null): void {
//                 if (valid) {
//                     return port.writeValue(reactor, value);
//                 }
//             }
//         });
//     }
// }

//FIXME: I believe the current LF spec has all outputs contained.
// class ContainedOutput<T> implements Readable<T> {
//     get: () => T | null; // FIXME: remove readable from output!!
    
//     constructor(reactor:Reactor, port:OutPort<T>) {
//         var valid = true;
//         if (!port.hasParent(reactor)) {
//             console.log("WARNING: port " + port._getFullyQualifiedName()
//                 + "is improperly used as a contained port; "
//                 + "get() will always return null.");
//             valid = false;
//         }

//         Object.assign(this, {
//             get(): T | null {
//                 if (!valid) {
//                     return null;
//                 } else {
//                     return port.get();
//                 }
//             }
//         });
//     }
// }

// class CallerPort<A,R> implements Connectable<CalleePort<A,R>> {

//     constructor() {

//     }

//     call() {

//     }

//     connect(sink: CalleePort<A,R>):void {
//         return;
//     }

//     canConnect(sink: CalleePort<A,R>):boolean {
//         return true;
//     }

//     invokeRPC: (arguments: A, delay?:number) => R;

// }

// class CalleePort<A,R> {

// }

// export interface Connectable<T> {
//     +connect: (source: T) => void;
//     +canConnect: (source: T) => boolean;
// }


// NOTE: composite IDLE or REACTING.
// If IDLE, get real time, of REACTING use T+1

// export class Composite extends Component implements Container<Component>, Reactor {

//     _getFreshIndex: (string) => number;
//     _disconnectContainedReceivers: (port: Port<*>) => void;
//     _disconnectContainedSource: (port: Port<*>) => void;
//     _getGraph: () => string;

//     connect: <T>(source: Port<T>, sink:Port<T>) => void;
//     //disconnect: (port: Port<*>, direction?:"upstream"|"downstream"|"both") => void;
//     schedule: <T>(action:Action<T>, value:any, repeat?:boolean) => number;
//     getCurrentTime: () => Time;

//     _init:() => void;
//     _wrapup: () => void;
//     _react:() => void;  
//     _reactions:$ReadOnlyArray<[Array<Trigger<*>>, Reaction<any, any>]>;

//     constructor(parent:?Composite, name?:string) {
//         super(parent, name);

//         /* Private variables */
//         var relations: Map<Port<any>, Set<Port<any>>> = new Map();
        
//         //var eventQ: Map<Time, Map<*>, *> = new Map();

//         // queue for delayed triggers
//         var triggerQ: Map<number, [Map<Action<any>, any>]> = new Map();

//         // queue for delayed sends
//         var sendQ: Map<number, [Map<Port<any>, any>]> = new Map();

//         var indices: Map<string, number> = new Map();

//         var actors: Set<ReActor> = new Set();

//         // we need to express dependencies between reactions, not between ports
//         var dependencies: Map<Reaction<mixed>, Reaction<mixed>> = new Map();

//         Object.assign(this, {
//             _init() {
//                 for (let a of actors) {
//                     for (let r of a._reactions) {

//                     }
//                 }
//             }
//         });
        

//         Object.assign(this, {
//             schedule<T>(action:Action<T>, value:any, repeat?:boolean): number {
                
//                 return 0;
//             }
//         });
//         // We don't want to run ahead of realtime, because actors can produce spontaneous events that need to be stamped with 
//         // wallclock time, and we don't want these timestamps to be "in the past".
//         // DAC Properties A1-9.
//         // Simple examples. Which should those be?
//         // First one to start with: sensor computation actuator
//         // Introduce notion of a deadline
//         // Why on the local platform, model should not get ahead.
//         // Example 1: Synchronization to real time and deadlines
//         // Example 2: Why delay has to wait
//         // Example 3: shut off the lights some time after the switch has been flipped.
//         // Reason to have the deadline definition as stated: detectability. Suppose the start deadline cannot be met; the
//         // reaction should not be carried out (and then the violation be reported on).
        

//         Object.assign(this, {
//             // FIXME: We may want to wrap this into something like a change request and 
//             // let the composite handle it at the next microstep.
//             connect<T>(source: Port<T>, sink: Port<T>):void {
//                 // bind T to constrain the type, check connection.
//                 if (source.canConnect(sink)) {
//                     var sinks = relations.get(source); 
//                     if (sinks == null) {
//                         sinks = new Set();
//                     }
//                     sinks.add(sink);
//                     relations.set(source, sinks);
//                 } else {
//                     throw "Unable to connect."; // FIXME: elaborate error reporting.
//                     //throw "Cannot connect " + source.getFullyQualifiedName() + " to " + sink.getFullyQualifiedName() + ".";
//                 }
//             // FIXME: check the graph for cycles, etc.
            
//             }
//         });
//         // FIXME: persistent <=> default
//         // Comments from Stoyke. 1) What if you want non-determinism? Parameter store. Stores the parameters that you are learning.
//         // Fairly common strategy. Parallel processes. All updating the parm store asynchronously.
//         // 2) How to handle dynamic instantiation?

//         Object.assign(this, {
//             _getFreshIndex(name: string): number {
//                 var index = 0;
//                 if (indices.has(name)) {
//                     index = indices.get(name)+1;
//                     indices.set(name, index);
//                 } else {
//                     indices.set(name, index);
//                 }
//                 return index;
//             }
//         });

//         Object.assign(this, {
//             _react() {
//                 for (var prop in this) {
//                     if (prop instanceof InPort) {
//                         console.log("port: " + prop.toString());
//                     }

//                     if (prop instanceof OutPort) {
//                         console.log("output: " + prop.toString());
//                     }
//                     // Skip properties that are not ports.
//                 }
//             }
//         });

//         Object.assign(this, {
//             _disconnectContainedReceivers(port: Port<*>): void {
//                 for (var receivers of relations.values()) {
//                         receivers.delete(port);
//                 }
//             }

//         });

//         Object.assign(this, {
//             _disconnectContainedSource(port: Port<*>): void {
//                 relations.delete(port);
//             }
//         });
    
//         Object.assign(this, {
//             _add(...components: Array<Component>): void {
//                 for (var c of components) {
//                     c._acquire(this);
//                     c._setName(c._getName()); // to ensure proper indexing
                    
//                     // FIXME: is actor, not component actors.add(c);
//                 }
//             }
//         });

//         Object.assign(this, {
//             _getGraph(): string {
//                 var str = "";
//                 relations.forEach(function(val, key, map) {
//                     str += `${key._getFullyQualifiedName()} => ` + "[";
//                     for (var p of val) {
//                         str += p._getFullyQualifiedName() + ", ";
//                     }
//                     str = str.substring(0, str.length-2);
//                     str += "]"
//                 });
//                 return str;
//             }
//         });
//     }


//     /**
//      * Add a list of elements to this container.
//      * @param {T} element
//      */
//     _add: (...components: Array<Component>) => void;
        

//     /**
//      * Return whether or not the argument is present in the container.
//      * @param {T} element
//      */
//     _contains(element: Component): boolean { // FIXME!
//         return true; //this._components.includes(element);
//     }

//     /**
//      * Remove an element from this container.
//      * @param {string} name
//      */
//     _remove(element: Component): void {
//         // check whether it is connected to anything
//         // remove all connections
//     }

// }

// /**
//  * A parameter is an input port that has a default value. 
//  * If no current value is present, get() returns the default value.
//  * Unlike regular input ports, parameters are persisent by default,
//  * which means that their current value only changes when an new
//  * input becomes known _and present_ (i.e., the current value remains
//  * unchanged until the next message arrives). 
//  */
// export class Parameter<T> extends InPort<T> {

//     default:T;
    
//     get: () => T | null;
//     read: () => T;

//     constructor(parent: Reactor, defaultValue:T, persist:boolean=true) {
//         super(parent, persist);
//         this._value = defaultValue; // FIXME: probably put this in the constructor scope
//         // Object.assign(this, {
//         //     send(value: ?$Subtype<T>, delay?:number): void {
//         //         if (value == null) {
//         //             this.reset();
//         //         } else {
//         //             this._default = value; // FIXME: default vs current value
//         //         }
//         //     }
//         // });

//         Object.assign(this, {
//             read(): T {
//                 let val = this.get();
//                 if (val != null) {
//                     return val; 
//                 } else {
//                     return this.default;
//                 }
//             }
//         });
//     }

//     reset() {
//         this._value = this.default;
//     }

// }



/**
 * Base class for reactions that has two type parameters: 
 * T, which describes a tuple of inputs/outputs/actions it may use;
 * S, which describes an object that keeps shared state.
 * The reaction can also maintain state locally.
 */

 // triggeredby/uses/produces
// export class Reaction<T,S:?Object> {

//     io:T
//     shared:S;
    


// // FIXME: need a get/set/schedule here to shadow the global one

//     portsInScope: () => [Set<InPort<mixed>>, Set<OutPort<mixed>>];

//     +react: (time?:number) => void;

//     constructor(io:T, state:S) {
//         this.io = io;
//         this.shared = state;

//         /**
//          * Given some data structure, recursively find all references
//          * to any input and output ports.
//          */
//         function collect(inputs: Set<InPort<mixed>>, 
//             outputs: Set<OutPort<mixed>>, visited: Set<Object>, data:any) {
//             if (data instanceof InPort) {
//                 inputs.add(data);
//             } 
//             else if (data instanceof OutPort) {
//                 outputs.add(data);
//             }
//             else if (data != null && data === Object(data)) {
//                 visited.add(data);
//                 if (typeof data[Symbol.iterator] === 'function') {
//                     // Iterate if iterable
//                     for (let elem of data) {
//                         if (!visited.has(elem))
//                             collect(inputs, outputs, visited, elem);
//                     }
//                 } else {
//                     // Loop over object entries otherwise
//                     for (const [key, value] of Object.entries(data)) {
//                         if (!visited.has(value))
//                             collect(inputs, outputs, visited, value);
//                     }            
//                 }
//             } else {
//                 console.log(data)
//             }
//         }

//         Object.assign(this, {
//             portsInScope(): [Set<InPort<mixed>>, Set<OutPort<mixed>>] {
//                 var inputs = new Set<InPort<mixed>>();
//                 var outputs = new Set<OutPort<mixed>>();
//                 collect(inputs, outputs, new Set<Object>(), this);
//                 return [inputs, outputs];
//             }
//         });
//     }
// }

// export class OrderedAsyncReaction<T, S, R, E> extends Reaction<T, S> {

//     reqID = -1;
//     queue: PriorityQueue<R> = new PriorityQueue();
//     response: Action<R>;
//     error: Action<E>;

//     constructor(io:T, state:S, response:Action<R>, error:Action<E>) {
//         super(io, state);
//         this.response = response;
//         this.error = error;
//     }

//     react(time?: number):void {
        
//         let myID = this.reqID++;
//         // this.queue.push(null, myID); FIXME: find another way to do this
//         (async () => {
//             try {
//                 const response = await this.doAsync();
//                 var firstInLine = this.queue.first();
                
//                 // schedule reactions to preceeding replies
//                 while(firstInLine.value != null && firstInLine.priority < myID) {
//                     this.response.schedule(this.queue.pop()); // NOTE: schedule must pile these up in superdense time!
//                     firstInLine = this.queue.first();
//                 }

//                 if (firstInLine.priority == myID) {
//                     // schedule a reaction to the current reply
//                     this.response.schedule(response);
//                     this.queue.pop();
//                 } else {
//                     //this.queue.update(response, myID); FIXME
//                 }
                
//                 // further empty the queue as much as possible
//                 while(firstInLine.value != null) {
//                     this.response.schedule(this.queue.pop());
//                     firstInLine = this.queue.first();
//                 }
                
//             } catch (err) {
                
//                 // remove corresponding entry from the queue
//                 this.queue.remove(myID);

//                 // schedule a reaction to the error
//                 this.error.schedule(err);

//                 var firstInLine = this.queue.first();
//                 // further empty the queue as much as possible
//                 while(firstInLine.value != null) {
//                     this.response.schedule(this.queue.pop());
//                     firstInLine = this.queue.first();
//                 }
//             }
//         })();
//     }

//     doAsync(): Promise<R> {
//         return new Promise(function(resolve, reject) {});
//     }

// }



// Eventually, this should become a worker/threaded composite
// Also, check out https://github.com/laverdet/isolated-vm





// class Countdown {
//     constructor(counter, action) {
//         Object.assign(this, {
//             dec(): boolean {
//                 return true;
//             }
//         });
//     }
    
//     dec: () => boolean
// }


// const c = new Countdown(2, () => console.log('DONE'));
// c.dec();
// c.dec();


// class FinalClass {
//     constructor(secret) {
//     if (this.constructor !== FinalClass) {
//       throw new Error('Subclassing is not allowed');
//     }
//   }
// }

// class Extension extends FinalClass {

// }

// let y = new Extension();

// var oldProto = FinalClass.prototype;
// FinalClass = function(secret) { console.log(secret)};
// FinalClass.prototype = oldProto;

// let z = new FinalClass("do not read this");





// Scenario 1:
// The composite reacts to inputs.
// - set the inputs of the receivers
// - let them react in dependency order

// *** what if there is a delay?
// - 


// Scenario 2:
// An actor spontaneously emits an event


// datastructures:
// - dependency graph


// - calendarQ t -> [], where events are sorted by priority/index
// types of events:
// - self-scheduled
// - dataflow (from other actors)
// *** what about RMI?
// - the schedule must ensure that upon invocation all inputs are known
// - the invocation itself must be a call similar to send(), except it has to function like a procedure call (do we need two stacks?)
//   - before a remote procedure can yield/return, all of the inputs it uses must be known
//   - reactions within the same actor must be mutually atomic, across actors this need not be the case
// *** how are reactions and RPCs different?
//   - RPCs are reactions that are triggered by an event on a CalleePort<A,R>
//   - an RPC port is special because it has an argument type and a return type
//   - the return value must be set by the callee
// *** what if there are multiple callers?
//   - this is similar to the problem of multiple senders; a reaction will take place for each distinct caller/sender
//   - if RPC's can modify state, the order of invocation matters (dependencies must be introduced between the callers)
// *** what if there are multiple calls from the same caller?
//   - this would only be useful if RPCs can modify state, or else subsequent calls will yield the same result
// *** should RPC's be allowed to modify state?
//   - not sure, but if we disallow it, how can we enforce it? Compile error?
// RPC: pull, other than reactive, which is push






// class TransferValue<T> implements UnorderedReaction {
    
//     react(from:Readable<T>, to:Writable<T>) {
//         to.set(from.get());
//     }

// }

// class ActivationRecord<R extends Reaction,A> {
//     reaction:R;
//     args:A;
//     constructor(reaction:R, args:A) {
//         this.reaction = reaction;
//         this.args = args;
//     }
// }