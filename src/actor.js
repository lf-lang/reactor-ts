// @flow

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
    add(...elements: Array<T>): void;

    /**
     * Return whether or not the argument is present in the container.
     * @param {T} element
     */
    contains(element: T): boolean;

    /**
     * Remove an element from this container.
     * @param {string} name
     */
    remove(element: T): void;

}

export interface Executable {
    start():void;
    stop():void;
}

export interface Guard {
    // Potentially, we could state preconditions here
}

export interface Indexable {

    _index:?number;

}


/**
 * An interface for named objects.
 */
export interface Nameable {
    /* The name of this object. */
    //_name: string; should not be part of the inteface

    /* Return a globally unique identifier. */
    getFullyQualifiedName(): string;
}

/**
 * An interface for reactive components.
 */
export interface Actor { // FIXME: still tempted to call this Reactor
    +_init?:() => void;
    +_wrapup?: () => void;    
    _reactions:$ReadOnlyArray<[Array<Guard>, Reaction<any, any>]>; // FIXME: how do we align this with Actor?    
    // perhaps a separate definition for scheduled reactions? See discussion with Edward
    // that means that ports would have to have a default value
    // this would help with primitive values in a language like C

}   

class Trigger<T> implements Guard {
    value: T;
    _parent: Component;
    constructor(parent:Component) {
        this._parent = parent;
    }

        /**
     * NOTE: Since each composite has its own clock domain, we cannot 
     * depend on a global function like setTimeout or setInterval.
     */
    schedule(delay?:number, repeat?:boolean):number {
        if (this._parent != null) {
            //this._parent.trigger(trigger, delay, repeat);    
        } else {
            throw "Unable to schedule trigger; no parent."
        }
        return 0;   
    }

    unschedule(handle: number) {

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
    
    /* The name of this component. */
    _name: string;      // FIXME: Maybe make these symbols to prevent collisions?
    /* Index to be set by parent to ensure unique FQN. */
    _index:?number;
    /* The container this component has been added to. */
    _parent:?Composite;
    
    /**
     * Create a new component; use the constructor name
     * if no name is given.
     * @param {string=} name - Given name
     */
    constructor(parent:?Composite, name?:string) {
        this._parent = parent;
        if (name == null) {
            this._name = this.constructor.name;
        } else {
            this._name = name;
        }
        if (parent != null) {
            parent.add(this);
        }
    }

    hasGrandparent: (container:Composite) => boolean;

    hasParent: (component: Component) => boolean;

    /**
     * Return a string that identifies this component.
     */
    getFullyQualifiedName(): string {
        var path = "";
        if (this._parent != null) {
            path = this._parent.getFullyQualifiedName();
        }
        if (path != "") {
            path = path + "." + this._name;

        } else {
            path = this._name;
        }
        if (this._index != null && this._index != 0) {
            return path + "(" + this._index + ")";
        } else {
            return path;
        }
    }
}

//See: http://exploringjs.com/es6/ch_classes.html#sec_private-data-for-classes
export class PortBase implements Nameable {
    
    /***** Priviledged functions *****/

    /* Return a globally unique identifier. */
    getFullyQualifiedName: () => string;
    
    hasGrandparent: (container:Composite) => boolean;
    hasParent: (component: Component) => boolean;

