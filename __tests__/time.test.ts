import {TimeValue, TimeUnit, Tag, UnitBasedTimeValue} from "../src/core/time";
import { createSecureServer } from "http2";

/**
 * Test of helper functions for time in reactors
 */
describe('time helper functions', function () {
    
    // Zero time intervals.
    const straightZero: TimeValue = new TimeValue(0);
    const zeroSeconds: TimeValue = new UnitBasedTimeValue(0, TimeUnit.sec);
    const zeroNS: TimeValue = new UnitBasedTimeValue(0, TimeUnit.nsec);
    const zeroWeeks: TimeValue = new UnitBasedTimeValue(0, TimeUnit.week);

    // Non-zero time intervals.
    const fiveSeconds: TimeValue = new UnitBasedTimeValue(5, TimeUnit.sec);
    const fiveSFiveUS: TimeValue = new UnitBasedTimeValue(5000005, TimeUnit.usec);
    const fortyTwoDays: TimeValue = new UnitBasedTimeValue(42, TimeUnit.days);
    const threeHundredUS: TimeValue = new UnitBasedTimeValue(300, TimeUnit.usec);
    const sevenPointFiveBillNS: TimeValue = new UnitBasedTimeValue(7500000000, TimeUnit.nsec);
    const twoHundredFiftyMillMS: TimeValue = new UnitBasedTimeValue(250000000, TimeUnit.msec);
    const fiveHundredMilNS: TimeValue = new UnitBasedTimeValue(500000000, TimeUnit.nsec);
    const oneThousandMS: TimeValue = new UnitBasedTimeValue(1000, TimeUnit.msec);
    const aboutTenYears: TimeValue = new UnitBasedTimeValue(365 * 10, TimeUnit.day);

    // Tags.
    const tiFiveSeconds0:Tag = new Tag(fiveSeconds, 0);
    const tiFiveSeconds1:Tag = new Tag(fiveSeconds, 1);

    const tiZero:Tag = new Tag(straightZero, 0);
    const tiZero1:Tag = new Tag(straightZero, 1);
    const tiOne1:Tag = new Tag(new TimeValue(1), 1);
    const tiOneNano1:Tag = new Tag(new TimeValue(0,1), 1);



    
    /**
     * Test if "borrowing a second" functionality works
     */
    it('borrow a second', function() {
        expect(new TimeValue(2, 200000).subtract(new TimeValue(1, 300000))).toEqual(new TimeValue(0, (200000 - 300000) + 1000000000));
        expect(new TimeValue(7, 3000).subtract(fiveSFiveUS)).toEqual(new TimeValue((7-5)-1, (3000 - 5000) + 1000000000));
        expect(new TimeValue(7, 6000).subtract(fiveSFiveUS)).toEqual(new TimeValue((7-5), (6000 - 5000)));
        console.log("Borrowed")
    });

    it('converting to string', function() {
        expect(straightZero.toString()).toEqual("(0 secs; 0 nsecs)");
        expect(new TimeValue(5, 5000).toString()).toEqual("(5 secs; 5000 nsecs)");
        expect(new TimeValue(250000, 0).toString()).toEqual("(250000 secs; 0 nsecs)");
    });

    
    /**
     * Test to see if the zero representations for time intervals 
     * are correctly identified by the timeIntervalIsZero function.
     */
    it('zero test', function () {
        
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
     * Test whether time intervals are equal.
     */
    it('time value equality', function () {

        // Creating time intervals with a non-integer 
        // time value results in an error.
        expect(() => {
            new UnitBasedTimeValue(0.1, TimeUnit.sec);
        }).toThrowError()

        expect(zeroSeconds.isEqualTo(straightZero)).toBeTruthy();
        expect(zeroSeconds.isEqualTo(zeroNS)).toBeTruthy();
        expect(zeroSeconds.isEqualTo(zeroWeeks)).toBeTruthy();

        expect(oneThousandMS.isEqualTo(new TimeValue(1, 0)));
        expect(threeHundredUS.isEqualTo(new TimeValue(1, 300000)));
        expect(fiveSFiveUS.isEqualTo(new TimeValue(5, 5000)));
        expect(threeHundredUS.isEqualTo(new TimeValue(0, 300000)));
        expect(sevenPointFiveBillNS.isEqualTo(new TimeValue(7, 500000000)));
        expect(twoHundredFiftyMillMS.isEqualTo(new TimeValue(250000, 0)));
        expect(fiveHundredMilNS.isEqualTo(new TimeValue(0, 500000000)));
        expect(oneThousandMS.isEqualTo(new TimeValue(1, 0)));
        expect(aboutTenYears.isEqualTo(new TimeValue(10 * 365 * 24 * 60 * 60 , 0)));

        expect(fiveSeconds.isEqualTo(fiveSeconds)).toBeTruthy();
        expect(fiveSeconds.isEqualTo(fortyTwoDays)).toBeFalsy();
        expect(fortyTwoDays.isEqualTo(fiveSeconds)).toBeFalsy();
        expect(fiveSFiveUS.isEqualTo(fiveSeconds)).toBeFalsy();
        expect(fiveSeconds.isEqualTo(fiveSFiveUS)).toBeFalsy();

        // This test should generate an error because we're trying to convert
        // a number which can't be represented as a numeric time interval.
        expect(() => {
            new UnitBasedTimeValue(Number.MAX_SAFE_INTEGER, TimeUnit.weeks);
        }).toThrowError();

    });
    
    /**
     * Report whether one tag is earlier than another one.
     * Microstep indices are taken into consideration.
     */
    it('compare tags', function () {
        expect(tiZero.isSmallerThan(tiZero)).toBeFalsy();
        expect(tiZero.isSmallerThan(tiZero1)).toBeTruthy();
        expect(tiZero1.isSmallerThan(tiZero)).toBeFalsy();

        expect(tiFiveSeconds0.isSmallerThan(tiFiveSeconds0)).toBeFalsy();
        expect(tiFiveSeconds0.isSmallerThan(tiFiveSeconds1)).toBeTruthy();
        expect(tiFiveSeconds1.isSmallerThan(tiFiveSeconds0)).toBeFalsy();

        expect(tiZero.isSmallerThan(tiFiveSeconds0)).toBeTruthy();
        expect(tiZero.isSmallerThan(tiFiveSeconds1)).toBeTruthy();
        expect(tiZero1.isSmallerThan(tiFiveSeconds0)).toBeTruthy();
        expect(tiZero1.isSmallerThan(tiFiveSeconds1)).toBeTruthy();
        
        expect(tiFiveSeconds0.isSmallerThan(tiZero)).toBeFalsy();
        expect(tiFiveSeconds1.isSmallerThan(tiZero)).toBeFalsy();
        expect(tiFiveSeconds0.isSmallerThan(tiZero1)).toBeFalsy();
        expect(tiFiveSeconds1.isSmallerThan(tiZero1)).toBeFalsy();

    });

    /**
     * Test simultaneity of tags.
     */
    it('tag equality', function() {
        expect(tiZero.isSimultaneousWith(tiZero1)).toBeFalsy();
        expect(tiZero1.isSimultaneousWith(tiZero1)).toBeTruthy();
        expect(tiOne1.isSimultaneousWith(tiZero1)).toBeFalsy();
        expect(tiOneNano1.isSimultaneousWith(tiOneNano1)).toBeTruthy();
    });

    /**
     * Add a time interval to a tag and obtain a new time instant.
     */
    it('get a later tag' , function () {
        expect(new Tag(fiveHundredMilNS, 0).getLaterTag(fortyTwoDays).isSimultaneousWith(new Tag(new TimeValue(42 * 24 * 60 * 60, 500000000), 0))).toBeTruthy();
        expect(new Tag(fiveHundredMilNS, 0).getLaterTag(fiveHundredMilNS).isSimultaneousWith(new Tag(new TimeValue(1, 0), 0))).toBeTruthy();
        expect(new Tag(oneThousandMS, 0).getLaterTag(straightZero).isSimultaneousWith(new Tag(oneThousandMS, 0))).toBeTruthy();
        expect(new Tag(oneThousandMS, 1).getLaterTag(straightZero).isSimultaneousWith(new Tag(oneThousandMS, 1))).toBeTruthy();
    });

    /**
     * Get a time interval in a format that is understood by nanotimer.
     */
    it('support for nanotimer (obsolete)', function() {
        expect(new TimeValue(0 , 225).getNanoTime()).toEqual("225n");
        expect(fiveSeconds.getNanoTime()).toEqual("5s");
        expect(straightZero.getNanoTime()).toEqual("0s");
        expect(fiveSFiveUS.getNanoTime()).toEqual("5000005u");
        expect(new TimeValue(5, 5000000).getNanoTime()).toEqual("5005m");
        expect(new TimeValue(5, 5).getNanoTime()).toEqual("5000000005n");
        expect(fortyTwoDays.getNanoTime()).toEqual("3628800s");
        expect(threeHundredUS.getNanoTime()).toEqual("300u");
        expect(sevenPointFiveBillNS.getNanoTime()).toEqual("7500m");
        expect(twoHundredFiftyMillMS.getNanoTime()).toEqual("250000s");
        expect(fiveHundredMilNS.getNanoTime()).toEqual("500m");
        expect(oneThousandMS.getNanoTime()).toEqual("1s");
        expect(aboutTenYears.getNanoTime()).toEqual("315360000s");
    })

    /**
     * Obtain the difference between two time values.
     * Microstep indices are ignored in this operation 
     * (time values don't have a microstep).
     */
    it('compare tags', function() {
        expect(tiFiveSeconds0.getTimeDifference(tiFiveSeconds0)).toEqual(new TimeValue(0));
        expect(tiFiveSeconds0.getTimeDifference(tiFiveSeconds1)).toEqual(new TimeValue(0));
        expect(tiFiveSeconds0.getTimeDifference(tiOne1)).toEqual(new TimeValue(4));
        expect(tiOne1.getTimeDifference(tiFiveSeconds0)).toEqual(new TimeValue(4));
    });

    /**
     * Compare two time values and find out which one is earlier.
     */
    it('compare time values', function() {
        expect(new TimeValue(0, 999999998).isEarlierThan(new TimeValue(0, 999999999))).toEqual(true)
    });


    /**
     * See if expected errors happen.
     */
    it('errors', function() {
        expect(() => {
            expect(new TimeValue(4.3, 2.1));
        }).toThrowError()
    
        expect(() => {
            expect(new UnitBasedTimeValue(-1, TimeUnit.week));
        }).toThrowError()
    
        expect(() => {
            expect(new TimeValue(2,1).subtract(new TimeValue(4, 3)));
        }).toThrowError()
    });

});