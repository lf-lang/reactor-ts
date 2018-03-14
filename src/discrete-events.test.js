import {Actor, InputPort, OutputPort, Component, Composite} from "./hierarchy";
import {DiscreteEvents} from "./discrete-events";

describe('connect', () => {
    let topLevel = new Composite("topLevel");
    let composite = new Composite("composite");
    let component = new Component("component");
    let director = new DiscreteEvents();
    topLevel.director = director;
    topLevel.add(composite);
    composite.add(component);

    let input = new InputPort("in");
    let output = new OutputPort("out");

    it('toplevel to self', () => {
        topLevel.add(input);
        topLevel.add(output);
        expect(() => {director.connect(output, input)}).toThrowError("Self-loops are not allowed in top-level.");
        let rel = director.connect(input, output);
        expect(rel.name).toBe("topLevel.in->topLevel.out");
        expect(topLevel.findRelation(rel.name)).toBe(rel);
    });

    it('composite to self', () => {
        composite.add(input);
        composite.add(output);
        let rel = director.connect(output, input);
        expect(rel.name).toBe("composite.out->composite.in");
        expect(composite.findRelation(rel.name)).toBe(rel);
        rel = director.connect(input, output);
        expect(rel.name).toBe("composite.in->composite.out");
        expect(composite.findRelation(rel.name)).toBe(rel);
    });

    it('actor to self', () => {
        let component = new Actor("componentX");
        composite.add(component);
        component.add(input, output);
        let rel = director.connect(output, input);
        expect(rel.name).toBe("componentX.out->componentX.in");
        expect(composite.findRelation(rel.name)).toBe(rel);
        expect( () => {director.connect(input, output)}).toThrowError("Cannot connect input to output on the same actor.");
        expect( () => {director.connect(output, output)}).toThrowError("Cannot connect output to output on the same actor.");
        expect( () => {director.connect(input, input)}).toThrowError("Cannot connect input to input on the same actor.");
    });

    it('actor no parent', () => {
        let component = new Actor("component");
        component.add(input);
        component.add(output);
        expect(() => {director.connect(output, input)}).toThrowError("No composite available to store relation.");
    });


    // More to follow...
});
