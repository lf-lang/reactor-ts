'use strict';
import {TimeInterval, timeIntervalIsZero, TimeUnit, timeIntervalToNumeric, NumericTimeInterval, compareNumericTimeIntervals, TimeInstant, compareTimeInstants, microtimeToNumeric} from "./reactor";

/**
 * Test of helper functions for time in reactors
 */
describe('time representation', function () {

    const nullTI: TimeInterval = null;
    
    //Zero TimeIntervals
    const straightZero: TimeInterval = 0;
    const zeroSeconds: TimeInterval = [0, TimeUnit.sec];
    const zeroNS: TimeInterval = [0, TimeUnit.nsec];
    const zeroWeeks: TimeInterval = [0, TimeUnit.week];

    //Non zero TimeIntervals
    const fiveSeconds: TimeInterval = [5, TimeUnit.sec];
    const fiveSFiveUS: TimeInterval = [5000005, TimeUnit.usec];
    const fortyTwoDays: TimeInterval = [42, TimeUnit.days];
    const threeHundredUS: TimeInterval = [300, TimeUnit.usec];
    const sevenPointFiveBillNS: TimeInterval = [7500000000, TimeUnit.nsec];
    const twoHundredFiftyMillMS: TimeInterval = [250000000, TimeUnit.msec];
    const fiveHundredMilNS: TimeInterval = [500000000, TimeUnit.nsec];
    const oneThousandMS: TimeInterval = [1000, TimeUnit.msec];
    const aboutTenYears: TimeInterval = [365 * 10, TimeUnit.day]



    //NumericTimeIntervals
    const numFiveSeconds: NumericTimeInterval = timeIntervalToNumeric(fiveSeconds);
    const numFortyTwoDays: NumericTimeInterval = timeIntervalToNumeric(fortyTwoDays);
    const numFiveSFiveUS: NumericTimeInterval = timeIntervalToNumeric(fiveSFiveUS);
    const numThreeHundredUS: NumericTimeInterval = timeIntervalToNumeric(threeHundredUS);
    const numSevenPointFiveBillNS: NumericTimeInterval = timeIntervalToNumeric(sevenPointFiveBillNS);
    const numTwoHundredFiftyMillMS: NumericTimeInterval = timeIntervalToNumeric(twoHundredFiftyMillMS);
    const numFiveHundredMilNS: NumericTimeInterval = timeIntervalToNumeric(fiveHundredMilNS);
    const numOneThousandMS: NumericTimeInterval = timeIntervalToNumeric(oneThousandMS);
    const numAboutTenYears: NumericTimeInterval = timeIntervalToNumeric(aboutTenYears);

    const zeroNumeric: NumericTimeInterval = [0, 0];

    //TimeInstants
    const tiFiveSeconds0:TimeInstant = [numFiveSeconds , 0];
    const tiFiveSeconds1:TimeInstant = [numFiveSeconds , 1];

    const tiZero:TimeInstant = [zeroNumeric, 0];
    const tiZero1:TimeInstant = [zeroNumeric, 1];


    it('timeIntervalIsZero', function () {
        expect( timeIntervalIsZero(nullTI)).toBe(false);
        
        expect( timeIntervalIsZero(straightZero)).toBe(true);
        expect( timeIntervalIsZero(zeroSeconds)).toBe(true);
        expect( timeIntervalIsZero(zeroNS)).toBe(true);
        expect( timeIntervalIsZero(zeroWeeks)).toBe(true);

        expect( timeIntervalIsZero(fiveSeconds)).toBe(false);
        expect( timeIntervalIsZero(fortyTwoDays)).toBe(false);
        expect( timeIntervalIsZero(threeHundredUS)).toBe(false);
        expect( timeIntervalIsZero(sevenPointFiveBillNS)).toBe(false);
        expect( timeIntervalIsZero(twoHundredFiftyMillMS)).toBe(false);
        expect( timeIntervalIsZero(fiveHundredMilNS)).toBe(false);
        expect( timeIntervalIsZero(oneThousandMS)).toBe(false);

    });

    it('timeIntervalToNumeric', function () {

        //Null time intervals are an error.
        expect(() => {
            timeIntervalToNumeric(nullTI)
        }).toThrowError()

        //Non integer time intervals are an error.
        expect(() => {
            timeIntervalToNumeric([5.000000005, TimeUnit.sec])
        }).toThrowError()


        expect( timeIntervalToNumeric(straightZero)).toStrictEqual( zeroNumeric );
        expect( timeIntervalToNumeric(zeroSeconds)).toStrictEqual( zeroNumeric );
        expect( timeIntervalToNumeric(zeroNS)).toStrictEqual( zeroNumeric );
        expect( timeIntervalToNumeric(zeroWeeks)).toStrictEqual( zeroNumeric );

        expect( numFiveSeconds).toStrictEqual( [5,0] );
        expect(timeIntervalToNumeric(oneThousandMS)).toStrictEqual( [1, 0] );
        expect(timeIntervalToNumeric(threeHundredUS)).toStrictEqual( [0, 300000] );
        expect(numFiveSFiveUS).toStrictEqual( [5, 5000] );
        expect(numThreeHundredUS).toStrictEqual( [0, 300000] );
        expect(numSevenPointFiveBillNS).toStrictEqual( [7, 500000000] );
        expect(numTwoHundredFiftyMillMS).toStrictEqual( [250000, 0] );
        expect(numFiveHundredMilNS).toStrictEqual( [0, 500000000] );
        expect(numOneThousandMS).toStrictEqual( [1, 0] );
        expect(numAboutTenYears).toStrictEqual( [10 * 365 * 24 * 60 * 60 , 0] );
    });

    it('compareNumericTimeIntervals', function () {
        expect( compareNumericTimeIntervals(numFiveSeconds, numFiveSeconds) ).toBe(false);
        expect( compareNumericTimeIntervals(numFiveSeconds, numFortyTwoDays) ).toBe(true);
        expect( compareNumericTimeIntervals(numFortyTwoDays, numFiveSeconds) ).toBe(false);
        expect( compareNumericTimeIntervals(numFiveSFiveUS, numFiveSeconds) ).toBe(false);
        expect( compareNumericTimeIntervals(numFiveSeconds, numFiveSFiveUS,) ).toBe(true);
    });

    it('compareTimeInstants', function () {
        expect( compareTimeInstants(tiZero, tiZero) ).toBe(false);
        expect( compareTimeInstants(tiZero, tiZero1) ).toBe(true);
        expect( compareTimeInstants(tiZero1, tiZero) ).toBe(false);

        expect( compareTimeInstants(tiFiveSeconds0, tiFiveSeconds0) ).toBe(false);
        expect( compareTimeInstants(tiFiveSeconds0, tiFiveSeconds1) ).toBe(true);
        expect( compareTimeInstants(tiFiveSeconds1, tiFiveSeconds0) ).toBe(false);

        expect( compareTimeInstants(tiZero, tiFiveSeconds0) ).toBe(true);
        expect( compareTimeInstants(tiZero, tiFiveSeconds1) ).toBe(true);
        expect( compareTimeInstants(tiZero1, tiFiveSeconds0) ).toBe(true);
        expect( compareTimeInstants(tiZero1, tiFiveSeconds1) ).toBe(true);
        
        expect( compareTimeInstants(tiFiveSeconds0, tiZero) ).toBe(false);
        expect( compareTimeInstants(tiFiveSeconds1, tiZero) ).toBe(false);
        expect( compareTimeInstants(tiFiveSeconds0, tiZero1) ).toBe(false);
        expect( compareTimeInstants(tiFiveSeconds1, tiZero1) ).toBe(false);

    });

    it('microtimeToNumeric', function () {

        expect( microtimeToNumeric(0)).toStrictEqual(zeroNumeric);
        
        console.log(microtimeToNumeric(300));
        expect( microtimeToNumeric(300)).toStrictEqual(numThreeHundredUS);
        expect( microtimeToNumeric(5000000)).toStrictEqual(numFiveSeconds);
        expect( microtimeToNumeric(5000005)).toStrictEqual(numFiveSFiveUS);
        
    });

});

