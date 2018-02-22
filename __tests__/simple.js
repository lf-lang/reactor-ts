import { Actor, OutputPort, InputPort, Port, Component, PortSet, Composite, DiscreteEvents } from "../src/index.js";

describe('simple two actors send/recv', () => {
    // Ideally we should use a dummy director. For now, DE works.
    let director = new DiscreteEvents();
    let root = new Composite("root", null, director);
    let actor1 = new Actor("actor1", root);
    actor1.add(new OutputPort("out"));
    let actor2 = new Actor("actor2", root);
    actor2.add(new InputPort("in"));

    // root.connect(actor1.getPort("out"), actor1.getPort("in"));
    // actor1.send("out", 1);
    // actor2.recv("in");
    // director.fire();

    it('actor2 receives data', () => {
        // expect(actor2.get("in")).toBe(1);
    });
});
