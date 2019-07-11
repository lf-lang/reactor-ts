// @flow

'use strict';

import {Reactor, Action, InPort, OutPort, Reaction} from './reactor';

// FIXME: not sure what I was attempting to do here. Probably leave out of the repo for now.

export class OrderedRequest<T, R> extends Reactor {
 
    trigger: InPort<any> = new InPort(this);
    
    reply:Action<Promise<R>> = new Action(this);

    response: OutPort<R> = new OutPort(this);

    _map: Map<number, R> = new Map();
    _counter: number = 0;
}

// class Reorder<R> extends Reaction<Trigger<*,*>, {map: Map<number, R>, data: R}> {

//     react(time: ?number) {
//         // if (time != null) {
//         //     this.shared.map.add(time, data);
//         // }
//     }

// }