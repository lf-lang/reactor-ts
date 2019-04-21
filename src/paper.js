// @flow

'use strict';

import {Component, ReActor, InPort, OutPort, Clock, Reaction, App} from './reactor';

type int = number;

class Ramp extends Component implements ReActor {

    p: int;
    set: InPort<int>;
    output: OutPort<int>;
    clock: Clock = new Clock(this.p);
    count = 0;
    constructor(p:int=10) {
        super();
        this.p = p;
    }

    _reactions = [
        [[this.clock], new Incr([this.output], {count: this.count})],
        [[this.set], new Reset([this.set], {count: this.count})]
    ];
}

class Incr extends Reaction<[*], {count: number}> {
    react():void {
        this.io[0].set(this.shared.count++);
    }
}

class Reset extends Reaction<[*], {count: number}> {
    react():void {
        this.shared.count = this.io[0].get();
    }
}

class Print extends Component implements ReActor {
    input: InPort<int>;

     _reactions = [
        [[this.input], new Prt([this.input])]
    ];   
}

class Prt extends Reaction<[*], ?{}> {
    react():void {
        console.log(this.io[0].get());
    }
}

class MyApp extends App {
    
    constructor() {
        var a = new Ramp(1000);
        var b = new Print();
        a.output.connect(b.input);
    }
}
