'use strict';

import {Clock} from './clock';
import {TimeUnit, Reactor} from './reactor';
// import * as globals from './globals';

describe('clock', function () {
    //Tell the reactor runtime to successfully terminate after 6 seconds.
    // globals.setExecutionTimeout([6, TimeUnit.secs]);
    //Ensure the test will run for 7 seconds.
    jest.setTimeout(7000);

    // it('Timer create test', function () {
    //     var clock = new Clock(  () => null, () => null, null, "Clock" );
    //     console.log("created clock");
        
    //     expect(expect(clock).toBeInstanceOf(Clock));

    //     // console.log(clock);

    //     //expect().toBeUndefined();
    //     //console.log(JSON.stringify(globals.reactionQ));
    //     //console.log(globals.triggerMap);

    // });

    it('start runtime', done => {


        function fail(){
            throw new Error("Runtime has failed.");
        };
        var clock = new Clock([6, TimeUnit.secs], done, fail, "Clock");
        // console.log(clock);
        clock.start(() => null, fail);

        //Don't give the runtime the done callback because we don't care if it terminates
        // globals.startRuntime(() => null, fail);

    })
});

