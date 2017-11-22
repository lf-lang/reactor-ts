import { Adder } from "./adder";

describe('adder', () => {
    it('should at least compile', () => {
        let adder = new Adder("My Adder");
        adder.setup();
        adder.initialize();
    });
});
