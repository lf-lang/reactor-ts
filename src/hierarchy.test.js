import { Port, Component, PortSet, Composite } from "./hierarchy";
import { DiscreteEvents } from "./discrete-events";

describe('portset', () => {
    let component = new Component("component");
    let ports = new PortSet(component);

    it('basic add and get', () => {
        ports.add(new Port("in", "input"));
        ports.add(new Port("out", "output"));

        var port = ports.get("in");
        expect(port != null).toBeTruthy();
        expect(port.getPortType()).toBe("input");

        var port = ports.get("out");
        expect(port != null).toBeTruthy();
        expect(port.getPortType()).toBe("output");
    });

    it('no random port', () => {
        var port = ports.get("random");
        expect(port).toBe(undefined);
    });
});

describe('component and composite', () => {
    // Ideally we should use a dummy director. For now, DE works.
    let de = new DiscreteEvents();
    let root = new Composite("root", null, de);
    let composite = new Composite("composite", root);
    let component = new Component("component", root);

    it('descendant chain', () => {
        expect(composite.getParent()).toBe(root);
        expect(component.getParent()).toBe(root);
    });

    it('qualified names in hierarchy chain', () => {
        expect(component.getFullyQualifiedName()).toBe("root.component");
    });

    it('add/remove component', () => {
        let component = new Component("new-component");
        root.add(component);
        expect(component.getFullyQualifiedName()).toBe("root.new-component");

        let root2 = new Composite("root2", null, de);
        root2.add(component);
        expect(component.getFullyQualifiedName()).toBe("root2.new-component");
    });
});

describe('actor composite', () => {
    // Ideally we should use a dummy director. For now, DE works.
    let de = new DiscreteEvents();
    let root = new Composite("root", null, de);
    let composite = new Composite("composite", root);
    let component = new Component("component", root);

    it('descendant chain', () => {
        expect(composite.getParent()).toBe(root);
        expect(component.getParent()).toBe(root);
    });

    it('qualified names in hierarchy chain', () => {
        expect(component.getFullyQualifiedName()).toBe("root.component");
    });

    it('add/remove component', () => {
        let component = new Component("new-component");
        root.add(component);
        expect(component.getFullyQualifiedName()).toBe("root.new-component");

        let root2 = new Composite("root2", null, de);
        root2.add(component);
        expect(component.getFullyQualifiedName()).toBe("root2.new-component");
    });
});
