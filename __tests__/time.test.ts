import {TimeValue, TimeUnit, Tag} from "../src/core/time";

/**
 * Test of helper functions for time in reactors
 */
describe('time helper functions', function () {
    
    // Zero time intervals.
    const straightZero: TimeValue = TimeValue.secs(0);
    const zeroSeconds: TimeValue = TimeValue.withUnits(0, TimeUnit.sec);
    const zeroNS: TimeValue = TimeValue.withUnits(0, TimeUnit.nsec);
    const zeroWeeks: TimeValue = TimeValue.withUnits(0, TimeUnit.week);
    const zeroMsecs: TimeValue = TimeValue.msecs(0);
    const zeroUsec: TimeValue = TimeValue.usec(0);
    

    // Non-zero time intervals.
    const fiveSeconds: TimeValue = TimeValue.withUnits(5, TimeUnit.sec);
    const fiveSFiveUS: TimeValue = TimeValue.withUnits(5000005, TimeUnit.usec);
    const fortyTwoDays: TimeValue = TimeValue.withUnits(42, TimeUnit.days);
    const threeHundredUS: TimeValue = TimeValue.withUnits(300, TimeUnit.usec);
    const sevenPointFiveBillNS: TimeValue = TimeValue.withUnits(7500000000, TimeUnit.nsec);
    const twoHundredFiftyMillMS: TimeValue = TimeValue.withUnits(250000000, TimeUnit.msec);
    const fiveHundredMilNS: TimeValue = TimeValue.withUnits(500000000, TimeUnit.nsec);
    const oneThousandMS: TimeValue = TimeValue.withUnits(1000, TimeUnit.msec);
    const aboutTenYears: TimeValue = TimeValue.withUnits(365 * 10, TimeUnit.day);
    
    const fiveSec: TimeValue = TimeValue.sec(5);
    const fiveSecs: TimeValue = TimeValue.secs(5);
    const fiveThousandMsec: TimeValue = TimeValue.msec(5000);
    const fiveThousandMsecs: TimeValue = TimeValue.msecs(5000);
    const fiveMillUsec: TimeValue = TimeValue.usec(5000000);
    const fiveMillUsecs: TimeValue = TimeValue.usecs(5000000);
    const fiveBillNsec: TimeValue = TimeValue.nsec(5000000000);
    const fiveBillNsecs: TimeValue = TimeValue.nsecs(5000000000);
    const threeHundredThousandNsec: TimeValue = TimeValue.nsec(300000);
    const sevenPointFiveMillUsecs: TimeValue = TimeValue.usecs(7500000);
    const fortyTwoDaysAsMsec: TimeValue = TimeValue.msec(42 * 24 * 60 * 60 * 1000);
    





    // Tags.
    const tiFiveSeconds0:Tag = new Tag(fiveSeconds, 0);
    const tiFiveSeconds1:Tag = new Tag(fiveSeconds, 1);

    const tiZero:Tag = new Tag(straightZero, 0);
    const tiZero1:Tag = new Tag(straightZero, 1);
    const tiOne1:Tag = new Tag(TimeValue.secs(1), 1);
    const tiOneNano1:Tag = new Tag(TimeValue.secsAndNs(0,1), 1);



    
    /**
     * Test if "borrowing a second" functionality works
     */
    it('borrow a second', function() {
        expect(TimeValue.secsAndNs(2, 200000).subtract(TimeValue.secsAndNs(1, 300000))).toEqual(TimeValue.secsAndNs(0, (200000 - 300000) + 1000000000));
        expect(TimeValue.secsAndNs(7, 3000).subtract(fiveSFiveUS)).toEqual(TimeValue.secsAndNs((7-5)-1, (3000 - 5000) + 1000000000));
        expect(TimeValue.secsAndNs(7, 6000).subtract(fiveSFiveUS)).toEqual(TimeValue.secsAndNs((7-5), (6000 - 5000)));
        console.log("Borrowed")
    });

    /**
     * Test if "multiply" functionality works
     */
     it('multiply time value', function() {
        expect(TimeValue.secs(1).multiply(2)).toEqual(TimeValue.secs(2));
        expect(TimeValue.secsAndNs(1, 500000000).multiply(2)).toEqual(TimeValue.secs(3));
    });

    /**
     * Test conversion to string
     */
    it('converting to string', function() {
        expect(straightZero.toString()).toEqual("(0 secs; 0 nsecs)");
        expect(TimeValue.secsAndNs(5, 5000).toString()).toEqual("(5 secs; 5000 nsecs)");
        expect(TimeValue.secsAndNs(250000, 0).toString()).toEqual("(250000 secs; 0 nsecs)");
        expect(fiveSFiveUS.toString()).toEqual("(5 secs; 5000 nsecs)");
        expect(tiFiveSeconds0.toString()).toEqual("((5 secs; 0 nsecs), 0)")
        expect(tiFiveSeconds1.toString()).toEqual("((5 secs; 0 nsecs), 1)")
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
            TimeValue.withUnits(0.1, TimeUnit.sec);
        }).toThrowError()

        expect(zeroSeconds.isEqualTo(straightZero)).toBeTruthy();
        expect(zeroSeconds.isEqualTo(zeroNS)).toBeTruthy();
        expect(zeroSeconds.isEqualTo(zeroWeeks)).toBeTruthy();
        expect(zeroMsecs.isEqualTo(zeroWeeks)).toBeTruthy();
        expect(zeroUsec.isEqualTo(zeroSeconds)).toBeTruthy();

        expect(oneThousandMS.isEqualTo(TimeValue.secs(1)));
        expect(threeHundredUS.isEqualTo(TimeValue.secsAndNs(1, 300000)));
        expect(fiveSFiveUS.isEqualTo(TimeValue.secsAndNs(5, 5000)));
        expect(threeHundredUS.isEqualTo(TimeValue.secsAndNs(0, 300000)));
        expect(sevenPointFiveBillNS.isEqualTo(TimeValue.secsAndNs(7, 500000000)));
        expect(twoHundredFiftyMillMS.isEqualTo(TimeValue.secsAndNs(250000, 0)));
        expect(fiveHundredMilNS.isEqualTo(TimeValue.secsAndNs(0, 500000000)));
        expect(oneThousandMS.isEqualTo(TimeValue.secsAndNs(1, 0)));
        expect(aboutTenYears.isEqualTo(TimeValue.secsAndNs(10 * 365 * 24 * 60 * 60 , 0)));

        expect(fiveSeconds.isEqualTo(fiveSeconds)).toBeTruthy();
        expect(fiveSeconds.isEqualTo(fortyTwoDays)).toBeFalsy();
        expect(fortyTwoDays.isEqualTo(fiveSeconds)).toBeFalsy();
        expect(fiveSFiveUS.isEqualTo(fiveSeconds)).toBeFalsy();
        expect(fiveSeconds.isEqualTo(fiveSFiveUS)).toBeFalsy();
        expect(fiveSeconds.isEqualTo(fiveSec)).toBeTruthy();
        expect(fiveSeconds.isEqualTo(fiveSecs)).toBeTruthy();
        expect(fiveSeconds.isEqualTo(fiveThousandMsec)).toBeTruthy();
        expect(fiveSeconds.isEqualTo(fiveThousandMsecs)).toBeTruthy();
        expect(fiveSeconds.isEqualTo(fiveMillUsec)).toBeTruthy();
        expect(fiveSeconds.isEqualTo(fiveMillUsecs)).toBeTruthy();
        expect(fiveSeconds.isEqualTo(fiveBillNsec)).toBeTruthy();
        expect(fiveSeconds.isEqualTo(fiveBillNsecs)).toBeTruthy();
        expect(threeHundredUS.isEqualTo(threeHundredThousandNsec)).toBeTruthy();
        expect(sevenPointFiveBillNS.isEqualTo(sevenPointFiveMillUsecs)).toBeTruthy();
        expect(fortyTwoDays.isEqualTo(fortyTwoDaysAsMsec)).toBeTruthy();
        


        // This test should generate an error because we're trying to convert
        // a number which can't be represented as a numeric time interval.
        expect(() => {
            TimeValue.withUnits(Number.MAX_SAFE_INTEGER, TimeUnit.weeks);
        }).toThrowError();

    });

    /**
     * Test the Tag constructor
     */
    it('create tags', function () {
        const tg = new Tag(straightZero, 0);
        expect(tg.time).toStrictEqual(TimeValue.zero());
        const tg2 = new Tag(straightZero);
        expect(tg2.time).toStrictEqual(TimeValue.zero());

        
        expect(() => { const tiFiveSecondsMinus1:Tag = new Tag(fiveSeconds, -1) }).toThrowError("Microstep must be positive.");
        expect(() => { const tiFiveSeconds1Point1:Tag = new Tag(fiveSeconds, 1.1)}).toThrowError("Microstep must be integer.");

        
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
        expect(new Tag(fiveHundredMilNS, 0).getLaterTag(fortyTwoDays).isSimultaneousWith(new Tag(TimeValue.secsAndNs(42 * 24 * 60 * 60, 500000000), 0))).toBeTruthy();
        expect(new Tag(fiveHundredMilNS, 0).getLaterTag(fiveHundredMilNS).isSimultaneousWith(new Tag(TimeValue.secs(1), 0))).toBeTruthy();
        expect(new Tag(oneThousandMS, 0).getLaterTag(straightZero).isSimultaneousWith(new Tag(oneThousandMS, 0))).toBeTruthy();
        expect(new Tag(oneThousandMS, 1).getLaterTag(straightZero).isSimultaneousWith(new Tag(oneThousandMS, 1))).toBeTruthy();
    });

    /**
     * Get a time interval in a format that is understood by nanotimer.
     */
    it('support for nanotimer (obsolete)', function() {
        expect(TimeValue.secsAndNs(0 , 225).getNanoTime()).toEqual("225n");
        expect(fiveSeconds.getNanoTime()).toEqual("5s");
        expect(straightZero.getNanoTime()).toEqual("0s");
        expect(fiveSFiveUS.getNanoTime()).toEqual("5000005u");
        expect(TimeValue.secsAndNs(5, 5000000).getNanoTime()).toEqual("5005m");
        expect(TimeValue.secsAndNs(5, 5).getNanoTime()).toEqual("5000000005n");
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
        expect(tiFiveSeconds0.getTimeDifference(tiFiveSeconds0)).toEqual(TimeValue.secs(0));
        expect(tiFiveSeconds0.getTimeDifference(tiFiveSeconds1)).toEqual(TimeValue.secs(0));
        expect(tiFiveSeconds0.getTimeDifference(tiOne1)).toEqual(TimeValue.secs(4));
        expect(tiOne1.getTimeDifference(tiFiveSeconds0)).toEqual(TimeValue.secs(4));
    });

    /**
     * Compare two time values and find out which one is earlier.
     */
    it('compare time values', function() {
        expect(TimeValue.secsAndNs(0, 999999998).isEarlierThan(TimeValue.secsAndNs(0, 999999999))).toEqual(true)
    });


    /**
     * See if expected errors happen.
     */
    it('errors', function () {
        expect(() => {
            expect(TimeValue.secsAndNs(4.3, 2.1));
        }).toThrowError()
    
        expect(() => {
            expect(TimeValue.withUnits(-1, TimeUnit.week));
        }).toThrowError()
    
        expect(() => {
            expect(TimeValue.secsAndNs(2,1).subtract(TimeValue.secsAndNs(4, 3)));
        }).toThrowError()

        expect(() => { 
            expect(TimeValue.secsAndNs(Math.pow(2, 40), 0).toBinary());
        }).toThrowError()

    });



    /**
     * Test conversion to Binary
     */
    it('convert to binary', function() {

        expect(TimeValue.fromBinary(straightZero.toBinary())).toEqual(straightZero);
        expect(TimeValue.fromBinary(zeroSeconds.toBinary())).toEqual(zeroSeconds);
        expect(TimeValue.fromBinary(zeroNS.toBinary())).toEqual(zeroNS);
        expect(TimeValue.fromBinary(zeroWeeks.toBinary())).toEqual(zeroWeeks);
        expect(TimeValue.fromBinary(fiveSeconds.toBinary())).toEqual(fiveSeconds);
        expect(TimeValue.fromBinary(fortyTwoDays.toBinary())).toEqual(fortyTwoDays);
        expect(TimeValue.fromBinary(threeHundredUS.toBinary())).toEqual(threeHundredUS);
        expect(TimeValue.fromBinary(sevenPointFiveBillNS.toBinary())).toEqual(sevenPointFiveBillNS);
        expect(TimeValue.fromBinary(twoHundredFiftyMillMS.toBinary())).toEqual(twoHundredFiftyMillMS);
        expect(TimeValue.fromBinary(fiveSFiveUS.toBinary())).toEqual(fiveSFiveUS);
        expect(TimeValue.fromBinary(oneThousandMS.toBinary())).toEqual(oneThousandMS);

    });

    it('convert to/from binary with Tag methods', function() {

        // some example tags with various microsteps
        const straightZeroTag = new Tag(straightZero, 0)
        const zeroSecondsTag = new Tag(zeroSeconds, 0)
        const zeroNSTag = new Tag(zeroNS, 0)
        const zeroWeeksTag = new Tag(zeroWeeks, 0)
        const fiveSecondsTag = new Tag(fiveSeconds, 0)
        const fiveSFiveUSTag = new Tag(fiveSFiveUS, 0)
        const fortyTwoDaysTag = new Tag(fortyTwoDays, 0)
        const threeHundredUSTag = new Tag(threeHundredUS, 0)
        const sevenPointFiveBillNSTag = new Tag(sevenPointFiveBillNS, 0)
        const twoHundredFiftyMillMSTag = new Tag(twoHundredFiftyMillMS, 0)
        const oneThousandMSTag = new Tag(oneThousandMS, 0)


        expect(Tag.fromBinary(straightZeroTag.toBinary())).toEqual(straightZeroTag);
        expect(Tag.fromBinary(zeroSecondsTag.toBinary())).toEqual(zeroSecondsTag);
        expect(Tag.fromBinary(zeroNSTag.toBinary())).toEqual(zeroNSTag);
        expect(Tag.fromBinary(zeroWeeksTag.toBinary())).toEqual(zeroWeeksTag);
        expect(Tag.fromBinary(fiveSecondsTag.toBinary())).toEqual(fiveSecondsTag);
        expect(Tag.fromBinary(fortyTwoDaysTag.toBinary())).toEqual(fortyTwoDaysTag);
        expect(Tag.fromBinary(threeHundredUSTag.toBinary())).toEqual(threeHundredUSTag);
        expect(Tag.fromBinary(sevenPointFiveBillNSTag.toBinary())).toEqual(sevenPointFiveBillNSTag);
        expect(Tag.fromBinary(twoHundredFiftyMillMSTag.toBinary())).toEqual(twoHundredFiftyMillMSTag);
        expect(Tag.fromBinary(fiveSFiveUSTag.toBinary())).toEqual(fiveSFiveUSTag);
        expect(Tag.fromBinary(oneThousandMSTag.toBinary())).toEqual(oneThousandMSTag);

    });


});