    /* Construct a new port base. */
    constructor(parent: Component) {
        Object.assign(this, {
            getFullyQualifiedName(): string {
                var prefix = parent.getFullyQualifiedName();
                for (let prop in parent) {
                    if (parent.prop == this) {
                        return prefix + `${prop}`;
                    }
                }
                throw "This port is not a property of its parent."
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
                if (container == parent._parent) {
                    return true;
                } else {
                    return false;
                }
            }
        });
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
export interface Port<T> extends Connectable<Port<$Supertype<T>>> {

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
    send: (value: ?$Subtype<T>, delay?:number) => void;
    get: (delay?:number) => ?$Subtype<T>;

    constructor(parent: Component) {
        super(parent);
        
        var events: Map<number, T> = new Map();

        Object.assign(this, {
            send(value: ?$Subtype<T>, delay?:number): void {
                
                // 
                // maintain a map in the composite that maps outputs to values at certain times
                // upon reaching a time, propagate all outputs to the respective receivers
                // FIXME: why not have get() pull values from upstream? They must have been generated.
            }
        });

        Object.assign(this, {
            canConnect(sink: Port<$Supertype<T>>): boolean {
                var thisComponent = parent;
                var thisContainer = parent._parent;

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
                if (parent._parent != null) {
                    parent._parent.connect(this, sink);
                } else {
                    throw "Unable to connect: add the port's component to a container first.";
                }
            }
        });

        Object.assign(this, {
            disconnect(direction?:"upstream"|"downstream"|"both"="both"): void {
                var component = parent;
                var container = component._parent;

                if (direction == "upstream" || direction == "both") {
                    if (component instanceof Composite) {    
                        // OUT to OUT
                        component.disconnectContainedReceivers(this);
                    }
                }

                if (direction == "downstream" || direction == "both") {
                    // OUT to IN
                    // OUT to OUT
                    if (container != null) {
                        container.disconnectContainedSource(this);     
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



export class InPort<T> extends PortBase implements Port<T>, Guard {

    /***** Priviledged functions *****/
    canConnect:(sink: Port<$Supertype<T>>) => boolean;        
    connect: (sink: Port<$Supertype<T>>) => void;
    disconnect: (direction?:"upstream"|"downstream"|"both") => void;
    send: (value: ?$Subtype<T>, delay?:number) => void;
    get: () => ?$Subtype<T>;

    //other ideas:
    // lastValue()
    // isPresent(), which may be part of the Guard interface
    // isPresent() => lastValue == currentValue

    _value: ?T;
    _receivers: Set<Port<$Supertype<T>>>;
    //_parent: Component; // $ReadOnly ?
    _persist: boolean;

    constructor(parent: Component, persist:boolean=false) { // should all things that are not triggers be persistent?
        super(parent);
        var value:?$Subtype<T> = null;

        Object.assign(this, {
            get():?$Subtype<T> {
                return value;
            }
        });

        Object.assign(this, {
            send(value: ?$Subtype<T>, delay?:number):void {
                if (delay == null || delay == 0) {
                    value = value;
                }
            }
        });

        Object.assign(this, {
            canConnect(sink: Port<$Supertype<T>>): boolean {
                var thisComponent = parent;
                var thisContainer = parent._parent;
                
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
                if (parent._parent != null) {
                    parent._parent.connect(this, sink);
                }
            }
        });

        Object.assign(this, {
            disconnect(direction?:"upstream"|"downstream"|"both"="both"): void {
                var component = parent;
                var container = component._parent;

                if (direction == "upstream" || direction == "both") {
                    if (container != null) {
                        // OUT to IN
                        // IN to IN
                        container.disconnectContainedReceivers(this);
                    }    
                }

                if (direction == "downstream" || direction == "both") {
                    if (component instanceof Composite) {
                        // IN to IN
                        component.disconnectContainedSource(this);
                    }
                    if (container != null) {
                        // IN to OUT
                        container.disconnectContainedSource(this);
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

export class Composite extends Component implements Container<Component> {

    _components: Set<Component> = new Set();
    _indices: Map<string, number> = new Map();

    constructor(parent:?Composite, name?:string) {
        super(parent, name);

        /* Private variables */
        var relations: Map<Port<any>, Set<Port<any>>> = new Map();
        
        // queue for delayed triggers
        var triggerQ: Map<number, [Map<Trigger<any>, any>]> = new Map();

        // queue for delayed sends
        var sendQ: Map<number, [Map<Port<any>, any>]> = new Map();

        // An actor may have triggers, some of which are wired to upstream actors, while others are essentially wired to the the director (for self-scheduled events).
        // The self-scheduled events must be handled before inputs are updated! (as per discussion with Edward)

        // Sequence:
        // - self triggers ==> this conflicts with the requirement that all inputs be known before any reactions occurs!
        // - sends (including to self)
        // - input reactions 

        // we need to express dependencies between reactions, not between ports
        var dependencies: Map<() => void, () => void> = new Map();

        // upon the generation of an output, that output needs to be propagated; how do we know whether a downstream reaction may be invoke, or another reaction has to go first?

        Object.assign(this, {
            // FIXME: We may want to wrap this in a change request and 
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

        Object.assign(this, {
            react() {
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
            disconnectContainedReceivers(port: Port<*>): void {
                for (var receivers of relations.values()) {
                        receivers.delete(port);
                }
            }

        });

        Object.assign(this, {
            disconnectContainedSource(port: Port<*>): void {
                relations.delete(port);
            }
        });
    }

    disconnectContainedReceivers: (port: Port<*>) => void;
    disconnectContainedSource: (port: Port<*>) => void;

    connect: <T>(source: Port<T>, sink:Port<$Supertype<T>>) => void;
    //disconnect: (port: Port<*>, direction?:"upstream"|"downstream"|"both") => void;
    
    react: () => void;
    
    trigger(trigger:Trigger<*>, delay?:number, repeat?:boolean):number {
        return 0; // handle
    }

    /**
     * Add a list of elements to this container.
     * @param {T} element
     */
    add(...components: Array<Component>): void {
        
        for (var c of components) {
            var index = 0;
            if (this._indices.has(c._name)) {
                index = this._indices.get(c._name)+1;
                this._indices.set(c._name, index);
            } else {
                this._indices.set(c._name, index);
            }
            c._index = index;
            c._parent = this;
            this._components.add(c);
        }
    }

    /**
     * Return whether or not the argument is present in the container.
     * @param {T} element
     */
    contains(element: Component): boolean {
        return true; //this._components.includes(element);
    }

    /**
     * Get an elements held by this container.
     */
    getAll(): Set<Component> {
        return this._components;
    }

    /**
     * Remove an element from this container.
     * @param {string} name
     */
    remove(element: Component): void {
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
class Parameter<T> extends InPort<T> {

    _default:T;
    
    getParameter: () => $Subtype<T>;
    setDefault : ($Subtype<T>) => void;

    constructor(parent: Component, defaultValue:T, persist:boolean=true) {
        super(parent, persist);
        
        Object.assign(this, {
            send(value: ?$Subtype<T>, delay?:number): void {
                if (value == null) {
                    this.reset();
                } else {
                    this._default = value; // FIXME: default vs current value
                }
            }
        });

        Object.assign(this, {
            getParameter(): $Subtype<T> {
                //FIXME: only use default value when there's no input
                return defaultValue;
            }
        });
    }

    reset() {
        this._value = this._default;
    }

}

/**
 * Base class for reactions that has two type parameter: 
 * T, which describes a tuple of triggers/inputs/outputs;
 * S, which describes an object that keeps shared state.
 * The reaction can also maintain state locally.
 */
export class Reaction<T,S:?Object> {

    io:T
    shared:S;
    
    constructor(io:T, state:S) {
        this.io = io;
        this.shared = state;
    }

    +react: (time:number) => void;
}

// class Add extends Reaction<{in1:InPort<number>, in2:InPort<number>, sum:OutPort<number>}, {}> {

//     react() {
//         this.io.sum.send(this.io.in1.get() + this.io.in2.get());
//     }
// }

// class Test extends Component implements Actor {

//     _reactions = [];

//     in1:InPort<number> = new InPort(this);
//     in2:InPort<number> = new InPort(this);
//     sum: OutPort<number> = new OutPort(this);

//  x = new Add({in1: this.in1, in2: this.in2, sum: this.sum}, {});

// }


/**
 * An actor implementation is a reactive component with ports as properties.
 */
 class MyActor extends Component implements Actor {
 
    a: InPort<{t: number}> = new InPort(this);
    out: OutPort<*> = new OutPort(this);

    _reactions = [
        
    ];

    someFunc = function() {

    }
 
    // idea: a preprocessing step could analyze the reactions and generate an actor type that's also inspectable during runtime...
    // how do we prevent reactions from being added at runtime? We could define an array of reactions instead

 }
 
 class MyActor2 extends Component implements Actor {
 
    a: InPort<{t: number}> = new InPort(this);
    b: OutPort<{t: number, y: string}> = new OutPort(this);

    _reactions = [
       
    ];

}

// export class Dummy extends Reaction<null, null> {
//     react() {

//     }
// }

// Eventually, this should become a worker/threaded composite
// Also, check out https://github.com/laverdet/isolated-vm
export class App extends Composite implements Executable {
    
    // add some logging facility here

    constructor(name: string) {
        super(null, name);
    }

    start():void {

    }

    stop():void {

    }
}

class MyApp extends App {
    port = new InPort(this);
    constructor(name: string, someParam: string) {
        super(name);
        let x = new MyActor(this);
        let y = new MyActor2(this);
        //this.add(x, y);
        //this.connect(x.a, y.b); // Demonstrates type checking ability.
        this.connect(y.b, x.a);
        //y.b.connect(x.a);
        //x.a.connect(y.b); // Demonstrates type checking ability.
    }
}

var app = new MyApp("Hello World", "!");
app.start();


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