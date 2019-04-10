// @flow

//---------------------------------------------------------------------//
// Interfaces                                                          //
//---------------------------------------------------------------------//

// FIXME: what time unit do we choose?


export type LogicalTime = [number, number]; // unfortunately, process.hrtime()
// also returns an array with second + nanoseconds
// https://www.npmjs.com/package/hirestime but on NodeJS we can assume process.hrtime() works

export type PhysicalTime = number;

//---------------------------------------------------------------------//
// Interfaces                                                          //
//---------------------------------------------------------------------//

/**
 * A generic container for components.
 */
export interface Container<T: Component> {

    /**
     * Add a list of elements to this container. Duplicate entries will
     * not be kept.
     * @param {T} element
     */
    _add(...elements: Array<T>): void;

    /**
     * Return whether or not the argument is present in the container.
     * @param {T} element
     */
    _contains(element: T): boolean;

    /**
     * Remove an element from this container.
     * @param {string} name
     */
    _remove(element: T): void;

    //_move(element: T, destination: Container<T: Component>)

}

/**
 * To be implemented by a top-level composite.
 */
export interface Executable {
    start():void;
    stop():void;
}

/**
 * May be used to trigger a reaction.
 */
export interface Trigger<T> {

}

/**
 * For objects that have a name.
 */
export interface Named { // FIXME: have all implementors use toString as an alias of FQN
    /* Return the fully qualified name of this object. */
    _getFullyQualifiedName(): string;

    /* Get the name of this object. */
    _getName(): string;
}

/**
 * For (re)nameable objects
 */
export interface Nameable extends Named {
 
    /* Set the name of this object. */
    _setName(name: string):void;
}

/**
 * For reactive components we refer to as reactors.
 */
export interface ReActor {
    +_init:() => void;
    +_wrapup: () => void;    
    _reactions:$ReadOnlyArray<[Array<Trigger<*>>, Reaction<any, any>]>;
}   


export class Action<T> implements Trigger<T> {
    value: ?T;
    _parent: Component; // FIXME: move this to constructor scope.
    constructor(parent:Component, delay?:number) { // FIXME: we may need to create a (parameterized) type for time related stuff
        // Back to the delay question. Let's assume an action is parameterized with a delay. How can we enable a variable delay?
        // Edward cares about this. We should be able to support it.

        // if no delay is given, schedule may be called with a delay.
        //   - if it is called without a delay, the delay is said to be indeterminate
        // if a delay is given and schedule is called with a delay, it will be ignored. (a warning might be useful)
        // - the delay will always be the same
        this._parent = parent;
    }

    /**
     * NOTE: Since each composite has its own clock domain, we cannot 
     * depend on a global function like setTimeout or setInterval.
     */
    schedule(repeat?:boolean, delay?:number):number {
        if (this._parent != null) {
            //this._parent.trigger(trigger, delay, repeat);    
        } else {
            throw "Unable to schedule trigger; no parent."
        }
        return 0;   
    }

    unschedule() {

    }
}

/**
 * Each component has a name. It will typically also acquire a 
 * parent, unless it is a top-level composite. The parent property
 * is set/unset once a component is added to or removed from a 
 * container. Adding a component to a container will also ensure 
 * that it is uniquely indexed within that container.
 */
export class Component implements Nameable {
    
    _setName: (string) => void;

    _acquire: (parent: Composite) => boolean;

    _release: (parent: Composite) => boolean;

    _getContainer: () => ?Composite;

    _getName: () => string;

    _hasGrandparent: (container:Composite) => boolean;

    _hasParent: (component: Component) => boolean;

    /**
     * Return a string that identifies this component.
     */
    _getFullyQualifiedName: () => string;

