'use strict';

import {Reactor, InPort, OutPort, Trigger, Reaction, Timer, TimeInterval, Action, TimelineClass} from './reactor';

export class ScheduleAction extends Reaction{

    /**
     * Schedule the correct payload for action a1.
     * @override
     */
    react(){
        (this.state as any).a1.schedule(0, "hello");
        
        console.log("Scheduling the final action in ScheduleAction to trigger RespondToAction");
    }
}

export class ScheduleOverriddenAction extends Reaction{

    /**
     * Schedule the incorrect payload for action a1.
     * @override
     */
    react(){
        (this.state as any).a1.schedule(0, "goodbye");
        
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
        
        //Reaction priorities matter here. The overridden reaction must go first.
        const r2 = new ScheduleOverriddenAction(this,[this.t1], 0);
        const r1 = new ScheduleAction(this, [this.t1], 1);
        const r3 = new RespondToAction(this, [this.a1], 2, success, fail);
        
        this._reactions = [r1, r2, r3];
    }
}
