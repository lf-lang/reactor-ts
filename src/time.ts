/**
 * Types and helper functions relating to time for reactors.
 * @author Marten Lohstroh (marten@berkeley.edu)
 * @author Matt Weber (matt.weber@berkeley.edu)
 */

/**
 * Module used to acquire time from the platform in microsecond precision.
 * @see {@link https://www.npmjs.com/package/microtime}
 */
const Microtime = require("microtime");

/**
 * Units (and conversion factors from nanoseconds) for time values.
 **/
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
 * A time interval given in nanosecond precision. To prevent overflow
 * (which would occur for time intervals spanning more than 0.29 years
 * if a single JavaScript number, which has 2^53 bits of precision, were
 * to be used), we use _two_ numbers to store a time interval. The first
 * number denotes the number of whole seconds in the interval; the second
 * number denotes the remaining number of nanoseconds in the interval.
 * This class serves as a base class for `UnitBasedTimeInterval`, which 
 * provides the convenience of defining time intervals as a single number
 * accompanied by a unit.
 * @see TimeUnit
 * @see UnitBasedTimeInterval
 */
export class TimeInterval {

    /**
     * Create a new time interval. Both parameters must be non-zero integers;
     * an error will be thrown otherwise. The second parameter is optional.
     * @param seconds Number of seconds in the interval.
     * @param nanoseconds Remaining number of nanoseconds (defaults to zero).
     */
    constructor(protected seconds: number, protected nanoseconds: number=0) {
        if(!Number.isInteger(seconds) || !Number.isInteger(nanoseconds) || seconds < 0 || nanoseconds < 0) {
            throw new Error("Cannot instantiate a time interval based on negative or non-integer numbers.");
        }
    }

    /**
     * Return a new time interval that denotes the duration of this 
     * time interval plus the time interval given as a parameter.
     * @param other The time interval to add to this one.
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

    /**
     * Return a new time interval that denotes the duration of this 
     * time interval minus the time interval given as a parameter.
     * @param other The time interval to subtract from this one.
     */
    subtract(other: TimeInterval): TimeInterval {
        var s = this.seconds - other.seconds;;
        var ns = this.nanoseconds - other.nanoseconds;

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
     * Return true this denotes a time interval equal of equal
     * length as the time interval given as a parameter.
     * @param other The time interval to compare to this one.
     */
    isEqualTo(other: TimeInterval): boolean {
        return this.seconds == other.seconds 
            && this.nanoseconds == other.nanoseconds;
    }

    /**
     * Return true if this denotes a zero time interval.
     */
    isZero() {
        if(this.seconds == 0 && this.nanoseconds == 0) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Return true if this time interval is of smaller length than the time
     * interval given as a parameter, return false otherwise.
     * NOTE: Performing this comparison involves a conversion to a big integer
     * and is therefore relatively costly.
     * @param other The time interval to compare to this one.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt|BigInt} for further information.
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

    /**
     * Get a string representation of this time interval that is compatible
     * with `nanotimer`.
     * @see {@link https://www.npmjs.com/package/nanotimer} for 
     * further information.
     */
    public getNanoTime(): string {
        // Unit specifiers are:

        //  s = seconds
        //  m = milliseconds
        //  u = microseconds
        //  n = nanoseconds

        if (this.nanoseconds == 0) {
            return this.seconds.toString() + "s";
        } else if (this.nanoseconds % 1000000 == 0) {
            let milliSecString = (this.nanoseconds / 1000000).toString();
            if (this.seconds == 0) {
                return milliSecString + "m";
            } else {
                let padding = "";
                for (let i = 0; i < 3 - milliSecString.length; i++) {
                    padding += "0";
                }
                return this.seconds.toString() + padding + milliSecString + "m";
            }
        } else if (this.nanoseconds % 1000 == 0) {
            let microSecString = (this.nanoseconds/1000).toString();
            if (this.seconds == 0) {
                return microSecString + "u";
            } else {
                let padding = "";
                for (let i = 0; i < 6 - microSecString.length; i++) {
                    padding += "0";
                }
                return this.seconds.toString() + padding + microSecString + "u";
            }
        } else {
            let nanoSecString = this.nanoseconds.toString();
            if (this.seconds == 0) {
                return nanoSecString + "n";
            } else {
                let padding = "";
                for (let i = 0; i < 9 - nanoSecString.length; i++) {
                    padding += "0";
                }
                return this.seconds.toString() + padding + nanoSecString + "n";
            }
        } 
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

    readonly time:TimeInterval;

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

export function getCurrentPhysicalTime(): TimeInstant {
    let t = Microtime.now();
    let seconds: number = Math.floor(t / 1000000);
    let nseconds: number = t * 1000 - seconds * 1000000000;
    return new TimeInstant(new TimeInterval(seconds, nseconds), 0);
}
