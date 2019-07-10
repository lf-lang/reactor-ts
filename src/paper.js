// @flow

'use strict';

import {Reactor, InPort, OutPort, Timer, Reaction, App, UnorderedReaction} from './reactor';

class Ramp extends Reactor {

    p: number;
    set: InPort<number>;
    output: OutPort<number>;
    timer: Timer = new Timer(this.p);
    count = 0;
    constructor(p:number=10) {
        super();
        this.p = p;
    }

    _reactions = [
        [[this.timer], new Incr({count: this.count}), [this.output]],
        [[this.set], new Reset({count: this.count}), [this.set]]
    ];


}

class Incr implements Reaction {
    state;
    constructor(state: {count: number}) {
        this.state = state;
    }
    react(output: OutPort<number>):void {
        output.set(this.state.count++);
    }
}

class Reset implements Reaction {
    state;
    constructor(state:{count:number}) {
        this.state = state;
    }
    react(set: InPort<number>):void {
        let val = set.get();
        if (val != null)
            this.state.count = val;
    }
}

class Print extends Reactor {
    input: InPort<number>;
     _reactions = [
        [[this.input], new Prt(), [this.input]]
    ];   
}

class Prt implements UnorderedReaction {
    react(input: InPort<number>):void {
        console.log(input.get());
    }
}

class MyApp extends App {
    
    constructor() {
        var a = new Ramp(1000);
        var b = new Print();
        a.output.connect(b.input);
    }
}
