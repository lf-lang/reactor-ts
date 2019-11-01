'use strict';

import {Reactor, InPort, OutPort, Trigger, Reaction, Timer, TimeInterval, Action, TimelineClass} from './reactor';

export class ScheduleAction extends Reaction{

    /**
     * Produce an output event
     * @override
     */
    react(){
        (this.state as any).a1.schedule(0, "hello");
        
        console.log("Scheduling an action in ScheduleAction to trigger RespondToAction");
    }
}

export class RespondToAction extends Reaction{

    //FIXME Question:if a reaction is triggered by multiple actions,
    //how can it tell which one triggered it? Answer: give it an is_present function!

    /**
     * Produce an output event
     * @override
     */
    react(){
        const msg = (this.state as any).a1.get();
        console.log("Response to action is reacting. String payload is: " + msg);
    }
}

//Upon initialization, this reactor should produce an
//output event
export class ActionTrigger extends Reactor {

    t1: Timer = new Timer(0,0);
    a1: Action<string> = new Action<string>( TimelineClass.logical);

    constructor() {
        super(null, "ActionTrigger");

        //FIXME: create and add an outPort, so the reaction
        //can write to it.

        // const t1 = new Timer(0, 0);
        // this.addTimer(t1);
        // const a1 = new Action<string>("triggerResponse", TimelineClass.logical, null );
        // this.addAction(a1);
        
        const scheduleActionTriggers = new Array();
        scheduleActionTriggers.push(this.t1);
        const r1 = new ScheduleAction(this, scheduleActionTriggers, 0);
        
        const respondToActionTriggers = new Array();
        respondToActionTriggers.push(this.a1);
        const r2 = new RespondToAction(this, respondToActionTriggers, 0);
        
        this._reactions.push(r1);
        this._reactions.push(r2);
    }
}
