'use strict';
import {TimeInterval, timeIntervalIsZero, TimeUnit} from "./reactor";

describe('time representation', function () {

    const nullTI: TimeInterval = null;
    const straightZero: TimeInterval = 0;
    const zeroSeconds: TimeInterval = [0, TimeUnit.sec];
    const zeroNS: TimeInterval = [0, TimeUnit.nsec];
    const zeroWeeks: TimeInterval = [0, TimeUnit.week];


    it('timeIntervalIsZero', function () {
        expect( timeIntervalIsZero(nullTI)).toBe(false);
        expect( timeIntervalIsZero(straightZero)).toBe(true);
        expect( timeIntervalIsZero(zeroSeconds)).toBe(true);
        expect( timeIntervalIsZero(zeroNS)).toBe(true);
        expect( timeIntervalIsZero(zeroWeeks)).toBe(true);

    });

    //FIXME: Add a test for converting to numeric

});

