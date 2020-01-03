'use strict';
import {TimeInterval, TimeUnit, TimeInstant, UnitBasedTimeInterval} from "../src/time";

/**
 * Test of helper functions for time in reactors
 */
describe('time representation', function () {
    
    //Zero TimeIntervals
    const straightZero: TimeInterval = new TimeInterval(0);
    const zeroSeconds: TimeInterval = new UnitBasedTimeInterval(0, TimeUnit.sec);
    const zeroNS: TimeInterval = new UnitBasedTimeInterval(0, TimeUnit.nsec);
    const zeroWeeks: TimeInterval = new UnitBasedTimeInterval(0, TimeUnit.week);

    //Non zero TimeIntervals
    const fiveSeconds: TimeInterval = new UnitBasedTimeInterval(5, TimeUnit.sec);
    const fiveSFiveUS: TimeInterval = new UnitBasedTimeInterval(5000005, TimeUnit.usec);
    const fortyTwoDays: TimeInterval = new UnitBasedTimeInterval(42, TimeUnit.days);
    const threeHundredUS: TimeInterval = new UnitBasedTimeInterval(300, TimeUnit.usec);
    const sevenPointFiveBillNS: TimeInterval = new UnitBasedTimeInterval(7500000000, TimeUnit.nsec);
    const twoHundredFiftyMillMS: TimeInterval = new UnitBasedTimeInterval(250000000, TimeUnit.msec);
    const fiveHundredMilNS: TimeInterval = new UnitBasedTimeInterval(500000000, TimeUnit.nsec);
    const oneThousandMS: TimeInterval = new UnitBasedTimeInterval(1000, TimeUnit.msec);
    const aboutTenYears: TimeInterval = new UnitBasedTimeInterval(365 * 10, TimeUnit.day);

    //TimeInstants
    const tiFiveSeconds0:TimeInstant = new TimeInstant(fiveSeconds, 0);
    const tiFiveSeconds1:TimeInstant = new TimeInstant(fiveSeconds, 1);

    const tiZero:TimeInstant = new TimeInstant(straightZero, 0);
    const tiZero1:TimeInstant = new TimeInstant(straightZero, 1);
    const tiOne1:TimeInstant = new TimeInstant(new TimeInterval(1), 1);
    const tiOneNano1:TimeInstant = new TimeInstant(new TimeInterval(0,1), 1);
    /**
     * Test to see if the zero representations for time intervals 
     * are correctly identified by the timeIntervalIsZero function.
     */
    it('timeIntervalIsZero', function () {
        
        expect( straightZero.isZero()).toBe(true);
        expect( zeroSeconds.isZero()).toBe(true);
        expect( zeroNS.isZero()).toBe(true);
        expect( zeroWeeks.isZero()).toBe(true);

        expect( fiveSeconds.isZero()).toBe(false);
        expect( fortyTwoDays.isZero()).toBe(false);
        expect( threeHundredUS.isZero()).toBe(false);
        expect( sevenPointFiveBillNS.isZero()).toBe(false);
        expect( twoHundredFiftyMillMS.isZero()).toBe(false);
        expect( fiveHundredMilNS.isZero()).toBe(false);
        expect( oneThousandMS.isZero()).toBe(false);

    });


    /**
     * Test of timeIntervalToNumeric function.
     * It should convert time intervals with the Lingua Franca [ number, Timeunit ]
     * into the numeric [seconds, nanoseconds] representation.
     */
    it('timeIntervalToNumeric', function () {

        //Non integer time intervals are an error.
        expect(() => {
            new UnitBasedTimeInterval(5.000000005, TimeUnit.sec);
        }).toThrowError()

        //Negative time intervals are an error.
        expect(() => {
            new UnitBasedTimeInterval(5.000000005-5, TimeUnit.sec);
        }).toThrowError()


        expect(zeroSeconds.isEqualTo(straightZero)).toBeTruthy();
        expect(zeroSeconds.isEqualTo(zeroNS)).toBeTruthy();
        expect(zeroSeconds.isEqualTo(zeroWeeks)).toBeTruthy();

        expect(oneThousandMS.isEqualTo(new TimeInterval(1, 0)));
        expect(threeHundredUS.isEqualTo(new TimeInterval(1, 300000)));
        expect(fiveSFiveUS.isEqualTo(new TimeInterval(5, 5000)));
        expect(threeHundredUS.isEqualTo(new TimeInterval(0, 300000)));
        expect(sevenPointFiveBillNS.isEqualTo(new TimeInterval(7, 500000000)));
        expect(twoHundredFiftyMillMS.isEqualTo(new TimeInterval(250000, 0)));
        expect(fiveHundredMilNS.isEqualTo(new TimeInterval(0, 500000000)));
        expect(oneThousandMS.isEqualTo(new TimeInterval(1, 0)));
        expect(aboutTenYears.isEqualTo(new TimeInterval(10 * 365 * 24 * 60 * 60 , 0)));

        // This test should generate an error because we're trying to convert
        // a number which can't be represented as a numeric time interval.
        expect(() => {
            new UnitBasedTimeInterval(Number.MAX_SAFE_INTEGER, TimeUnit.weeks);
        }).toThrowError();

    });

    /**
     * Test of compareNumericTimeIntervals.
     * It should implement deep comparison t0 < t1. 
     */
    it('Compare time intervals', function () {
        expect(fiveSeconds.isEqualTo(fiveSeconds)).toBeTruthy();
        expect(fiveSeconds.isEqualTo(fortyTwoDays)).toBeFalsy();
        expect(fortyTwoDays.isEqualTo(fiveSeconds)).toBeFalsy();
        expect(fiveSFiveUS.isEqualTo(fiveSeconds)).toBeFalsy();
        expect(fiveSeconds.isEqualTo(fiveSFiveUS)).toBeFalsy();
    });

    /**
     * Test of compareTimeInstants.
     * It should implement deep comparison t0 < t1.
     * A time instant has [ numericTimeInterval , microstep ]
     */
    it('compareTimeInstants', function () {
        expect(tiZero.isEarlierThan(tiZero)).toBeFalsy();
        expect(tiZero.isEarlierThan(tiZero1)).toBeTruthy();
        expect(tiZero1.isEarlierThan(tiZero)).toBeFalsy();

        expect(tiFiveSeconds0.isEarlierThan(tiFiveSeconds0)).toBeFalsy();
        expect(tiFiveSeconds0.isEarlierThan(tiFiveSeconds1)).toBeTruthy();
        expect(tiFiveSeconds1.isEarlierThan(tiFiveSeconds0)).toBeFalsy();

        expect(tiZero.isEarlierThan(tiFiveSeconds0)).toBeTruthy();
        expect(tiZero.isEarlierThan(tiFiveSeconds1)).toBeTruthy();
        expect(tiZero1.isEarlierThan(tiFiveSeconds0)).toBeTruthy();
        expect(tiZero1.isEarlierThan(tiFiveSeconds1)).toBeTruthy();
        
        expect(tiFiveSeconds0.isEarlierThan(tiZero)).toBeFalsy();
        expect(tiFiveSeconds1.isEarlierThan(tiZero)).toBeFalsy();
        expect(tiFiveSeconds0.isEarlierThan(tiZero1)).toBeFalsy();
        expect(tiFiveSeconds1.isEarlierThan(tiZero1)).toBeFalsy();

    });

    /**
     * Test of deep equality for time instants.
     */
    it('timeInstantsAreEqual', function(){
        expect(tiZero.isSimultaneousWith(tiZero1)).toBeFalsy();
        expect(tiZero1.isSimultaneousWith(tiZero1)).toBeTruthy();
        expect(tiOne1.isSimultaneousWith(tiZero1)).toBeFalsy();
        expect(tiOneNano1.isSimultaneousWith(tiOneNano1)).toBeTruthy();
    });

    it('getLaterTime' , function () {
        expect(new TimeInstant(fiveHundredMilNS, 0).getLaterTime(fortyTwoDays).isSimultaneousWith(new TimeInstant(new TimeInterval(42 * 24 * 60 * 60, 500000000), 0))).toBeTruthy();
        expect(new TimeInstant(fiveHundredMilNS, 0).getLaterTime(fiveHundredMilNS).isSimultaneousWith(new TimeInstant(new TimeInterval(1, 0), 0))).toBeTruthy();
        expect(new TimeInstant(oneThousandMS, 0).getLaterTime(straightZero).isSimultaneousWith(new TimeInstant(oneThousandMS, 0))).toBeTruthy();
    });

    it('getNanoTime', function() {
        expect(fiveSeconds.getNanoTime()).toEqual("5s");
        expect(straightZero.getNanoTime()).toEqual("0s");
        expect(fiveSFiveUS.getNanoTime()).toEqual("5000005u");
        expect(new TimeInterval(5, 5000000).getNanoTime()).toEqual("5005m");
        expect(new TimeInterval(5, 5).getNanoTime()).toEqual("5000000005n");
        expect(fortyTwoDays.getNanoTime()).toEqual("3628800s");
        expect(threeHundredUS.getNanoTime()).toEqual("300u");
        expect(sevenPointFiveBillNS.getNanoTime()).toEqual("7500m");
        expect(twoHundredFiftyMillMS.getNanoTime()).toEqual("250000s");
        expect(fiveHundredMilNS.getNanoTime()).toEqual("500m");
        expect(oneThousandMS.getNanoTime()).toEqual("1s");
        expect(aboutTenYears.getNanoTime()).toEqual("315360000s");
    })

    it('getTimeDifference', function() {
        expect(tiFiveSeconds0.getTimeDifference(tiFiveSeconds0)).toEqual(new TimeInterval(0));
        expect(tiFiveSeconds0.getTimeDifference(tiFiveSeconds1)).toEqual(new TimeInterval(0));
        expect(tiFiveSeconds0.getTimeDifference(tiOne1)).toEqual(new TimeInterval(4));
        expect(tiOne1.getTimeDifference(tiFiveSeconds0)).toEqual(new TimeInterval(4));
    });

    it('errors', function() {
        expect(() => {
            expect(new TimeInterval(4.3, 2.1));
        }).toThrowError()
    
        expect(() => {
            expect(new UnitBasedTimeInterval(-1, TimeUnit.week));
        }).toThrowError()
    
        expect(() => {
            expect(new TimeInterval(2,1).subtract(new TimeInterval(4, 3)));
        }).toThrowError()
    });

});