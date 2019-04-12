/* @flow */

'use strict';

import {Action, Component, ReActor, Reaction, InPort, OutPort, Trigger, Parameter, PureEvent} from './reactor';

export class Clock extends Component implements ReActor {
    tick: Action<boolean> = new Action(this);
    output: OutPort<PureEvent> = new OutPort(this);
    period: Parameter<number> = new Parameter(this, 1000); // FIXME: maybe turn this back into a persistent port?
    shared: {handle: number} = {handle:-1};

    _reactions = [
        [[this.tick], new Tick(this.output)],
        [[this.period], new AdjustRate([this.tick, this.period], this.shared)]
    ];

    _init():void {
        this.shared.handle = this.tick.schedule(true, this.period.read(), true);
    }

    _wrapup() {
        this.tick.unschedule(this.shared.handle);   
    }
}

class Tick extends Reaction<OutPort<PureEvent>, ?{}> {
    react() {
        this.io.set(new PureEvent);
    }
}

class AdjustRate extends Reaction<[Action<*>, Parameter<number>], {handle:number}> {
    react() {
        this.shared.handle = this.io[0].schedule(true, this.io[1].read());
    }
}
