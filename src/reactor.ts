/*
 FIXME: License, copyright, authors.
 */

//import {PriorityQueue} from './util';

import {PrecedenceGraph, PrecedenceGraphNode, PrioritySetNode, PrioritySet} from '../src/util';
import * as globals from './globals'

//---------------------------------------------------------------------//
// Types                                                               //
//---------------------------------------------------------------------//

/** Units ranging from femtoseconds to years. */
export type TimeUnit = "fs" | "ps" | "ns" | "us" | "ms" | "sec" | 
              "min" | "hour" | "day" | "week" | "month" | "year";
// FIXME: align this with LF compiler, maybe use an enum instead


/** 
 * A time interval must be accompanied by a time unit. Decimals are ignored.
 */
export type TimeInterval = null | [number, TimeUnit] | 0;

export type TimeInstant = [number, number] | 0;

//---------------------------------------------------------------------//
// Runtime Functions                                                   //
//---------------------------------------------------------------------//
export function _schedule<T>(action:Action<T>, 
        additionalDelay:TimeInterval, value:T | null): TimeInstant {
    return [0,0]
}

//---------------------------------------------------------------------//
// Interfaces                                                          //
//---------------------------------------------------------------------//

export interface Trigger {
    //FIXME: A trigger is a timer, an input, or an action.
}

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

//An interface for classes implementing a react function.
//Both reactions and timers react to events on the event queue
export interface Reactable {
    react:(...args) => void;
    triggers: Array<Trigger>;
}

// A Reaction is a reactable with state.
// The arguments of a reaction's react function can be of *any* type.
// Extra type annotations must be used to ensure that inputs,
// outputs, and actions map correctly to reaction arguments.
export abstract class Reaction implements Reactable{

    state: Object;
    triggers: Array<Trigger>;
    react:(...args) => void;

    constructor(state: Object, triggers: Array<Trigger>, ){
        this.triggers = triggers;
        this.state = state;
    }
}


