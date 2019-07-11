'use strict';

import {Adder} from './adder';
import {InPort} from './reactor';

var adder = new Adder();
        
describe('adder', function () {
    it('2 + 1 = 3', function () {
        
        // adder.provideInput("in2", 2);
        // adder.provideInput("in1", 1);
        adder.in1._value = 2;
        adder.in2._value = 1;

        //var output_before_fire = adder.out.;
        // expect(output_before_fire).toBe(undefined);

        adder._reactions[0][1].react(adder.in1, adder.in2, adder.out);

        expect(adder.out.get()).toBe(3);
    });
    // it('find ports in scope', () => {
    //     // var ports = new Set(adder._reactions[0][1].io);
    //     // var intersection = new Set([...ports].filter(x => adder._getInputs().has(x)))
    //     // expect(intersection).toBe("Hello World/MyActor");

    //     adder._reactions[0][1].state = {extra: new Set([new InPort(adder)])}; // FIXME: this is only necessary for reactions that *have* state
    //     var outputs = new Set();
    //     adder._reactions[0][1].portsInScope()[0].forEach(x => outputs.add(x.toString()));
        
    //     expect(outputs).toEqual(new Set(["Adder/in1", "Adder/in2", "Adder/anonymous"]));
    // });
});