    /**
     * Create a new component; use the constructor name
     * if no name is given.
     * @param {string=} name - Given name
     */
    constructor(parent:?Composite, name?:string) {
        var myName:string = this.constructor.name; // default
        var myIndex:?number = null;
        
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
                    myIndex = parent._getFreshIndex(name);
                    myName = name;
                }
            }
        });

        Object.assign(this, {
            _hasGrandparent(container:Composite): boolean {
                if (parent != null) {
                    return parent._hasParent(container);
                } else {
                    return false;
                }
            }
        });

        Object.assign(this, {
            _hasParent(container:Component): boolean {
                if (parent != null && parent == container) {
                    return true;
                } else {
                    return false;
                }
            }
        });

        Object.assign(this, {
            _getContainer(): ?Composite {
                return parent;
            }
        });

        Object.assign(this, {
            _acquire(newParent: Composite): boolean {
                if (parent == null) {
                    parent = newParent;
                    return true;
                } else {
                    return false;
                }
            }
        });
        
        Object.assign(this, {
            _release(oldParent: Composite): boolean {
                if (parent == oldParent) {
                    parent = null;
                    myIndex = null
                    return true;
                } else {
                    return false;
                }
            }
        });

        // Add it to a container if one is specified.
        // Note: the call to _add will invoke this._acquire,
        // so this code must be executed _after_ assigning
        // the _acquire function in the constructor.
        if (parent != null) {
            parent._add(this);
        }
    }

    _getInputs(): Set<InPort<mixed>> {
        var inputs = new Set();
        for (const [key, value] of Object.entries(this)) {
            if (value instanceof InPort) {
                inputs.add(value);
            }
        }
        return inputs;
    }

    _getOutputs(): Set<OutPort<mixed>> {
        var outputs = new Set();
        for (const [key, value] of Object.entries(this)) {
            if (value instanceof OutPort) {
                outputs.add(value);
            }
        }
        return outputs;
    }
    
}

//See: http://exploringjs.com/es6/ch_classes.html#sec_private-data-for-classes
export class PortBase implements Named {
    
    /***** Priviledged functions *****/

    /* Return a globally unique identifier. */
    _getFullyQualifiedName: () => string;
    _getName: () => string;


    hasGrandparent: (container:Composite) => boolean;
    hasParent: (component: Component) => boolean;
    
