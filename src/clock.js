/* @flow */

'use strict';

import {Action, Component, ReActor, Reaction, InPort, OutPort, Trigger, Parameter, PureEvent} from './reactor';

export class Clock extends Component implements ReActor {
    tick: Action<number> = new Action(this);
    output: OutPort<PureEvent> = new OutPort(this);
    period: Parameter<number> = new Parameter(this, 1000); // FIXME: maybe turn this back into a persistent port?

    _reactions = [
        [[this.tick], new Tick(this.output)],
        [[this.period], new AdjustRate([this.tick, this.period])]
    ];

    _init():void {
        this.tick.schedule(true, this.period.read());
    }

    _wrapup() {
        this.tick.unschedule();   
    }
}

class Tick extends Reaction<OutPort<PureEvent>, ?{}> {
    react() {
        this.io.set(new PureEvent);
    }
}

class AdjustRate extends Reaction<[Action<*>, Parameter<number>], ?{}> {
    react() {
        this.io[0].schedule(true, this.io[1].read());
    }
}
