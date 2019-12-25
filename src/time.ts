declare function require(name:string);

const microtime = require("microtime");


/**
 * Types and helper functions relating to time for reactors.
 * @author Marten Lohstroh (marten@berkeley.edu)
 * @author Matt Weber (matt.weber@berkeley.edu)
 */

/** Units for time. */
export enum TimeUnit {
    nsec = 1,
    usec = 1000,
    msec = 1000000,
    sec = 1000000000,
    secs = 1000000000,
    minute = 60000000000,
    minutes = 60000000000,
    hour = 3600000000000,
    hours = 3600000000000,
    day = 86400000000000,
    days = 86400000000000,
    week = 604800000000000,
    weeks = 604800000000000
}

/**
 * The internal representation of a TimeInterval broken up as: [seconds, nanoseconds]
 * 
 * If we used a Javascript number to hold the number of nanoseconds in the time interval,
 * the 2^53 bits of precision for a JavaScript number (double) would overflow after 0.29 years.
 * We use an array here, because in our experiments this representation is much faster
 * than a JavaScript BigInt. To avoid floating point errors, non-integer seconds or 
 * nanoseconds are not allowed.
 * 
 */
export class TimeInterval {

    constructor(protected seconds: number, protected nanoseconds: number=0) {
        if(!Number.isInteger(seconds) || !Number.isInteger(nanoseconds) || seconds < 0 || nanoseconds < 0) {
            throw new Error("Cannot instantiate a time interval based on negative or non-integer numbers.");
        }
    }

    /**
     * Return a new time spec that denotes a duration of this 
     * time spec plus a given other time spec.
     * @param other Time spec to add to this one.
     */
    add(other: TimeInterval): TimeInterval {
        const billion = 1000000000;

        let seconds = this.seconds + other.seconds;
        let nanoseconds = this.nanoseconds + other.nanoseconds;

        if(nanoseconds >= billion) {
            //Carry the second
            seconds += 1;
            nanoseconds -= billion;
        }
        return new TimeInterval(seconds, nanoseconds);
    }

    subtract(that: TimeInterval): TimeInterval {
        var s = this.seconds - that.seconds;;
        var ns = this.nanoseconds - that.nanoseconds;

        if(ns < 0) {
            // Borrow a second
            s -= 1;
            ns += 1000000000;
        }

        if(s < 0){
            throw new Error("Negative time value.");
        }
        return new TimeInterval(s, ns);
    }

    /**
     * Return true if this denotes a zero time interval.
     */
    isEqualTo(other: TimeInterval) {
        return this.seconds == other.seconds && this.nanoseconds == other.nanoseconds;
    }

    isZero() {
        if(this.seconds == 0 && this.nanoseconds == 0) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Return true if t0 < t1, otherwise return false.
     * Doing this comparison involves a conversion to a big integer and thus is costly.
     */
    isSmallerThan(other: TimeInterval) {
        if (this.seconds < other.seconds) {
            return true;
        }
        if (this.seconds == other.seconds && this.nanoseconds < other.nanoseconds) {
            return true;
        }
        return false;
    }

    /**
     * Print the number of seconds and nanoseconds in this time interval.
     */
    public toString(): string {
        return "(" + this.seconds + " secs; " + this.nanoseconds + " nsecs)";
    }

    public getNanoTime(): string {
        let nanoSecString = this.nanoseconds.toString();
        let padding = "";
        for (let i = 0; i < 9 - nanoSecString.length; i++) {
            padding += "0";
        }
        return this.seconds.toString() + padding + nanoSecString + "n"; 
    }
}

/** 
 * A time interval must be an integer accompanied by a time unit. Decimals or negative values yield errors.
 */
export class UnitBasedTimeInterval extends TimeInterval {

    constructor(private value: number, private unit:TimeUnit) {
        super(0, 0); 

        if (!Number.isInteger(value)) {
            throw new Error("Non-integer time values are illegal.");
        }
        if (value < 0) {
            throw new Error("Negative time values are illegal.");
        }
        
        // Store this interval as a TimeSpec for later use.
        const billion = BigInt(TimeUnit.secs);
    
        // To avoid overflow and floating point errors, work with BigInts.
        let bigT = BigInt(this.value) * BigInt(this.unit);  
        let bigSeconds = bigT / billion;
        
        if(bigSeconds > Number.MAX_SAFE_INTEGER) {
            throw new Error("Unable to instantiate time interval: value too large.");
        }
        
        this.seconds = Number(bigSeconds);
        this.nanoseconds = Number(bigT % billion);
    }

