'use strict';

import {Reactor, Trigger, Reaction, InPort, OutPort, Action, ArgType } from '../reactor';
import { SingleEvent } from './SingleEvent';

export class OutputResponse<T> extends Reaction<T> {

    success: () => void;
    fail: () => void;

    constructor(parent: Reactor, triggers: Trigger[], args:ArgType<T>, success: () => void, fail: ()=>void ){
        super(parent, triggers, args);
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

/**
 * This reactor calls the success callback if it triggers a reaction in response
 * to a value being set to a contained reactor's output port.
 */
export class OutputResponder extends Reactor {

    se: SingleEvent<string> = new SingleEvent(this, "ContainedSingleEvent");
    r: Reaction<any>;

    constructor(parent: Reactor|null, success: ()=> void, fail: ()=> void){
        super(parent);
        
        this.r = new OutputResponse(this, [this.se.o], [], success, fail);
        //this._reactions = [this.r];
    }
}