//A prioritized reaction wraps a Reactable with a priority and precedence
//and may be inserted into the reaction queue.
//The priority of a reaction depends on the priority of its reactor, which is
//determined by a topological sort of reactors.
export class PrioritizedReactable implements PrecedenceGraphNode,
 PrioritySetNode<number,number>{


    r: Reactable;

    //Reaction attributes
    // triggers: Array<Trigger>;
    // react:(...args) => void;
    // state: Object;

    //Precedence graph node attributes
    _id: number;
    _next: PrioritySetNode<number,number> | null;
    _priority: number;

    constructor(r: Reactable, id: number,
        next: PrioritySetNode<number,number>|null, priority: number) {
        this.r = r;
        this._id = id;
        this._next = next;
        this._priority = priority;
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



//FIXME: delete Reaction2 once we have verfified it's never used anywhere.
export interface Reaction2 {
    
    //new(...args):Reaction2;

    react:(...args) => void;
}

//end of Reaction2 code to delete.

export interface Schedulable<T> {
    schedule: (additionalDelay?:TimeInterval, value?:T) => TimeInstant;
    unschedule(handle: TimeInstant):void;
}

/**
 * An action denotes a self-scheduled event. If an action is instantiated
 * without a delay, then the time interval between the moment of scheduling
 * this action (cause), and a resulting reaction (effect) will be determined
 * upon the call to schedule. If a delay _is_ specified, it is considered
 * constant and cannot be overridden using the delay argument in a call to 
 * schedule().
 */
export class Action<T> implements Trigger {
    get: () => T | null;

    /**
     * Schedule this action. If additionalDelay is 0 or unspecified, the action 
     * will occur at the current logical time plus one micro step.
     */
    schedule: (additionalDelay?:TimeInterval, value?:T) => TimeInstant;

    constructor(parent:Reactor, delay?:TimeInterval) { 
        var _value;

        Object.assign({
            get(): T | null {
                return _value;
            }
            // FIXME: add writeValue
        });

        Object.assign(this, {
            schedule(additionalDelay:TimeInterval, value?:T): TimeInstant {
                
                if (delay == null || delay === 0) {
                    delay = additionalDelay;
                } else {
                    if (additionalDelay != null && additionalDelay !== 0) {
                        delay[0] += additionalDelay[0];
                    }
                }
                return _schedule(this, delay, value);
            }
        });
    }

    unschedule(handle: TimeInstant):void {
        // FIXME
    }
}


//Matt: I don't understand why this should be readable,
//so I'm removing the Readable interface for now
//implements Readable<TimeInstant>
export class Timer implements Reactable{
    
    //For reference, the type of a TimeInterval is defined as:
    //TimeInterval = null | [number, TimeUnit] | 0;
    period: TimeInterval;
    offset: TimeInterval;

    //A timer's only trigger is itself.
    triggers: Array<Trigger> = new Array();;

    //The setup function should be used to start the timer using the offset
    setup(){
        if(this.offset && this.offset[0] && this.offset[0] > 0 && this.offset[1]){
            //FIXME
            console.log("FIXME: react does not yet schedule timer with offset " 
            + this.offset[0] + " " + this.offset[1]);
        }
    }

    //The react function for a timer schedules the next timer event using the period
    //FIXME: How should a period of 0 be handled? For now it causes the timer to not be scheduled again.
    react() {
        if(this.period && this.period[0] && this.period[0] > 0 && this.period[1]){
            //FIXME
            console.log("FIXME: react does not yet schedule timer with period " +
            this.period[0] + " " + this.period[1]);
        }
    };

    constructor(period:TimeInterval, offset:TimeInterval) {
        this.period = period;
        this.offset = offset;
        
        //Register this timer as its own trigger.
        this.triggers.push(this);

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

//type Port<+T> = Port<T>;

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
    
    _reactions:Array<Reaction>;
    // _reactions:Array<{triggers: Array<Trigger>, reaction: Reaction, args:Array<any>}>;
    
    // _reactions:Array<
    //         [   // triggers, reaction, reaction arguments
    //             Array<Trigger<any>>, UnorderedReaction, any
    //         ]
    // >;

    //abstract _checkTypes();

    _timers:Set<Timer> = new Set<Timer>();

    //FIXME: assign in constructor?
    addTimer(timer: Timer){
        this._timers.add(timer);
    }
    //addTimer: (timer: Timer) => void;
    
    //FIXME: assign in constructor?
    //FIXME: don't return the timer set, return a copy
    getTimers(){
        return this._timers
    }
    //getTimers: () => Set<Timer>;


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
        
        var myName:string = this.constructor.name; // default
        var myIndex:number | null = null;
        var relations: Map<Port<any>, Set<Port<any>>> = new Map();

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
    
}

export class PortBase implements Named {
    
    /***** Priviledged functions *****/

    /* Return a globally unique identifier. */
    _getFullyQualifiedName: () => string;
    _getName: () => string;


    hasGrandparent: (container:Reactor) => boolean;
    hasParent: (component: Reactor) => boolean;
    
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

// export interface Connectable<T> {
//     +connect: (source: T) => void;
//     +canConnect: (source: T) => boolean;
// }

/**
 * An interface for ports. Each port is associated with a parent component.
 * Ports may be connected to downstream ports using connect(). 
 * Connections between ports can be destroyed using disconnect().
 * Messages can be sent via a port using send(). Message delivery is immediate
 * unless a delay is specified.
 */
export interface Port<T> extends  Named {

    hasGrandparent: (container:Reactor) => boolean;

    hasParent: (component: Reactor) => boolean;
    
    connect: (source: Port<T>) => void;

    canConnect(source: Port<T>): boolean;

}

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


export class OutPort<T> extends PortBase implements Port<T>, Writable<T> {

    /***** Priviledged functions *****/

    canConnect: (source: Port<T>) => boolean
    connect: (source: Port<T>) => void;
    disconnect: (direction?:"upstream"|"downstream"|"both") => void;
    set: (value: T | null) => void;
    get: () => T | null;

    constructor(parent: Reactor) {
        super(parent);
        var myValue: T | null = null;
        var events: Map<number, T> = new Map();

        Object.assign(this, {
            set(value: T | null): void {
                myValue = value; 
            }
        });

        Object.assign(this, {
            get(): T | null {
                return myValue;
            }
        });
        

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
            connect(source: Port<T>):void {
                // var container = parent._getContainer();
                // if (container != null) {
                //     container.connect(this, sink);
                // } else {
                //     throw "Unable to connect: add the port's component to a container first.";
                // }
            }
        });

        Object.assign(this, {
            disconnect(direction:"upstream"|"downstream"|"both"="both"): void {
                var component = parent;
                var container = component._getContainer();

                if (direction == "upstream" || direction == "both") {
                    if (component instanceof Reactor) {    
                        // OUT to OUT
                        //component._disconnectContainedReceivers(this); //FIXME: add a transfer reaction
                    }
                }

                if (direction == "downstream" || direction == "both") {
                    // OUT to IN
                    // OUT to OUT
                    if (container != null) {
                        //container._disconnectContainedSource(this);    //FIXME: add a transfer reaction
                    }
                }
            }
        });
    }

    // NOTE: Due to assymmetry (subtyping) we cannot allow connecting 
    // sinks to sources. It must always be source to sink. Disconnect 
    // does not have this problem.
    // connect(sink: Port<$Supertype<T>>): void {
        
    // }

    toString(): string {
        return this._getFullyQualifiedName();
    }

}

class ContainedInput<T> implements Writable<T> {
    
    set: (value: T | null) => void;

    constructor(reactor:Reactor, port:InPort<T>) {
        var valid = true;
        if (!port.hasParent(reactor)) {
            console.log("WARNING: port " + port._getFullyQualifiedName()
                + "is improperly used as a contained port; "
                + "set() will have no effect.");
            valid = false;
        }

        Object.assign(this, {
            set(value:T | null): void {
                if (valid) {
                    return port.writeValue(reactor, value);
                }
            }
        });
    }
}

class ContainedOutput<T> implements Readable<T> {
    get: () => T | null; // FIXME: remove readable from output!!
    
    constructor(reactor:Reactor, port:OutPort<T>) {
        var valid = true;
        if (!port.hasParent(reactor)) {
            console.log("WARNING: port " + port._getFullyQualifiedName()
                + "is improperly used as a contained port; "
                + "get() will always return null.");
            valid = false;
        }

        Object.assign(this, {
            get(): T | null {
                if (!valid) {
                    return null;
                } else {
                    return port.get();
                }
            }
        });
    }
}


export class InPort<T> extends PortBase implements Port<T>, Trigger, Readable<T> {

    /***** Priviledged functions *****/
    canConnect:(source: Port<T>) => boolean;        
    connect: (source: Port<T>) => void;
    disconnect: (direction?:"upstream"|"downstream"|"both") => void;
    //send: (value: ?$Subtype<T>, delay?:number) => void;
    // NOTE: sending to input ports no longer makes sense if we have triggers that carry values
    get: () => T | null;
    writeValue: (container: Reactor, value: T | null) => void;

    _value: T | null;
    _receivers: Set<Port<T>>;
    //_parent: Component; // $ReadOnly ?
    _persist: boolean;

    /**
     * InPorts that are constructed with an initial value will be persistent
     */
    constructor(parent:Reactor, initialValue?:T | null) {
        super(parent);
        if (initialValue)
            this._value = initialValue;

        Object.assign(this, {
            get():T | null {
                return this._value;
            }
        });

        Object.assign(this, {
            writeValue(container:Reactor, value:T | null):void {
                this._value = value;
                
                //FIXME: parent.getPriority needs to be set somewhere
                for (let r of parent._reactions) {
                    if (r.triggers.includes(this)) {

                        //Create a PrioritySetNode for this reaction and push the node to the reaction queue
                        let prioritizedReactable = new PrioritizedReactable(r ,
                             globals.getReactionID(), null, parent.getPriority());
                        globals.reactionQ.push(prioritizedReactable);
                        //globals.reactionQ.push([r.reaction, r.triggers]);
                    }
                }
            }
        });

        Object.assign(this, {
            canConnect(source: Port<T>): boolean {
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
            connect(source: Port<T>):void {
                // var container = parent._getContainer()
                // if (container != null) {
                //     container.connect(this, sink);
                // }
            }
        });

        Object.assign(this, {
            disconnect(direction:"upstream"|"downstream"|"both"="both"): void {
                var component = parent;
                var container = component._getContainer();

                if (direction == "upstream" || direction == "both") {
                    if (container != null) {
                        // OUT to IN
                        // IN to IN
                        //container._disconnectContainedReceivers(this); // FIXME: this should result in the removal of a transfer reactions
                    }    
                }

                if (direction == "downstream" || direction == "both") {
                    if (component instanceof Reactor) {
                        // IN to IN
                        //component._disconnectContainedSource(this);
                    }
                    if (container != null) {
                        // IN to OUT
                        //container._disconnectContainedSource(this);
                    }
                }
            }
        });
    }

    toString(): string {
        return this._getFullyQualifiedName();
    }

}


//An Event consists of a tag and and an action
export class PureEvent {

}

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

export class App extends Reactor implements Executable {
    
    // FIXME: add some logging facility here

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