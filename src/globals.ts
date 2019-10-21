'use strict';

import { PrioritySet } from "./util";
import { Timer, Reaction, Trigger } from "./reactor";

export var reactionQ = new PrioritySet();
export var eventQ = new PrioritySet();

//Array of timers used to start all timers when the runtime begins.
//_timers are registered here in their constructor.
export var timers: Array<Timer> = [];

//FIXME: Triggers must be inserted into this map somewhere.
//Map triggers coming off the event queue to their dependent reactions. 
export var triggerMap: Map<Trigger,Array<Reaction>> = new Map();

//Use BigInt instead of number?
var _reactionIDCount = 0;
export function getReactionID(){
    return _reactionIDCount++;
}

export function schedule(){
    //FIXME
}

//Call this 
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


//FIXME: Move queues, schedule, into Runtime class or delete this class.
export class Runtime {



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
    next = function() {
        //Fixme
    }

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