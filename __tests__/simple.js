//@flow
import { Actor, OutputPort, InputPort, Port, Component, PortSet, Composite, DiscreteEvents } from "../src/index.js";

describe('simple two actors send/recv', () => {
    // Ideally we should use a dummy director. For now, DE works.
    let director = new DiscreteEvents();
    let root = new Composite("root", null, director);
    let actor1 = new Actor("actor1", root);
    actor1.add(new OutputPort("out"));
    let actor2 = new Actor("actor2", root);
    actor2.add(new InputPort("in"));

    let p1: Port<number> = actor1.find("out", "ports");
    let p2: Port<number> = actor2.find("in", "ports");
    
    director.connect(p1, p2);
    director.send(p1, 1);
    
    it('actor2 receives data', () => {
        expect(director.get(p2, 0)).toBe(1);
    });
});
