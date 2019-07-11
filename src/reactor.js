"use strict";
//import {PriorityQueue} from './util';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
//---------------------------------------------------------------------//
// Runtime Functions                                                   //
//---------------------------------------------------------------------//
function _schedule(action, additionalDelay, value) {
    return [0, 0];
}
exports._schedule = _schedule;
/**
 * An action denotes a self-scheduled event. If an action is instantiated
 * without a delay, then the time interval between the moment of scheduling
 * this action (cause), and a resulting reaction (effect) will be determined
 * upon the call to schedule. If a delay _is_ specified, it is considered
 * constant and cannot be overridden using the delay argument in a call to
 * schedule().
 */
var Action = /** @class */ (function () {
    function Action(parent, delay) {
        var _value;
        Object.assign({
            get: function () {
                return _value;
            }
            // FIXME: add writeValue
        });
        Object.assign(this, {
            schedule: function (additionalDelay, value) {
                if (delay == null || delay === 0) {
                    delay = additionalDelay;
                }
                else {
                    if (additionalDelay != null && additionalDelay !== 0) {
                        delay[0] += additionalDelay[0];
                    }
                }
                return _schedule(this, delay, value);
            }
        });
    }
    Action.prototype.unschedule = function (handle) {
        // FIXME
    };
    return Action;
}());
exports.Action = Action;
var Timer = /** @class */ (function () {
    function Timer(period) {
    }
    Timer.prototype.adjustPeriod = function (period) {
        // FIXME
    };
    return Timer;
}());
exports.Timer = Timer;
//type Port<+T> = Port<T>;
/**
 * Each component has a name. It will typically also acquire a
 * parent, unless it is a top-level composite. The parent property
 * is set/unset once a component is added to or removed from a
 * container. Adding a component to a container will also ensure
 * that it is uniquely indexed within that container.
 */
