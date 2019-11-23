'use strict';

import {Reactor, Trigger, Reaction, InPort, OutPort, Action } from '../reactor';
import { SingleEvent } from './SingleEvent';

export class OutputResponse extends Reaction{

    success: () => void;
    fail: () => void;

    constructor(state: Reactor, triggers: Trigger[], uses: Array<InPort<any>>,
        effects: Array<OutPort<any> | Action<any>>, success: () => void, fail: ()=>void ){
        super(state,triggers,uses, effects);
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

    se: SingleEvent = new SingleEvent(null, this, "ContainedSingleEvent");
    r: Reaction;

    constructor(success: ()=> void, fail: ()=> void, parent: Reactor|null, name?:string ){
        super(parent, name);
        
        this.r = new OutputResponse(this, [this.se.o], [], [], success, fail );
        this._reactions = [this.r];
    }
}


