'use strict';

import { PrioritySet } from "./util";

export var reactionQ = new PrioritySet();
export var eventQ = new PrioritySet();

//Use BigInt instead of number?
var _reactionIDCount = 0;
export function getReactionID(){
    return _reactionIDCount++;
}