'use strict';

import { PrioritySet } from "./util";
import { Event, Timer, Reaction, Trigger, TimeInterval, TimeInstant, PrioritizedEvent, PrioritizedReaction, timeIntervalToNumber, Action } from "./reactor";

//FIXME: Move all of this into a singleton class named Runtime

/**
 * If not null, finish execution with success at this physical time.
 */
var _executionTimeout:TimeInterval | null = null;

export function setExecutionTimeout(t: TimeInterval){
    _executionTimeout = t;
}

export var reactionQ = new PrioritySet<number,number>();
export var eventQ = new PrioritySet<number,TimeInstant>();

//The current time, made available so actions may be scheduled relative
//to it. We'll see if this should be moved somewhere else.
export var currentLogicalTime: TimeInstant = [0,0];

//The physical time when execution began expressed as
//the number of milliseconds elapsed since January 1, 1970 00:00:00 UTC.
//Initialized in startRuntime
export var startingWallTime: number = -1;

//Array of timers used to start all timers when the runtime begins.
//_timers are registered here in their constructor.
export var timers: Array<Timer> = [];

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
     */
    deregisterreaction(e: Event){
        //FIXME
    }

}

//FIXME: Triggers must be inserted into this map somewhere.
//Map triggers coming off the event queue to the reactions they trigger. 
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
    eventQ.push(e);
}

export function startRuntime(successCallback: () => void , failureCallback: () => void ) {
    startingWallTime = Date.now();
    _startTimers();
    _next(successCallback, failureCallback);
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

    ///FIXME, give callbacks a way to return status info.
export function _next(successCallback: ()=> void, failureCallback: () => void){
        let currentHead = eventQ.peek();
        while(currentHead){
            let currentPhysicalTime = Date.now() - startingWallTime;
            
            //If execution has gone on for longer than the execution timeout,
            //terminate execution with success.
            if(_executionTimeout && 
                    timeIntervalToNumber(_executionTimeout) < currentPhysicalTime ){
                console.log("Execution timeout reached. Terminating runtime with success.");
                successCallback();
                return;
            }

            let physicalTimeGap = currentHead._priority[0] - currentPhysicalTime;
            if(physicalTimeGap > 0){
                
                //Physical time is behind logical time.
                //Wait until execution timeout or the next event and try again.
                let timeout = physicalTimeGap;
                if(_executionTimeout){
                    timeout = Math.min(physicalTimeGap, timeIntervalToNumber(_executionTimeout));
                }

                console.log("I set a timeout.");
                console.log("currentPhysicalTime: " + currentPhysicalTime);
                console.log("next logical time: " + currentHead._priority[0]);
                console.log("physicalTimeGap was " + physicalTimeGap);

                setTimeout(  ()=>{
                    _next(successCallback, failureCallback);
                    return;
                }, timeout);
                return;
            } else {
                //Physical time has caught up, so advance logical time
                currentLogicalTime = currentHead._priority;
                console.log("At least one event is ready to be processed")
                console.log("advanced logical time to: " + currentHead._priority[0]);
                console.log("currentPhysicalTime: " + currentPhysicalTime);
                console.log("physicalTimeGap was " + physicalTimeGap);

                //Remove all simultaneous events from the queue.
                //Reschedule timers, and put the triggered reactions on
                //the reaction queue.

                //Using a Set ensures a reaction triggered by multiple events at the same
                //logical time will only react once.
                let triggersNow = new Set<Reaction>();

                //Keep track of the actions which trigger a reaction so their payloads
                //may be associated with the reaction.
                let reactionsToActions = new Map<Reaction, Set<Action<any>>>();

                //This loop should always execute at least once.
                while(currentHead && currentHead._priority[0] == currentLogicalTime[0] &&
                    currentHead._priority[1] == currentLogicalTime[1] ){

                    //An explicit type assertion is needed because we know the
                    //eventQ contains PrioritizedEvents, but the compiler doesn't know that.
                    let trigger: Trigger = (currentHead as PrioritizedEvent).e.cause;
                    
                    if(trigger instanceof Timer){
                        trigger.reschedule();
                    }

                    let toTrigger = triggerMap.getReactions(trigger);
                    if(toTrigger){
                        for(let reaction of toTrigger){

                             //Ensure this reaction is matched to its actions 
                            if(trigger instanceof Action){
                                let actionArray = reactionsToActions.get(reaction);
                                if( ! actionArray){
                                    actionArray = new Set<Action<any>>();
                                } 
                                actionArray.add(trigger);
                            }

                            //Push this reaction to the queue when we are done
                            //processing events.
                            triggersNow.add(reaction);
                        }
                    }
                    eventQ.pop();
                    currentHead = eventQ.peek();
                }
                
                for (let reaction of triggersNow){
                    console.log("Pushing new reaction onto queue");
                    console.log(reaction);
                    let prioritizedReaction = new PrioritizedReaction(reaction, getReactionID());
                    let triggeringActions = reactionsToActions.get(reaction);
                    if(triggeringActions){
                        prioritizedReaction.r.triggeringActions = triggeringActions;
                    }
                    reactionQ.push(prioritizedReaction);
                }
 
                
                let headReaction = reactionQ.pop();
                while(headReaction){
                    //Explicit annotation because reactionQ contains PrioritizedReactions.
                    console.log("reacting...");
                    (headReaction as PrioritizedReaction).r.react();
                    headReaction = reactionQ.pop();
                }
            }

            //The next iteration of the outer loop is ready because
            //currentHead is either null, or a future event
        }
        //Falling out of the while loop means the eventQ is empty.
        console.log("Terminating runtime with success due to empty event queue.");
        successCallback();
        return;
        //FIXME: keep going if the keepalive command-line option has been given
    }


//FIXME: Move queues, schedule, into Runtime class, or make them properties of reactors,
//and delete this class. I like the idea of calling startRuntime() directly on the top
//level Reactor.

//Idea: make runtime a singleton class?
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