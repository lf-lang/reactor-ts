'use strict';

import {Clock} from './clock';
import {TimeUnit, Reactor} from './reactor';
import * as globals from './globals';

describe('clock', function () {
    var clock = new Clock();
    //Tell the reactor runtime to successfully terminate after 6 seconds.
    globals.setExecutionTimeout([6, TimeUnit.secs]);
    //Ensure the test will run for 7 seconds.
    jest.setTimeout(7000);

    it('Timer create test', function () {
        
        expect(expect(clock).toBeInstanceOf(Clock));

        console.log(clock);

        //expect().toBeUndefined();
        //console.log(JSON.stringify(globals.reactionQ));
        //console.log(globals.triggerMap);

    });

    it('start runtime', done => {

        function fail(){
            throw new Error("Runtime has failed.");
        };

        globals.startRuntime(done, fail);

    })
});