    /**
     * Print a string representation of this time interval using the time unit it was
     * originally created with.
     */
    public toString(): string {
        return this.value + " " + this.unit;
    }
}


/** 
 * A superdense time instant, represented as a pair. The first element of the pair represents
 * elapsed time as a NumericTimeInterval. The second element denotes the micro step index.
 */ 
export class TimeInstant {

    readonly time;

    constructor(timeSinceEpoch: TimeInterval, readonly microstep: number) {
        this.time = timeSinceEpoch;
    }

    isEarlierThan(that: TimeInstant) {
        return this.time.isSmallerThan(that.time) 
            || (this.time.isEqualTo(that.time) 
                && this.microstep < that.microstep);
    }

    isSimultaneousWith(that: TimeInstant) {
        return this.time.isEqualTo(that.time) 
            && this.microstep == that.microstep;
    }
    

    getLaterTime(delay: TimeInterval) : TimeInstant {
        return new TimeInstant(delay.add(this.time), 0);   
    }

    getMicroStepLater() {
        return new TimeInstant(this.time, this.microstep+1);
    }
    getTimeDifference(that: TimeInstant): TimeInterval {
        if (this.isEarlierThan(that)) {
            return that.time.subtract(this.time);
        } else {
            return this.time.subtract(that.time);
        }
    }

