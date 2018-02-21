//@flow
import {Actor, InputPort, OutputPort, Component, Composite, Parameter} from "./hierarchy";
import {DiscreteEvents} from "./discrete-events";

describe('ports', () => {
    let actor = new Actor("component");
    
    it('basic add and get', () => {
        actor.add(new InputPort("in"));
        actor.add(new OutputPort("out"));
        actor.add(new Parameter("parm"));

        var port = actor.lookup("in");
        expect(port != null).toBeTruthy();
        expect(port instanceof InputPort).toBeTruthy();

        var port = actor.lookup("out");
        expect(port != null).toBeTruthy();
        expect(port instanceof OutputPort).toBeTruthy();

        var port = actor.lookup("parm");
        expect(port != null).toBeTruthy();
        expect(port instanceof Parameter).toBeTruthy();

    });

    it('no random port', () => {
        var port = actor.lookup("random");
        expect(port).toBe(undefined);
    });
    
});

describe('composite', () => {
    // Ideally we should use a dummy director. For now, DE works.
    let topLevel = new Composite("topLevel");
    let composite = new Composite("composite");
    let component = new Component("component");

    it('compose hierarchy', () => {
        topLevel.add(composite);
        composite.add(component);
        expect(composite.parent).toBe(topLevel);
        expect(component.parent).toBe(composite);
    });

    // it('qualified names in hierarchy chain', () => {
    //     expect(component.getFullyQualifiedName()).toBe("topLevel.component");
    // });

    // it('add/remove component', () => {
    //     let component = new Component("new-component");
    //     topLevel.add(component);
    //     expect(component.getFullyQualifiedName()).toBe("topLevel.new-component");

    //     let topLevel2 = new Composite("topLevel2", null, de);
    //     topLevel2.add(component);
    //     expect(component.getFullyQualifiedName()).toBe("topLevel2.new-component");
    // });
});
