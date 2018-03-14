//@flow
import { Actor, OutputPort, InputPort, Component, PortSet, Composite, DiscreteEvents } from "../src/index.js";

describe('simple two actors send/recv', () => {
    // Ideally we should use a dummy director. For now, DE works.
    let director = new DiscreteEvents();
    let root = new Composite("root");
    let actor1 = new Actor("actor1");
    actor1.add(new OutputPort("out"));
    let actor2 = new Actor("actor2");
    actor2.add(new InputPort("in"));
    
    root.add(actor1, actor2);
    //root.add(actor2); // FIXME: make add handle a list of arguments.
    root.director = director;
    
    let p1: Port<number> = actor1.find("out", "ports");
    let p2: Port<number> = actor2.find("in", "ports");

    director.connect(p1, p2);
    director.push(p1, 1);

    it('actor2 receives data', () => {
        expect(director.peek(p2, 0)).toBe(1);
    });

    let actor3 = new Actor("actor3");
    root.add(actor3);
    actor3.add(new OutputPort("out"));
    let p3: Port<number> = actor3.find("out", "ports");

    director.connect(p3, p2);
    director.push(p3, 2);

    it('actor2 receives muliplexed data', () => {
        expect(director.peek(p2, 0)).toBe(1);
        expect(director.peek(p2, 1)).toBe(2);
    });

    it('actor2 receives muliplexed data at once', () => {
        expect(director.peekMulti(p2)).toEqual([1, 2]);
    });


});
