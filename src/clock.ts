'use strict';

import {Reactor, InPort, OutPort, Trigger, Reaction, Timer, TimeInterval} from './reactor';

//No reactions. Just a timer.
export class Clock extends Reactor {

    _reactions = [];
    //     new Reaction(this,[<Trigger>this.in1, <Trigger>this.in2], this.reactionID1, ),
    //      new Reaction(this,[<Trigger>this.in1, <Trigger>this.in2], )
    //     {triggers: [<Trigger>this.in1, <Trigger>this.in2], reaction: new AddTwo(), args: [this.in1, this.in2, this.out]},
    //     {triggers: [<Trigger>this.in1, <Trigger>this.in2], reaction: new AddN<number>(), args: [[this.in1, this.in2], this.out]},
    // ];

    //FIXME: Remove this when global triggerMap is implemented
    //_triggerMap:Map<Trigger, Set<[Reaction, Array<any>]>>;

    constructor() {
        super(null, "Clock");

        const t1 = new Timer( [1, "sec"], [3, "sec"]);
        const t2 = new Timer( [1.5, "sec"] , [3.5, "sec"] );
        this.addTimer(t1);
        this.addTimer(t2);
        //new AddTwo2([this.in1, this.in2, this.in1]);
    }
}
