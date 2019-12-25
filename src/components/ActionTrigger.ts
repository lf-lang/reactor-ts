import {Reactor, Reaction, Timer, Action, Trigs, Args, Schedulable} from '../reactor';
import {Origin} from "../time"

export class ScheduleAction<T, A> extends Reaction<T> {

    /**
     * Schedule the correct payload for action a1.
     * @override
     */
    //@ts-ignore
    react(a1: Schedulable<string>){
        a1.schedule(0, "hello");
        console.log("Scheduling the final action in ScheduleAction to trigger RespondToAction");
    }
}

export class ScheduleOverriddenAction<T, A> extends Reaction<T> {

    /**
     * Schedule the incorrect payload for action a1.
     * @override
     */
    //@ts-ignore
    react(a1: Schedulable<string>){
        a1.schedule(0, "goodbye");
        console.log("Scheduling the overridden action in ScheduleOverriddenAction to trigger RespondToAction");
    }
}

export class RespondToAction<T> extends Reaction<T> {

    /**
     * If the action payload is correct, test is successful. Otherwise it fails.
     * Since a2 was not scheduled it should return null on a call to get() and
     * should return false for isPresent().
     * @override
     */
    //@ts-ignore
    react(a1: Action<string>, a2: Action<string>){
        const msg = a1.get();
        const nothing = a2.get();
        if(msg == "hello" && nothing === null && ! a2.isPresent()) {
            this.parent._app.success();
            console.log("success")
        } else {
            this.parent._app.failure();
        }
        console.log("Response to action is reacting. String payload is: " + msg);
    }
}

//Upon initialization, this reactor should produce an
//output event
export class ActionTrigger extends Reactor {

    t1: Timer = new Timer(this, 0,0);
    
    // This action is scheduled with a value.
    a1: Action<string> = new Action<string>(this, Origin.logical);

    // This action is never scheduled. It should never be present.
    a2: Action<string> = new Action<string>(this, Origin.logical);

    constructor(parent:Reactor|null) {
        super(parent);
        //Reaction priorities matter here. The overridden reaction must go first.
        this.addReaction(new ScheduleOverriddenAction(this, Trigs(this.t1), Args(this.getSchedulable(this.a1), this.a2)));
        this.addReaction(new ScheduleAction(this, Trigs(this.t1), Args(this.getSchedulable(this.a1), this.a2)));
        this.addReaction(new RespondToAction(this, Trigs(this.a1), Args(this.a1, this.a2)));

    }
}
