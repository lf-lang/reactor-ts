// @flow

'use strict';

// import {Reactor, InPort, OutPort, Action, Reaction, OrderedAsyncReaction} from './reactor';

// const got = require('../node_modules/got');

// type ReqID = number;
// type EventHandle = number;

// export class HttpGet extends Component implements ReActor {
 
//     url: InPort<string> = new InPort(this);
//     out: OutPort<string> = new OutPort(this);

//     response: Action<{body:string}> = new Action(this);
//     error: Action<string> = new Action(this);

//     _init() {};
//     _wrapup() {};

//     _reactions = [
//         [[this.url], new Fetch([this.url], {}, this.response, this.error)],
//         [[this.response], new HandleResponse([this.response, this.out])],
//     ];
// }

// class Fetch extends OrderedAsyncReaction<[InPort<string>], ?{}, {body:string}, string> {
    
//     doAsync(): Promise<{body:string}> {
//         console.log(this.io[0].get());
//         return got('icyphy.org'); // FIXME: use url input
//     }
// }


// class HandleResponse extends Reaction<[Action<{body:string}>, OutPort<string>], ?{}> {

//     react(time?: number):void {
//         this.io[1].set(this.io[0].get().body);
//     }

// }

// // class HandleError extends Reaction<[*,*], ?{}> {

// //     react(time?: number):void {
// //         this.io[1].set(this.io[0].get());
// //     }

// // }

