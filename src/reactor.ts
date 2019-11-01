/**
 * Core of the reactor runtime.
 * 
 * @author Marten Lohstroh (marten@berkeley.edu),
 * @author Matt Weber (matt.weber@berkeley.edu)
 */

import {PrecedenceGraph, PrecedenceGraphNode, PrioritySetNode, PrioritySet} from '../src/util';
import * as globals from './globals'

//---------------------------------------------------------------------//
// Modules                                                             //
//---------------------------------------------------------------------//

//Must first declare require function so compiler doesn't complain
declare function require(name:string);

const microtime = require("microtime");

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
 * @param t0 
 * @param t1 
 */
export function compareTimeInstants(t0: TimeInstant, t1: TimeInstant): boolean{
    //FIXME: these checks are unecessary because I removed 0 from the type.
    //Why have a second special representation for epoch?
    //Delete, when I feel confident it's not coming back.
    // if(t0 === 0){
    //     return true;
    // }
    // if(t1 === 0){
    //     return false;
    // }



    //Don't check if TimeInstants have fractional microsteps to save time.

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

    //FIXME: Remove this comment.
    //The associativity of these operations is very important because otherwise
    //there will be floating point errors.
    // seconds = Math.floor( (t[0] * t[1]) / billion);
    // nseconds = (t[0] * t[1]) - (seconds * billion);

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
 * A Trigger is something which can cause an Event: a Timer, an input, or an action.
 * Reactions may register themselves as triggered by a Trigger. 
 */

export interface Trigger{}


export interface Writable<T> {
    set: (value: T | null) => void;
}

export interface Readable<T> {
    get: () => T | null;
}

/**
 * To be implemented by a top-level composite.  // FIXME: not sure that we need this
 */
export interface Executable {
    start():void;
    stop():void;
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

    constructor(state: Reactor, triggers: Array<Trigger>, priority: number){
        this.triggers = triggers;
        this.state = state;
        this.priority = priority;

        //Register this reaction's triggers with the runtime.
        globals.triggerMap.registerReaction(this);
    }

    /**
     * This react function must be overridden by a concrete reaction.
     */
    react(){
        throw new Error("React function hasn't been defined");
    }
}


//A prioritized reaction wraps a Reaction with a priority and precedence
//and may be inserted into the reaction queue.
//The priority of a reaction depends on the priority of its reactor, which is
//determined by a topological sort of reactors.
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

    timeType: TimelineClass;
    minDelay: TimeInterval;
    name: string;

    //A payload is available to any reaction triggered by this action.
    //This timestamped payload can only be read as non
    _payload: TimestampedValue<T> | null;

    /**
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
    constructor(timeType: TimelineClass = TimelineClass.physical, minDelay: TimeInterval = 0){

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
            if(compareNumericTimeIntervals(globals.currentLogicalTime[0], wallTime )){
                timestamp = [globals.currentLogicalTime[0], globals.currentLogicalTime[1] + 1 ];
            } else {
                timestamp = [wallTime, 0 ];
            }
        } else {
            //logical
            if( timeIntervalIsZero(this.minDelay) && timeIntervalIsZero(delay)) {
                timestamp = [globals.currentLogicalTime[0], globals.currentLogicalTime[1] + 1 ];
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
                timestamp = [actionTime, globals.currentLogicalTime[1]];
            }
        }

        let actionEvent = new Event(this, timestamp, payload);
        let actionPriEvent = new PrioritizedEvent(actionEvent, globals.getEventID());
        globals.scheduleEvent(actionPriEvent);    
    }


    //FIXME Create isPresent function for actions? It would return true when the logical timestamps match.

    /**
     * Called on an action within a reaction to acquire the action's payload.
     * The payload for an action is set by a scheduled action event, and is only
     * present for reactions executing at that logical time. When logical time
     * advances, that previously available payload is now unavailable.
     */
    get(): T | null{
        if(this._payload && timeInstantsAreEqual(this._payload[0], globals.currentLogicalTime)){
            return this._payload[1]
        } else {
            return null;
        }
    }
}


export class Timer{
    