    public toString(): string {
        return "(" + this.time.toString() + ", " + this.microstep + ")"; 
    }
}

/**
 * A descriptor for a time representation as either refering to the physical (wall)
 * timeline or the logical (execution) timeline. Logical time may get ahead of
 * physical time, or vice versa.
 */
export enum Origin {
    physical,
    logical
}

/**
 * A value (of type T) which is present at a particular TimeInstant
 */
//export type TimestampedValue<T> = [TimeInstant, T];

//---------------------------------------------------------------------//
// Helper Functions for Types                                                   //
//---------------------------------------------------------------------//

/**
 * Return true if t matches any of the zero representations for a TimeInterval
 * @param t the time interval to test if zero.
 */
// export function timeIntervalIsZero(t: TimeInterval){
//     if(t === 0 || (t && t[0] === 0)){
//         return true;
//     } else {
//         return false;
//     }
// }

// /**
//  * Return true if t0 < t1, otherwise return false.
//  * @param t0 Left hand numeric time.
//  * @param t1 Right hand numeric time.
//  */
// export function compareNumericTimeIntervals(t0: NumericTimeInterval, t1: NumericTimeInterval){
//     if(t0[0] < t1[0]){
//         return true;
//     }
//     if(t0[0] == t1[0] &&
//             t0[1] < t1[1]){
//         return true;
//     }
//     return false;
// }

/**
 * Return true if t0 and t1 represent the same time instant. Otherwise return false.
 * @param t0 Left hand time instant.
 * @param t1 Right hand time instant.
 */
// export function timeInstantsAreEqual(t0: TimeInstant, t1: TimeInstant){
//     return t0[0][0] == t1[0][0] && t0[0][1] == t1[0][1] && t0[1] == t1[1];
// }

/**
 * Return true if t0 < t1, otherwise return false.
 * @param t0 Left hand time instant.
 * @param t1 Right hand time instant.
 */
// export function compareTimeInstants(t0: TimeInstant, t1: TimeInstant): boolean{
//     if(compareNumericTimeIntervals(t0[0], t1[0])){
//         return true;
//     } else{
//         if( t0[0][0] == t1[0][0] && t0[0][1] == t1[0][1] && t0[1] < t1[1] ){
//             return true;   
//         }
//         return false;
//     }
// }

/**
 * Convert a TimeInterval to its corresponding representation as a NumericTimeInterval.
 * Attempting to convert a TimeInterval with sub-nanosecond precision to a
 * NumericTimeInterval will result in an error. Sub-nanosecond precision is not allowed
 * because:
 * 1) None of the timing related libraries support it.
 * 2) It may cause floating point errors in the NumericTimeInterval's
 *    number representation. Integers have up to 53 bits of precision to be exactly
 *    represented in a JavaScript number (i.e. a double), but anything right of the
 *    decimal point such as 0.1 may have a non-exact floating point representation.
 * @param t The numeric time interval to convert.
 */
// export function timeIntervalToNumeric(t: TimeInterval): NumericTimeInterval {
//     //Convert the TimeInterval to a BigInt in units of nanoseconds, then split it up.

//     if(t === 0){
//         return [0, 0];
//     }

//     if(t[0] < 0){
//         throw Error("A time interval may not be negative.")
//     }

//     if(Math.floor(t[0]) - t[0] !== 0){
//         throw Error("Cannot convert TimeInterval " + t + " to a NumericTimeInterval "+
//         "because it does not have an integer time.");
//         //Allowing this may cause floating point errors.
//     }

//     const billion = BigInt(1000000000);

//     let seconds: number;
//     let nseconds: number;

//     //To avoid overflow and floating point errors, work with BigInts.
//     let bigT = BigInt(t[0]) * BigInt(t[1]);
//     let max = BigInt(Number.MAX_SAFE_INTEGER);

//     let bigSeconds = bigT / billion;
//     if(bigSeconds > max){
//         throw new Error("timeIntervalToNumeric failed. The time interval is too large to safely convert.");
//     }

//     seconds = parseInt(bigSeconds.toString());
//     nseconds = parseInt((bigT % billion).toString());

//     return [seconds, nseconds];    

// }

export function getCurrentPhysicalTime(): TimeInstant {
    let t = microtime.now();
    let seconds: number = Math.floor(t / 1000000);
    let nseconds: number = t * 1000 - seconds * 1000000000;
    return new TimeInstant(new TimeInterval(seconds, nseconds), 0);
}

// /**
//  * Convert a number representing time in microseconds to a NumericTimeInterval
//  * @param t the number in units of microseconds to convert
//  */
// export function microtimeToNumeric(t: number): NumericTimeInterval {
//     const million = 1000000;
//     const billion = 1000000000;

//     //The associativity of these operations is very important because otherwise
//     //there will be floating point errors.
//     let seconds: number = Math.floor(t / million);
//     let nseconds: number = t * 1000 - seconds * billion;
//     return [seconds, nseconds];
// }

/**
 * Calculate t1 - t2. Returns the difference as a NumericTimeInterval
 * Assumes t1 >= t2, and throws an error if this assumption is broken.
 * @param t1 minuend
 * @param t2 subtrahend
 */
// export function numericTimeDifference(t1: NumericTimeInterval, t2: NumericTimeInterval): NumericTimeInterval {
    // let difference:NumericTimeInterval = [0, 0];
    // const billion = 1000000000;
    // if(t1[1] >= t2[1]){
    //     difference[0] = t1[0] - t2[0];
    //     difference[1] = t1[1] - t2[1];
    // } else {
    //     //Borrow a second
    //     difference[0] = t1[0] - 1 - t2[0];
    //     difference[1] = t1[1] + billion - t2[1];
    // }
    // if(difference[0] < 0 || difference[1] < 0){
    //     throw new Error("numericTimeDifference requires t1 >= t2");
    // }
//     return difference;
// }

/**
 * Calculate t1 + t2. Returns the sum as a NumericTimeInterval
 * @param t1 addend 1
 * @param t2 addend 2
 */
// export function numericTimeSum(t1: NumericTimeInterval, t2: NumericTimeInterval): NumericTimeInterval {
//     const billion = 1000000000;

//     let sum:NumericTimeInterval = [0, 0];
    
//     if(t1[1] + t2[1] >= billion){
//         //Carry the second
//         sum[0] = t1[0] + t2[0] + 1;
//         sum[1] = t1[1] + t2[1] - billion;
//     } else {
//         sum[0] = t1[0] + t2[0];
//         sum[1] = t1[1] + t2[1];
//     }
//     return sum;
// }

// /**
//  * Multiply a timeInterval t1, by a number t2. Returns the product as a NumericTimeInterval
//  * @param t time interval to be multiplied
//  * @param multiple number by which to multiply t
//  */
// export function numericTimeMultiple(t: NumericTimeInterval, multiple: number): NumericTimeInterval {
//     const billion = 1000000000;
//     let product:NumericTimeInterval = [0, 0];

//     let nanoProduct = t[1] * multiple;
//     let carry = Math.floor(nanoProduct/ billion)
//     product[1] = nanoProduct - carry * billion;
//     product[0] = t[0] * multiple + carry;
    
//     return product;
// }

// /**
//  * Return true if timeInterval t1 is equal to timeInterval t2.
//  * @param t1 First time interval.
//  * @param t2 Second time interval
//  */
// export function numericTimeEquals(t1: NumericTimeInterval, t2: NumericTimeInterval): Boolean {
//     if(t1[0] == t2[0] && t2[1] == t2[1]){
//         return true;
//     } else {
//         return false;
//     }
// }