// @flow

'use strict';

import {Reactor, InPort, OutPort, Action, Reaction} from './reactor';

const got = require('../node_modules/got');

export class HttpRequest extends Reactor {
 
    trigger: InPort<any> = new InPort(this);
    command: InPort<string> = new InPort(this); // use better types here
    arguments: InPort<Object> = new InPort(this);
    body: InPort<string> = new InPort(this);
    options: InPort<Object> = new InPort(this);
    
    reply: Action<*> = new Action(this);

    response: OutPort<Object> = new OutPort(this);
    status: OutPort<string> = new OutPort(this);
    headers: OutPort<Object> = new OutPort(this);

    _reactions = [
        [[this.trigger], new Issue(), [this.command, this.arguments, this.body, this.options, this.reply]]
    ];
}

class Issue extends Reaction {
    
    react():void {
        //this.io[2].set(this.io[0].get() + this.io[1].get());
        
        got('icyphy.org');

        (async () => {
            try {
                const response = await got('icyphy.org');
                console.log(response.body);
                //=> '<!doctype html> ...'
            } catch (error) {
                console.log(error.response.body);
                //=> 'Internal server error ...'
            }
        })();
    }
}