    //For reference, the type of a TimeInterval is defined as:
    //TimeInterval = null | [number, TimeUnit] | 0;
    period: TimeInterval;
    offset: TimeInterval;
    
    //Timers always have top priority.
    priority = 0;

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
            this._offsetFromStartingTime =  numericTimeSum( numericOffset, globals.startingWallTime );
            let timerInitInstant: TimeInstant = [this._offsetFromStartingTime, 0];
            let timerInitEvent: Event = new Event(this, timerInitInstant, null);
            let timerInitPriEvent: PrioritizedEvent = new PrioritizedEvent(timerInitEvent, globals.getEventID());
            globals.scheduleEvent(timerInitPriEvent);

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
                let nextTimerPriEvent: PrioritizedEvent = new PrioritizedEvent(nextTimerEvent, globals.getEventID());
                globals.scheduleEvent(nextTimerPriEvent);

                console.log("Scheduling next event for timer with period " + this.period + " for time: " + nextTimerInstant);
            }

        } else {
            throw new Error("Cannot reschedule a timer with a null or negative period.");
        }
    };

    constructor(period:TimeInterval, offset:TimeInterval) {
        this.period = period;
        this.offset = offset;

        //Register this timer so it can be started when the runtime begins.
        globals.timers.push(this);
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
    _timers:Set<Timer> = new Set<Timer>();
    // _inputs:Map<string, InPort<any>> = new Map< string,InPort<any>>();
    // _outputs:Map<string, OutPort<any>> = new Map< string ,OutPort<any>>();
    // _actions:Map<string, Action<any>> = new Map<string, Action<any>>();

    parent:Reactor|null = null;
    //FIXME: Create getters and setters for children.
    children:Set<Reactor|null> = new Set<Reactor|null>();

    /**
     * Returns the set of timers directly owned by this reactor combined with 
     * the recursive set of all timers of contained reactors.
     */
    getTimers(): Set<Timer> {
        var timers = new Set<Timer>();

        //Timers part of this reactor
        for (const [key, value] of Object.entries(this)) {
            if (value instanceof Timer) {
                timers.add(value);
            }
        }

        //Recursively call this function on child reactors
        //and add their timers to the timers set.
        var subTimers: Set<Timer>;
        if(this.children){
            for(const child of this.children){
                if(child){
                    subTimers = child.getTimers();
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

    //connect: <T>(source: Port<T>, sink:Port<T>) => void;
    // FIXME: connections mus be done sink to source so that we leverage contravariance of functions!!!
    /**
     * Create a new component; use the constructor name
     * if no name is given.
     * @param {string=} name - Given name
     */
    constructor(parent:Reactor | null, name?:string) {
        
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
                    path = parent._getFullyQualifiedName();
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
                if (parent != null && (name != myName || myIndex == null)) {
                    //myIndex = parent._getFreshIndex(name); //FIXME: look at former composite
                    myName = name;
                }
            }
        });

        Object.assign(this, {
            _hasGrandparent(container:Reactor): boolean {
                if (parent != null) {
                    return parent._hasParent(container);
                } else {
                    return false;
                }
            }
        });

        Object.assign(this, {
            _hasParent(container:Reactor): boolean {
                if (parent != null && parent == container) {
                    return true;
                } else {
                    return false;
                }
            }
        });

        Object.assign(this, {
            _getContainer(): Reactor | null {
                return parent;
            }
        });

        Object.assign(this, {
            _acquire(newParent: Reactor): boolean {
                if (parent == null) {
                    parent = newParent;
                    return true;
                } else {
                    return false;
                }
            }
        });
        
        Object.assign(this, {
            _release(oldParent: Reactor): boolean {
                if (parent == oldParent) {
                    parent = null;
                    myIndex = null
                    return true;
                } else {
                    return false;
                }
            }
        });

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
        if (parent != null) {
            //parent._add(this); // FIXME: add container capability to Reactor
        }
    }

    //FIXME: The implementation of _getInputs and _getOutputs below may in fact
    //be a better design, but they are incompatible with the current implementation
 
    _getInputs(): Set<InPort<any>> {
        var inputs = new Set<InPort<any>>();
        for (const [key, value] of Object.entries(this)) {
            if (value instanceof InPort) {
                inputs.add(value);
            }
        }
        return inputs;
    }

    _getOutputs(): Set<OutPort<any>> {
        var outputs = new Set<OutPort<any>>();
        for (const [key, value] of Object.entries(this)) {
            if (value instanceof OutPort) {
                outputs.add(value);
            }
        }
        return outputs;
    }

    _getActions(): Set<Action<any>> {
        var actions = new Set<Action<any>>();
        for (const [key, value] of Object.entries(this)) {
            if (value instanceof Action) {
                actions.add(value);
            }
        }
        return actions;
    }
    
}


//     hasGrandparent: (container:Reactor) => boolean;
//     hasParent: (component: Reactor) => boolean;

//     connect: (source: Port<T>) => void;
//     canConnect(source: Port<T>): boolean;

//FIXME: Perhaps PortBase and the Port interface can be combined?
export abstract class Port<T> implements Named {
    
    /***** Priviledged functions *****/

    /* Return a globally unique identifier. */
    _getFullyQualifiedName: () => string;
    _getName: () => string;

    hasGrandparent: (container:Reactor) => boolean;
    hasParent: (component: Reactor) => boolean;

    connect: (source: Port<T>) => void;
    canConnect: (source: Port<T>)=> boolean;
    
    /* Construct a new port base. */
    constructor(parent: Reactor) {
        Object.assign(this, {
            _getFullyQualifiedName(): string {
                return parent._getFullyQualifiedName() 
                    + "/" + this._getName();
            }

        });

        Object.assign(this, {
            hasParent(component: Reactor): boolean {
                if (component == parent) {
                    return true;
                } else {
                    return false;
                }
            }
        });
        
        Object.assign(this, {
            hasGrandparent(container:Reactor):boolean {
                if (container == parent._getContainer()) {
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
    }

    toString(): string {
        return this._getFullyQualifiedName();
    }
}


export class OutPort<T> extends Port<T> implements Port<T>, Writable<T> {

    value: TimestampedValue<T> | null = null;
    _connectedPorts: Set<Port<T>> = new Set<Port<T>>();

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
        //var events: Map<number, T> = new Map();

        Object.assign(this, {
            set(value: T ): void {
                this.value = [ globals.currentLogicalTime, value]; 
            }
        });

        //FIXME: Delete? You should get() from an input port. 
        // Object.assign(this, {
        //     get(): T | null {
        //         return myValue;
        //     }
        // });
        

        //FIXME: Is this necessary?
        //In what circumstances would an outport not be able to connect to an inport?
        Object.assign(this, {
            canConnect(source: Port<T>): boolean { // solution: add Container here. Do tests prior to calling to verify it is the same
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
                return true;
            }
        });
        
        Object.assign(this, {

             /**
             * Connect this OutPort to an InPort. One OutPort may be connected to many InPorts.
             * @param destination The InPort to which this OutPort should be connected.
             */
            connect(destination: InPort<T>):void {
                console.log("connecting " + this + " and " + destination);
                // this.connectedPort = destination;
                this._connectedPorts.add(destination);
                destination.connectedPort = this;
                
                // var container = parent._getContainer();
                // if (container != null) {
                //     container.connect(this, sink);
                // } else {
                //     throw "Unable to connect: add the port's component to a container first.";
                // }
            }
        });

        Object.assign(this, {
            disconnect(destination: InPort<T>): void {
                // this.connectedPort = null;
                this._connectedPorts.delete(destination);
                destination.connectedPort = null;
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

        Object.assign(this, {
            /**
             * Assigns a value to this output port at the current logical time.
             * Input events are triggered for all connected input ports and 
             * this function is recursively invoked on all connected output ports.
             * @param value The value to assign to this output port.
             */
            set(value: T):void {
                this.value = [globals.currentLogicalTime, value];
                for(const port of this._connectedPorts){
                    if(port instanceof InPort){
                        let inputEvent = new Event(port, globals.currentLogicalTime, null);
                        let prioritizedEvent = new PrioritizedEvent(inputEvent, globals.getEventID());
                        globals.eventQ.push(prioritizedEvent);
                    } else if(port instanceof OutPort){
                        port.set(value);
                    }

                }
            }
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

export class InPort<T> extends Port<T> implements Trigger, Readable<T> {

    /**
     * If an InPort has a null value for its connectedPort it is disconnected.
     * A non-null connectedPort is connected to the specified OutPort.
     */
    connectedPort: OutPort<T> | null = null;
    value: T | null;
    // _name: string = "";
    //_receivers: Set<Port<T>>;
    //_parent: Component; // $ReadOnly ?
    //_persist: boolean;

    /***** Priviledged functions *****/
    canConnect:(source: OutPort<T>) => boolean;        
    connect: (source: OutPort<T>) => void;
    disconnect: (source: OutPort<T>) => void;
    //send: (value: ?$Subtype<T>, delay?:number) => void;
    get: () => T | null;
    writeValue: (container: Reactor, value: T | null) => void;

    /**
     * Create a new InPort.
     * @param parent The reactor containing this InPort
     */
    constructor(parent:Reactor) {
        super(parent);
        
        Object.assign(this, {
            
            /**
             * Obtains a value from the connected output port. Throws an error if not connected.
             * Will return null if the connected output did not have its value set at the current
             * logical time.
             */
            isPresent():boolean {
                if(this.connectedPort){
                    if(this.connectedPort.value === null ||
                         ! timeInstantsAreEqual(this.connectedPort.value[0], globals.currentLogicalTime )){
                             return false;
                         } else {
                             return true;
                         }
                } else {
                    throw new Error("Cannot test a disconnected input port for a present value.")
                }
            }
        });

        Object.assign(this, {

            /**
             * Obtains a value from the connected output port. Throws an error if not connected.
             * Will return null if the connected output did not have its value set at the current
             * logical time.
             */
            get():T | null {
                if(this.connectedPort){
                    if(this.isPresent()){
                        return this.connectedPort.value[1];
                    } else {
                        return null;
                    }
                } else {
                    throw new Error("Cannot get value from a disconnected port.")
                }
            }
        });

        //FIXME: Commented this out, because I think it should be calling set()
        //on an OutPort which triggers an event for connected inputs.
        //You don't call write() on an input, right? You get() from an input.
        // Object.assign(this, {
        //     writeValue(container:Reactor, value:T | null):void {
        //         this._value = value;
        //         for (let r of parent._reactions) {
        //             if (r.triggers.includes(this)) {

        //                 //Create a PrioritySetNode for this reaction and push the node to the reaction queue
        //                 let prioritizedReaction = new PrioritizedReaction(r, globals.getReactionID());
        //                 globals.reactionQ.push(prioritizedReaction);
        //                 //globals.reactionQ.push([r.reaction, r.triggers]);
        //             }
        //         }
        //     }
        // });

        //FIXME: always returns true.
        Object.assign(this, {
            canConnect(source: OutPort<T>): boolean {
            //     var thisComponent = parent;
            //     var thisContainer = parent._getContainer();
                
            //     // IN to IN
            //     // - Source must be input port of composite that sink component is contained by.
            //     if (thisComponent instanceof Reactor 
            //         && sink instanceof InPort 
            //         && sink.hasGrandparent(thisComponent)) {
            //         return true;
            //     } else {
            //         return false;
            //     }
                return true;
            }
        });

        Object.assign(this, {
            connect(source: OutPort<T>):void {
                source.connect(this);
                // console.log("connecting " + this + " and " + source);
                // this.connectedPort = source;
                // source._connectedPorts.add(this);
            }
        });

        Object.assign(this, {
            disconnect(source: OutPort<T>): void {
                this.connectedPort = null;
                source._connectedPorts.delete(this);
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

//FIXME: Move runtime from globals into here.
export class App extends Reactor implements Executable {
    
    // FIXME: add some logging facility here
    name: string;

    constructor(name: string) {
        super(null, name);
    }


    start():void {

    }

    stop():void {

    }

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