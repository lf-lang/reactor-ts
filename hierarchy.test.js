import { Port, Component, PortSet } from "./hierarchy";

describe('portset', () => {
    it('basic add and get', () => {
        let root = new Component("root");
        let ports = new PortSet(root);
        ports.add(new Port("in", "input"));
        ports.add(new Port("out", "output"));

        var port = ports.get("in");
        expect(port != null).toBeTruthy();
        expect(port.getPortType()).toBe("input");

        var port = ports.get("out");
        expect(port != null).toBeTruthy();
        expect(port.getPortType()).toBe("output");
    });
});
