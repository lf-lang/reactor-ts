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


    success: () => void;
    fail: () => void;

    constructor(state: Reactor, triggers: Trigger[], priority: number, success: () => void, fail: ()=>void ){
        super(state, triggers, priority)
        this.success = success;
        this.fail = fail;
    }

    /**
     * If the action payload is correct, test is successful. Otherwise it fails.
     * @override
     */
    react(){
        const msg = (this.state as any).a1.get();
        if(msg == "hello"){
            this.success();
        } else {
            this.fail();
        }
        console.log("Response to action is reacting. String payload is: " + msg);
    }
}

//Upon initialization, this reactor should produce an
//output event
export class ActionTrigger extends Reactor {

    t1: Timer = new Timer(0,0);
    a1: Action<string> = new Action<string>( TimelineClass.logical);

    constructor( success: () => void, fail: () => void, parent:Reactor|null, name?:string) {
        super(parent, name);

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
        const r2 = new RespondToAction(this, respondToActionTriggers, 0, success, fail);
        
        this._reactions.push(r1);
        this._reactions.push(r2);
    }
}
