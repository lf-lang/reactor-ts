'use strict';

import {Reactor, InPort, OutPort, Trigger, Reaction, Timer, TimeInterval, Action, TimelineClass} from './reactor';

export class ScheduleAction extends Reaction{

    /**
     * Produce an output event
     * @override
     */
    react(){
        let a = this.state.getAction("triggerResponse");
        let delay:TimeInterval = 0;
        if(a){
            a.schedule(delay);
        } else {
            throw new Error("triggerResponse action has not been registered with the reactor");
        }
        
        console.log("Scheduling an action in ScheduleAction to trigger RespondToAction");
    }
}

export class RespondToAction extends Reaction{


    /**
     * Produce an output event
     * @override
     */
    react(){
        console.log("Response to action is reacting.");
    }
}

//Upon initialization, this reactor should produce an
//output event
export class ActionTrigger extends Reactor {

    constructor() {
        super(null, "ActionTrigger");

        //FIXME: create and add an outPort, so the reaction
        //can write to it.

        const t1 = new Timer(0, 0);
        this.addTimer(t1);
        const a1 = new Action<null>("triggerResponse", TimelineClass.logical);
        this.addAction(a1);
        
        const scheduleActionTriggers = new Array();
        scheduleActionTriggers.push(t1);
        const r1 = new ScheduleAction(this, scheduleActionTriggers, 0);
        
        const respondToActionTriggers = new Array();
        respondToActionTriggers.push(a1);
        const r2 = new RespondToAction(this, respondToActionTriggers, 0);
        
        this._reactions.push(r1);
        this._reactions.push(r2);
    }
}
