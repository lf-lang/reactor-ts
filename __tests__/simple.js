//@flow
import {Actor, OutPort, InPort, Component, Composite, App, PureEvent} from "../src/actor.js";

describe('simple two actors send/recv', () => {
    
    class Forward extends Actor implements Reactive {
        in: InPort<PureEvent> = new InPort(this);
        out: OutPort<PureEvent> = new OutPort(this);

        _reactions = [
            [[this.in], () => {this.out.send(this.in.get())}] // FIXME: use get instead
        ];

    } 

    let app = new App("Simple");
    let actor1 = new Forward(app);
    let actor2 = new Forward(app);

    it('connect two actors', () => {
         expect(actor1.out.canConnect(actor2.in)).toBeTruthy();
    });

    actor1.out.connect(actor2.in);

});