var Reactor = /** @class */ (function () {
    //connect: <T>(source: Port<T>, sink:Port<T>) => void;
    // FIXME: connections mus be done sink to source so that we leverage contravariance of functions!!!
    /**
     * Create a new component; use the constructor name
     * if no name is given.
     * @param {string=} name - Given name
     */
    function Reactor(parent, name) {
        var myName = this.constructor.name; // default
        var myIndex = null;
        var relations = new Map();
        // Set this component's name if specified.
        if (name != null) {
            myName = name;
        }
        Object.assign(this, {
            _getFullyQualifiedName: function () {
                var path = "";
                if (parent != null) {
                    path = parent._getFullyQualifiedName();
                }
                if (path != "") {
                    path += "/" + this._getName();
                }
                else {
                    path = this._getName();
                }
                return path;
            }
        });
        Object.assign(this, {
            _getName: function () {
                if (myIndex != null && myIndex != 0) {
                    return myName + "(" + myIndex + ")";
                }
                else {
                    return myName;
                }
            }
        });
        Object.assign(this, {
            _setName: function (name) {
                if (parent != null && (name != myName || myIndex == null)) {
                    //myIndex = parent._getFreshIndex(name); //FIXME: look at former composite
                    myName = name;
                }
            }
        });
        Object.assign(this, {
            _hasGrandparent: function (container) {
                if (parent != null) {
                    return parent._hasParent(container);
                }
                else {
                    return false;
                }
            }
        });
        Object.assign(this, {
            _hasParent: function (container) {
                if (parent != null && parent == container) {
                    return true;
                }
                else {
                    return false;
                }
            }
        });
        Object.assign(this, {
            _getContainer: function () {
                return parent;
            }
        });
        Object.assign(this, {
            _acquire: function (newParent) {
                if (parent == null) {
                    parent = newParent;
                    return true;
                }
                else {
                    return false;
                }
            }
        });
        Object.assign(this, {
            _release: function (oldParent) {
                if (parent == oldParent) {
                    parent = null;
                    myIndex = null;
                    return true;
                }
                else {
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
    Reactor.prototype._getInputs = function () {
        var inputs = new Set();
        for (var _i = 0, _a = Object.entries(this); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            if (value instanceof InPort) {
                inputs.add(value);
            }
        }
        return inputs;
    };
    Reactor.prototype._getOutputs = function () {
        var outputs = new Set();
        for (var _i = 0, _a = Object.entries(this); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            if (value instanceof OutPort) {
                outputs.add(value);
            }
        }
        return outputs;
    };
    return Reactor;
}());
exports.Reactor = Reactor;
var PortBase = /** @class */ (function () {
    /* Construct a new port base. */
    function PortBase(parent) {
        Object.assign(this, {
            _getFullyQualifiedName: function () {
                return parent._getFullyQualifiedName()
                    + "/" + this._getName();
            }
        });
        Object.assign(this, {
            hasParent: function (component) {
                if (component == parent) {
                    return true;
                }
                else {
                    return false;
                }
            }
        });
        Object.assign(this, {
            hasGrandparent: function (container) {
                if (container == parent._getContainer()) {
                    return true;
                }
                else {
                    return false;
                }
            }
        });
        Object.assign(this, {
            _getName: function () {
                var alt = "";
                for (var _i = 0, _a = Object.entries(parent); _i < _a.length; _i++) {
                    var _b = _a[_i], key = _b[0], value = _b[1];
                    if (value === this) { // do hasOwnProperty check too?
                        return "" + key;
                    }
                }
                return "anonymous";
            }
        });
    }
    PortBase.prototype.toString = function () {
        return this._getFullyQualifiedName();
    };
    return PortBase;
}());
exports.PortBase = PortBase;
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
var OutPort = /** @class */ (function (_super) {
    __extends(OutPort, _super);
    function OutPort(parent) {
        var _this = _super.call(this, parent) || this;
        var myValue = null;
        var events = new Map();
        Object.assign(_this, {
            set: function (value) {
                myValue = value;
            }
        });
        Object.assign(_this, {
            get: function () {
                return myValue;
            }
        });
        Object.assign(_this, {
            canConnect: function (source) {
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
        Object.assign(_this, {
            connect: function (source) {
                // var container = parent._getContainer();
                // if (container != null) {
                //     container.connect(this, sink);
                // } else {
                //     throw "Unable to connect: add the port's component to a container first.";
                // }
            }
        });
        Object.assign(_this, {
            disconnect: function (direction) {
                if (direction === void 0) { direction = "both"; }
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
        return _this;
    }
    // NOTE: Due to assymmetry (subtyping) we cannot allow connecting 
    // sinks to sources. It must always be source to sink. Disconnect 
    // does not have this problem.
    // connect(sink: Port<$Supertype<T>>): void {
    // }
    OutPort.prototype.toString = function () {
        return this._getFullyQualifiedName();
    };
    return OutPort;
}(PortBase));
exports.OutPort = OutPort;
var ContainedInput = /** @class */ (function () {
    function ContainedInput(reactor, port) {
        var valid = true;
        if (!port.hasParent(reactor)) {
            console.log("WARNING: port " + port._getFullyQualifiedName()
                + "is improperly used as a contained port; "
                + "set() will have no effect.");
            valid = false;
        }
        Object.assign(this, {
            set: function (value) {
                if (valid) {
                    return port.writeValue(reactor, value);
                }
            }
        });
    }
    return ContainedInput;
}());
var ContainedOutput = /** @class */ (function () {
    function ContainedOutput(reactor, port) {
        var valid = true;
        if (!port.hasParent(reactor)) {
            console.log("WARNING: port " + port._getFullyQualifiedName()
                + "is improperly used as a contained port; "
                + "get() will always return null.");
            valid = false;
        }
        Object.assign(this, {
            get: function () {
                if (!valid) {
                    return null;
                }
                else {
                    return port.get();
                }
            }
        });
    }
    return ContainedOutput;
}());
var InPort = /** @class */ (function (_super) {
    __extends(InPort, _super);
    /**
     * InPorts that are constructed with an initial value will be persistent
     */
    function InPort(parent, initialValue) {
        var _this = _super.call(this, parent) || this;
        if (initialValue)
            _this._value = initialValue;
        Object.assign(_this, {
            get: function () {
                return this._value;
            }
        });
        Object.assign(_this, {
            writeValue: function (container, value) {
                this._value = value; // FIXME: move _value inside constructor
            }
        });
        Object.assign(_this, {
            canConnect: function (source) {
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
        Object.assign(_this, {
            connect: function (source) {
                // var container = parent._getContainer()
                // if (container != null) {
                //     container.connect(this, sink);
                // }
            }
        });
        Object.assign(_this, {
            disconnect: function (direction) {
                if (direction === void 0) { direction = "both"; }
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
        return _this;
    }
    InPort.prototype.toString = function () {
        return this._getFullyQualifiedName();
    };
    return InPort;
}(PortBase));
exports.InPort = InPort;
var PureEvent = /** @class */ (function () {
    function PureEvent() {
    }
    return PureEvent;
}());
exports.PureEvent = PureEvent;
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
var App = /** @class */ (function (_super) {
    __extends(App, _super);
    // FIXME: add some logging facility here
    function App(name) {
        return _super.call(this, null, name) || this;
    }
    App.prototype.start = function () {
    };
    App.prototype.stop = function () {
    };
    return App;
}(Reactor));
exports.App = App;
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
var TransferValue = /** @class */ (function () {
    function TransferValue() {
    }
    TransferValue.prototype.react = function (from, to) {
        to.set(from.get());
    };
    return TransferValue;
}());
//# sourceMappingURL=reactor.js.map