    /* Construct a new port base. */
    constructor(parent: Component) {
        Object.assign(this, {
            _getFullyQualifiedName(): string {
                return parent._getFullyQualifiedName() 
                    + "/" + this._getName();
            }

        });

        Object.assign(this, {
            hasParent(component: Component): boolean {
                if (component == parent) {
                    return true;
                } else {
                    return false;
                }
            }
        });
        
        Object.assign(this, {
            hasGrandparent(container:Composite):boolean {
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

export interface Connectable<T> {
    +connect: (sink: T) => void;
    +canConnect: (sink: T) => boolean;
}

/**
 * An interface for ports. Each port is associated with a parent component.
 * Ports may be connected to downstream ports using connect(). 
 * Connections between ports can be destroyed using disconnect().
 * Messages can be sent via a port using send(). Message delivery is immediate
 * unless a delay is specified.
 */
export interface Port<T> extends Connectable<Port<$Supertype<T>>>, Named {

    hasGrandparent: (container:Composite) => boolean;

    hasParent: (component: Component) => boolean;
    
    connect: (sink: Port<$Supertype<T>>) => void;

    canConnect(sink: Port<$Supertype<T>>): boolean;

}

class CallerPort<A,R> implements Connectable<CalleePort<$Supertype<A>,$Subtype<R>>> {

    constructor() {

    }

    call() {

    }

    connect(sink: CalleePort<$Supertype<A>,$Subtype<R>>):void {
        return;
    }

    canConnect(sink: CalleePort<$Supertype<A>,$Subtype<R>>):boolean {
        return true;
    }

    invokeRPC: (arguments: A, delay?:number) => R;

}

class CalleePort<A,R> {

}


export class OutPort<T> extends PortBase implements Port<T> {

    /***** Priviledged functions *****/

    canConnect: (sink: Port<$Supertype<T>>) => boolean
    connect: (sink: Port<$Supertype<T>>) => void;
    disconnect: (direction?:"upstream"|"downstream"|"both") => void;
    set: (value: ?$Subtype<T>, delay?:number) => void;
    get: (delay?:number) => ?$Subtype<T>;

    constructor(parent: Component) {
        super(parent);
        var myValue = null;
        var events: Map<number, T> = new Map();

        Object.assign(this, {
            set(value: ?$Subtype<T>, delay?:number): void {
                myValue = value; 
                // 
                // maintain a map in the composite that maps outputs to values at certain times
                // upon reaching a time, propagate all outputs to the respective receivers
                // FIXME: why not have get() pull values from upstream? They must have been generated.
            }
        });


        Object.assign(this, {
            get(delay?:number): ?$Subtype<T> {
                return myValue;
                // 
                // maintain a map in the composite that maps outputs to values at certain times
                // upon reaching a time, propagate all outputs to the respective receivers
                // FIXME: why not have get() pull values from upstream? They must have been generated.
            }
        });
        

        Object.assign(this, {
            canConnect(sink: Port<$Supertype<T>>): boolean { // solution: add Container here. Do tests prior to calling to verify it is the same
                var thisComponent = parent;
                var thisContainer = parent._getContainer();

                if (sink instanceof InPort
                    && thisContainer != null
                    && sink.hasGrandparent(thisContainer) //
                    && !sink.hasParent(thisComponent)) {
                    // OUT to IN
                    // - Component must be in the same container.
                    // - Self-loops are not permitted.
                    return true;
                } else if (sink instanceof OutPort 
                    && thisContainer instanceof Composite 
                    && sink.hasParent(thisContainer)) {
                    // OUT to OUT
                    // - Sink must be output port of composite that source component is contained by.
                    return true;
                }
                else {
                    return false;
                }
            }
        });
        
        Object.assign(this, {
            connect(sink: Port<$Supertype<T>>):void {
                var container = parent._getContainer();
                if (container != null) {
                    container.connect(this, sink);
                } else {
                    throw "Unable to connect: add the port's component to a container first.";
                }
            }
        });

        Object.assign(this, {
            disconnect(direction?:"upstream"|"downstream"|"both"="both"): void {
                var component = parent;
                var container = component._getContainer();

                if (direction == "upstream" || direction == "both") {
                    if (component instanceof Composite) {    
                        // OUT to OUT
                        component._disconnectContainedReceivers(this);
                    }
                }

                if (direction == "downstream" || direction == "both") {
                    // OUT to IN
                    // OUT to OUT
                    if (container != null) {
                        container._disconnectContainedSource(this);     
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

}



export class InPort<T> extends PortBase implements Port<T>, Trigger<T> {

    /***** Priviledged functions *****/
    canConnect:(sink: Port<$Supertype<T>>) => boolean;        
    connect: (sink: Port<$Supertype<T>>) => void;
    disconnect: (direction?:"upstream"|"downstream"|"both") => void;
    //send: (value: ?$Subtype<T>, delay?:number) => void;
    // NOTE: sending to input ports no longer makes sense if we have triggers that carry values
    get: () => ?$Subtype<T>;

    _value: ?T;
    _receivers: Set<Port<$Supertype<T>>>;
    //_parent: Component; // $ReadOnly ?
    _persist: boolean;

    constructor(parent: Component, persist:boolean=false) { // should all things that are not triggers be persistent?
        super(parent);
        var value:?$Subtype<T> = null;

        Object.assign(this, {
            get():?$Subtype<T> {
                return this._value;
            }
        });

        // Object.assign(this, {
        //     send(value: ?$Subtype<T>, delay?:number):void {
        //         if (delay == null || delay == 0) {
        //             value = value;
        //         }
        //     }
        // });

        Object.assign(this, {
            canConnect(sink: Port<$Supertype<T>>): boolean {
                var thisComponent = parent;
                var thisContainer = parent._getContainer();
                
                // IN to IN
                // - Source must be input port of composite that sink component is contained by.
                if (thisComponent instanceof Composite 
                    && sink instanceof InPort 
                    && sink.hasGrandparent(thisComponent)) {
                    return true;
                } else {
                    return false;
                }
            }
        });

        Object.assign(this, {
            connect(sink: Port<$Supertype<T>>):void {
                var container = parent._getContainer()
                if (container != null) {
                    container.connect(this, sink);
                }
            }
        });

        Object.assign(this, {
            disconnect(direction?:"upstream"|"downstream"|"both"="both"): void {
                var component = parent;
                var container = component._getContainer();

                if (direction == "upstream" || direction == "both") {
                    if (container != null) {
                        // OUT to IN
                        // IN to IN
                        container._disconnectContainedReceivers(this);
                    }    
                }

                if (direction == "downstream" || direction == "both") {
                    if (component instanceof Composite) {
                        // IN to IN
                        component._disconnectContainedSource(this);
                    }
                    if (container != null) {
                        // IN to OUT
                        container._disconnectContainedSource(this);
                    }
                }
            }
        });
    }

}

export class PureEvent {

}

// NOTE: composite IDLE or REACTING.
// If IDLE, get real time, of REACTING use T+1

export class Composite extends Component implements Container<Component>, ReActor {

    _getFreshIndex: (string) => number;
    _disconnectContainedReceivers: (port: Port<*>) => void;
    _disconnectContainedSource: (port: Port<*>) => void;
    _getGraph: () => string;

    connect: <T>(source: Port<T>, sink:Port<$Supertype<T>>) => void;
    //disconnect: (port: Port<*>, direction?:"upstream"|"downstream"|"both") => void;
    
    _init:() => void;
    _wrapup: () => void;
    _react:() => void;  
    _reactions:$ReadOnlyArray<[Array<Trigger<*>>, Reaction<any, any>]>;

    constructor(parent:?Composite, name?:string) {
        super(parent, name);

        /* Private variables */
        var relations: Map<Port<any>, Set<Port<any>>> = new Map();
        
        //var eventQ: Map<Time, Map<*>, *> = new Map();



        // queue for delayed triggers
        var triggerQ: Map<number, [Map<Action<any>, any>]> = new Map();

        // queue for delayed sends
        var sendQ: Map<number, [Map<Port<any>, any>]> = new Map();

        var indices: Map<string, number> = new Map();

        var actors: Set<ReActor> = new Set();

        // we need to express dependencies between reactions, not between ports
        var dependencies: Map<Reaction<mixed>, Reaction<mixed>> = new Map();

        Object.assign(this, {
            _init() {
                for (let a of actors) {
                    for (let r of a._reactions) {

                    }
                }
            }
        });
        // We don't want to run ahead of realtime, because actors can produce spontaneous events that need to be stamped with 
        // wallclock time, and we don't want these timestamps to be "in the past".
        // DAC Properties A1-9.
        // Simple examples. Which should those be?
        // First one to start with: sensor computation actuator
        // Introduce notion of a deadline
        // Why on the local platform, model should not get ahead.
        // Example 1: Synchronization to real time and deadlines
        // Example 2: Why delay has to wait
        // Example 3: shut off the lights some time after the switch has been flipped.
        // Reason to have the deadline definition as stated: detectability. Suppose the start deadline cannot be met; the
        // reaction should not be carried out (and then the violation be reported on).
        

        Object.assign(this, {
            // FIXME: We may want to wrap this into something like a change request and 
            // let the composite handle it at the next microstep.
            connect<T>(source: Port<T>, sink: Port<$Supertype<T>>):void {
                // bind T to constrain the type, check connection.
                if (source.canConnect(sink)) {
                    var sinks = relations.get(source); 
                    if (sinks == null) {
                        sinks = new Set();
                    }
                    sinks.add(sink);
                    relations.set(source, sinks);
                } else {
                    throw "Unable to connect."; // FIXME: elaborate error reporting.
                    //throw "Cannot connect " + source.getFullyQualifiedName() + " to " + sink.getFullyQualifiedName() + ".";
                }
            // FIXME: check the graph for cycles, etc.
            
            }
        });
        // FIXME: persistent <=> default
        // Comments from Stoyke. 1) What if you want non-determinism? Parameter store. Stores the parameters that you are learning.
        // Fairly common strategy. Parallel processes. All updating the parm store asynchronously.
        // 2) How to handle dynamic instantiation?

        Object.assign(this, {
            _getFreshIndex(name: string): number {
                var index = 0;
                if (indices.has(name)) {
                    index = indices.get(name)+1;
                    indices.set(name, index);
                } else {
                    indices.set(name, index);
                }
                return index;
            }
        });

        Object.assign(this, {
            _react() {
                for (var prop in this) {
                    if (prop instanceof InPort) {
                        console.log("port: " + prop.toString());
                    }

                    if (prop instanceof OutPort) {
                        console.log("output: " + prop.toString());
                    }
                    // Skip properties that are not ports.
                }
            }
        });

        Object.assign(this, {
            _disconnectContainedReceivers(port: Port<*>): void {
                for (var receivers of relations.values()) {
                        receivers.delete(port);
                }
            }

        });

        Object.assign(this, {
            _disconnectContainedSource(port: Port<*>): void {
                relations.delete(port);
            }
        });
    
        Object.assign(this, {
            _add(...components: Array<Component>): void {
                for (var c of components) {
                    c._acquire(this);
                    c._setName(c._getName()); // to ensure proper indexing
                    
                    // FIXME: is actor, not component actors.add(c);
                }
            }
        });

        Object.assign(this, {
            _getGraph(): string {
                var str = "";
                relations.forEach(function(val, key, map) {
                    str += `${key._getFullyQualifiedName()} => ` + "[";
                    for (var p of val) {
                        str += p._getFullyQualifiedName() + ", ";
                    }
                    str = str.substring(0, str.length-2);
                    str += "]"
                });
                return str;
            }
        });
    }


    /**
     * Add a list of elements to this container.
     * @param {T} element
     */
    _add: (...components: Array<Component>) => void;
        

    /**
     * Return whether or not the argument is present in the container.
     * @param {T} element
     */
    _contains(element: Component): boolean { // FIXME!
        return true; //this._components.includes(element);
    }

    /**
     * Remove an element from this container.
     * @param {string} name
     */
    _remove(element: Component): void {
        // check whether it is connected to anything
        // remove all connections
    }

}


/**
 * A parameter is an input port that has a default value. 
 * If no current value is present, get() returns the default value.
 * Unlike regular input ports, parameters are persisent by default,
 * which means that their current value only changes when an new
 * input becomes known _and present_ (i.e., the current value remains
 * unchanged until the next message arrives). 
 */
export class Parameter<T> extends InPort<T> {

    default:T;
    
    get: () => ?$Subtype<T>;
    read: () => $Subtype<T>;

    constructor(parent: Component, defaultValue:T, persist:boolean=true) {
        super(parent, persist);
        this._value = defaultValue; // FIXME: probably put this in the constructor scope
        // Object.assign(this, {
        //     send(value: ?$Subtype<T>, delay?:number): void {
        //         if (value == null) {
        //             this.reset();
        //         } else {
        //             this._default = value; // FIXME: default vs current value
        //         }
        //     }
        // });

        Object.assign(this, {
            read(): $Subtype<T> {
                let val = this.get();
                if (val != null) {
                    return val; 
                } else {
                    return this.default;
                }
            }
        });
    }

    reset() {
        this._value = this.default;
    }

}



/**
 * Base class for reactions that has two type parameter: 
 * T, which describes a tuple of inputs/outputs/actions it may use;
 * S, which describes an object that keeps shared state.
 * The reaction can also maintain state locally.
 */
export class Reaction<T,S:?Object> { // FIXME: where to put the delay?

    io:T
    shared:S;
    
    portsInScope: () => [Set<InPort<mixed>>, Set<OutPort<mixed>>];

    +react: (time?:number) => void;

    constructor(io:T, state:S) {
        this.io = io;
        this.shared = state;

        /**
         * Given some datastructure, recursively find all references
         * to any input and output ports.
         */
        function collect(inputs: Set<InPort<mixed>>, 
            outputs: Set<OutPort<mixed>>, visited: Set<Object>, data:any) {
            if (data instanceof InPort) {
                inputs.add(data);
            } 
            else if (data instanceof OutPort) {
                outputs.add(data);
            }
            else if (data != null && data === Object(data)) {
                visited.add(data);
                if (typeof data[Symbol.iterator] === 'function') {
                    // Iterate if iterable
                    for (let elem of data) {
                        if (!visited.has(elem))
                            collect(inputs, outputs, visited, elem);
                    }
                } else {
                    // Loop over object entries otherwise
                    for (const [key, value] of Object.entries(data)) {
                        if (!visited.has(value))
                            collect(inputs, outputs, visited, value);
                    }            
                }
            } else {
                console.log(data)
            }
        }

        Object.assign(this, {
            portsInScope(): [Set<InPort<mixed>>, Set<OutPort<mixed>>] {
                var inputs = new Set<InPort<mixed>>();
                var outputs = new Set<OutPort<mixed>>();
                collect(inputs, outputs, new Set<Object>(), this);
                return [inputs, outputs];
            }
        });
    }
}

class OrderedAsyncReaction<T, S, R:Action<*>> extends Reaction<T, S> { // May not need this; we can lump actions together with triggers
    trigger = 0;
    constructor(io:T, state:S, trigger:R) {
        super(io, state);
        this.trigger = trigger;
    }

}

// Eventually, this should become a worker/threaded composite
// Also, check out https://github.com/laverdet/isolated-vm

export class App extends Composite implements Executable {
    
    // FIXME: add some logging facility here

    constructor(name: string) {
        super(null, name);
    }

    start():void {

    }

    stop():void {

    }
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