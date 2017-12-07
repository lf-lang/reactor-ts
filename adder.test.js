import { Adder } from "./adder";

describe('adder', () => {
    it('should at least compile', () => {
        let adder = new Adder("My Adder");
        adder.setup();
        adder.initialize();
        adder.provideInput("in2", 2);
        adder.provideInput("in1", 1);
        adder.fire();
        let output = adder.get("output");
        expect(output).toBe(3);
    });
});
