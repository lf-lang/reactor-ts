'use strict';

import {Clock} from '../components/Clock';
import {TimeUnit} from '../time';

describe('clock', function () {
     //Ensure the test will run for no more than 7 seconds.
    jest.setTimeout(7000);

    it('start runtime', done => {

        function fail(){
            throw new Error("Runtime has failed.");
        };

        //Tell the reactor runtime to successfully terminate after 6 seconds.
        var clock = new Clock([6, TimeUnit.secs], done, fail, "Clock");

        //Don't give the runtime the done callback because we don't care if it terminates
        clock._start(() => null, fail);
    })
});

