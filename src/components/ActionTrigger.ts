'use strict';

import {Reactor, Trigger, Reaction, Timer, Action} from '../reactor';
import {TimelineClass} from "../time"

export class ScheduleAction extends Reaction{

    /**
     * Schedule the correct payload for action a1.
     * @override
     */
    react(){
        (this.state as ActionTrigger).a1.schedule(0, "hello");
        
        console.log("Scheduling the final action in ScheduleAction to trigger RespondToAction");
    }
}

export class ScheduleOverriddenAction extends Reaction{

    /**
     * Schedule the incorrect payload for action a1.
     * @override
     */
    react(){
        (this.state as ActionTrigger).a1.schedule(0, "goodbye");
        
        console.log("Scheduling the overridden action in ScheduleOverriddenAction to trigger RespondToAction");
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
     * Since a2 was not scheduled it should return null on a call to get() and
     * should return false for isPresent().
     * @override
     */
    react(){
        const msg = (this.state as ActionTrigger).a1.get();
        const nothing = (this.state as ActionTrigger).a2.get();
        if(msg == "hello" && nothing === null && ! (this.state as ActionTrigger).a2.isPresent()){
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

    t1: Timer = new Timer(this, 0,0);
    
    // This action is scheduled with a value.
    a1: Action<string> = new Action<string>(this,TimelineClass.logical);

    // This action is never scheduled. It should never be present.
    a2: Action<string> = new Action<string>(this, TimelineClass.logical);

    r1: Reaction;
    r2: Reaction;
    r3: Reaction;

    constructor( success: () => void, fail: () => void, parent:Reactor|null, name?:string) {
        super(parent, name);
        
        //Reaction priorities matter here. The overridden reaction must go first.
        this.r1 = new ScheduleAction(this, [this.t1], 1);
        this.r2 = new ScheduleOverriddenAction(this,[this.t1], 0);
        this.r3 = new RespondToAction(this, [this.a1], 2, success, fail);
        
        this._reactions = [this.r1, this.r2, this.r3];
    }
}
