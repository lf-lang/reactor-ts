'use strict';

import {Reactor, InPort, OutPort, Trigger, Reaction, Timer, TimeInterval} from './reactor';
import { SingleEvent } from './singleEvent';

export class OutputResponse extends Reaction{

    success: () => void;
    fail: () => void;

    constructor(state: Reactor, triggers: Trigger[], priority: number,
                success: () => void, fail: ()=>void ){
        super(state,triggers,priority);
        this.success = success;
        this.fail = fail;

    }

    /**
     * If this reaction is triggered by an output event from the contained reactor,
     * succeed the test.
     * @override
     */
    react(){
        this.success();
    }
}

export class OutputResponder extends Reactor {

    se: SingleEvent = new SingleEvent(null, this, "ContainedSingleEvent");

    constructor(success: ()=> void, fail: ()=> void, parent: Reactor|null, name?:string ){
        super(parent, name);
        
        const r = new OutputResponse(this, [this.se.o], 0, success, fail );
    }
}


