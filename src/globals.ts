'use strict';

import { PrioritySet } from "./util";
import { Event, Timer, Reaction, Trigger, TimeInterval, TimeInstant, PrioritizedEvent, Reactable } from "./reactor";

export var reactionQ = new PrioritySet();
export var eventQ = new PrioritySet();

//The current time, made available so actions may be scheduled relative
//to it. We'll see if this should be moved somewhere else.
export var currentLogicalTime: TimeInstant = [0,0];

//Array of timers used to start all timers when the runtime begins.
//_timers are registered here in their constructor.
export var timers: Array<Timer> = [];

/**
 * This class matches a Trigger to the Reactables it triggers.
 * When an event caused by a Trigger comes off the event queue, its
 * matching reactables should be put on the the reaction queue 
 */
export class TriggerMap{
    _tMap: Map<Trigger, Set<Reactable>> = new Map<Trigger, Set<Reactable>>();

    /**
     * Establish the mapping for a Reactable.
     */
    registerReactable(r: Reactable){
        for(let trigger of r.triggers){
            let reactableSet = this._tMap.get(trigger);
            if(reactableSet){
                if(! reactableSet.has(r)){
                    reactableSet.add(r);
                    this._tMap.set(trigger, reactableSet);
                }
                //If this reactable is already mapped to the trigger,
                //do nothing.
            } else {
                //This is the first reactable mapped to this trigger,
                //so create a new reactable set for it.
                reactableSet = new Set<Reactable>();
                this._tMap.set(trigger, reactableSet);
            }
        }
    }

    /**
     * Get the set of reactables for a trigger.
     */
    getReactables(t: Trigger){
        return this._tMap.get(t);
    }

    /**
     */
    deregisterReactable(e: Event){
        //FIXME
    }

}

//FIXME: Triggers must be inserted into this map somewhere.
//Map triggers coming off the event queue to the reactables they trigger. 
export var triggerMap: TriggerMap = new TriggerMap();


//Use BigInt instead of number?
var _reactionIDCount = 0;
export function getReactionID(){
    return _reactionIDCount++;
}

//Use BigInt instead of number?
var _eventIDCount = 0;
export function getEventID(){
    return _eventIDCount++;
}

//FIXME. This should be done in a more object oriented way.
//See the commented out action class in reactor.
export function scheduleEvent(e: PrioritizedEvent){

    //FIXME to use the triggerMap    
    eventQ.push(e);
}

export function startRuntime() {
    _startTimers();
    //Main from C host:
    // if (process_args(argc, argv)) {
    //     initialize();
    //     __start_timers();
    //     while (next() != 0 && !stop_requested);
    //     wrapup();
    // 	return 0;
    // } else {
    // 	return -1;
    // }
}

var _startTimers = function(){
    for(let t of timers){
        t.setup();
    }
};

// Wait until physical time matches or exceeds the time of the least tag
    // on the event queue. If there is no event in the queue, return false.
    // After this wait, advance current_time to match
    // this tag. Then pop the next event(s) from the
    // event queue that all have the same tag, and extract from those events
    // the reactions that are to be invoked at this logical time.
    // Sort those reactions by index (determined by a topological sort)
    // and then execute the reactions in order. Each reaction may produce
    // outputs, which places additional reactions into the index-ordered
    // priority queue. All of those will also be executed in order of indices.
    // If the -timeout option has been given on the command line, then return
    // false when the logical time duration matches the specified duration.
    // Also return false if there are no more events in the queue and
    // the keepalive command-line option has not been given.
    // Otherwise, return true.
export function next(){
        let currentHead = eventQ.peek();
        //Fixme
    }


//FIXME: Move queues, schedule, into Runtime class, or make them properties of reactors,
//and delete this class. I like the idea of calling startRuntime() directly on the top
//level Reactor.
export class Runtime {


    //The C hosts's start_timers function contains the line
    //__schedule(&" + triggerStructName + ", 0LL, NULL);


    //Start function
    //Begins timers and starts physical time0,
    //which triggers the first reactions.
    //Then enters a loop reading off of queues.

    //To do this, Runtime needs to know about all the timers it has to start
    //Reactors can either register timers with Runtime.
    //Or the timers can register themselves with Runtime when they're constructed.  
    //Or Runtime can be responsible for creating timers in the first place.
    //eg. Runtime.newTimer().
    //Or maybe I'm thinking about timers wrong and it's not necessary to
    //start them independently...
 
    //You shouldn't be able to create a timer without the runtime knowing about it.
    //The runtime needs to know about
    
    //Timers, inputs, and actions are the events that can trigger reactions.

    // The schedule function does this:
    // Schedule the specified trigger at current_time plus the
    // offset declared in the trigger plus the extra_delay.

}