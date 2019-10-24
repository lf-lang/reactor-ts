'use strict';

import {Clock} from './clock';
import {Reactor} from './reactor';
import * as globals from './globals';

describe('clock', function () {
    var clock = new Clock();

    it('Timer create test', function () {
        
        expect(expect(clock).toBeInstanceOf(Clock));

        console.log(clock);

        //expect().toBeUndefined();
        console.log(JSON.stringify(globals.reactionQ));
        console.log(globals.triggerMap);

    });

    it('start runtime', done => {

        function fail(){
            throw new Error("Runtime has failed.");
        };

        globals.startRuntime(done, fail);

    })
});

