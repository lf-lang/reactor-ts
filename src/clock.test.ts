'use strict';

import {Clock} from './clock';
import {Reactor} from './reactor';
import * as globals from './globals';

describe('clock', function () {
    var clock = new Clock();

    it('Timer create test', function () {
        
        expect(expect(clock).toBeInstanceOf(Clock));

        console.log(clock);
        console.log(clock._reactions[0]);

        //Unecessary now the adder defines its own reactions.
        //var addRe = new AddTwo();
        //console.log(addRe);

        
        // adder.provideInput("in2", 2);
        // adder.provideInput("in1", 1);
        //adder.in1.writeValue(this, 2);
        //adder.in2.writeValue(this, 1)

        // FIXME: change this to writeValue, and have writeValue take care of invocation.

        //var output_before_fire = adder.out.;
        // expect(output_before_fire).toBe(undefined);

        //expect().toBeUndefined();
        console.log(JSON.stringify(globals.reactionQ));
        console.log(globals.triggerMap);
        
        //expect(adder.out.get()).toBe(3);

        //expect(adder._triggerMap()).toBe("bla");
    });

    it('start runtime', function(){
        globals.startRuntime();
    })
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

