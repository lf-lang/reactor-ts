/* @flow */

'use strict';
import type {TimeInterval, TimeInstant} from './reactor';
import {Action, Reactor, Reaction, InPort, OutPort, Trigger, Parameter, PureEvent, UnorderedReaction} from './reactor';

export class Clock extends Reactor {
    tick: Action<boolean> = new Action(this);
    output: OutPort<PureEvent> = new OutPort(this);
    period: Parameter<number> = new Parameter(this, 1000); // FIXME: maybe turn this back into a persistent port?
    shared = {handle:0};

    _reactions = [
        [[this.tick], new Tick(), [this.output]],
        [[this.period], new AdjustRate(this.shared), [this.tick, this.period]]
    ];

}

class Tick implements UnorderedReaction {
    react(out:OutPort<PureEvent>) {
        out.set(new PureEvent);
    }
}

class AdjustRate implements Reaction {
    state:{handle:TimeInstant};
    constructor(state:{handle:TimeInstant}) {
        this.state = state;
    }
    react(tick:Action<any>, delay:InPort<TimeInterval>) {
        this.state.handle = tick.schedule(delay.get());
    }
}
