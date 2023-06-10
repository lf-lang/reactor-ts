/**
 * Time-related helper functions for reactors.
 * @author Marten Lohstroh (marten@berkeley.edu)
 * @author Matt Weber (matt.weber@berkeley.edu)
 */
import MicroTime from "microtime";

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
 * A time value given in nanosecond precision. To prevent overflow (which would
 * occur for time intervals spanning more than 0.29 years if a single JavaScript
 * number, which has 2^53 bits of precision, were to be used), we use _two_
 * numbers to store a time value. The first number denotes the number of whole
 * seconds in the interval; the second number denotes the remaining number of
 * nanoseconds in the interval. This class serves as a base class for
 * `UnitBasedTimeValue`, which provides the convenience of defining time values
 * as a single number accompanied by a unit.
 * @see TimeUnit
 * @see UnitBasedTimeValue
 */
export class TimeValue {
  /**
   * Create a new time value. Both parameters must be non-negative integers;
   * an error will be thrown otherwise. The second parameter is optional.
   * @param seconds Number of seconds in the interval.
   * @param nanoseconds Remaining number of nanoseconds (defaults to zero).
   */
  constructor(protected seconds: number, protected nanoseconds: number = 0) {
    if (
      !Number.isInteger(seconds) ||
      !Number.isInteger(nanoseconds) ||
      seconds < 0 ||
      nanoseconds < 0
    ) {
      if (seconds !== Number.MIN_SAFE_INTEGER) {
        throw new Error(
          "Cannot instantiate a time interval based on negative or non-integer numbers."
        );
      }
    }
  }

  static zero(): TimeValue {
    return new TimeValue(0, 0);
  }

  // The symbles "NEVER" and "FOREVER" are used in `lingua-franca` main codebase,
  // so it does not make much sense to lint them or warn against.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static NEVER(): TimeValue {
    return new TimeValue(Number.MIN_SAFE_INTEGER, 0);
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  static FOREVER(): TimeValue {
    return new TimeValue(Number.MAX_SAFE_INTEGER, 0);
  }

  static secsAndNs(seconds: number, nanoSeconds: number): TimeValue {
    return new TimeValue(seconds, nanoSeconds);
  }

  static secs(seconds: number): TimeValue {
    return TimeValue.secsAndNs(seconds, 0);
  }

  static sec(seconds: number): TimeValue {
    return TimeValue.secsAndNs(seconds, 0);
  }

  static msecs(microseconds: number): TimeValue {
    return TimeValue.withUnits(microseconds, TimeUnit.msec);
  }

  static msec(microseconds: number): TimeValue {
    return TimeValue.withUnits(microseconds, TimeUnit.msec);
  }

  static usecs(nanoseconds: number): TimeValue {
    return TimeValue.withUnits(nanoseconds, TimeUnit.usec);
  }

  static usec(nanoseconds: number): TimeValue {
    return TimeValue.withUnits(nanoseconds, TimeUnit.usec);
  }

  static nsecs(nanoseconds: number): TimeValue {
    return TimeValue.withUnits(nanoseconds, TimeUnit.nsec);
  }

  static nsec(nanoseconds: number): TimeValue {
    return TimeValue.withUnits(nanoseconds, TimeUnit.nsec);
  }

  // FIXME: Add more convenience methods

  /**
   * Return a new time value that denotes the duration of the time interval
   * encoded by this time value plus the time interval encoded by the time
   * value given as a parameter.
   * @param other The time value to add to this one.
   */
  add(other: TimeValue): TimeValue {
    let seconds = this.seconds + other.seconds;
    let nanoseconds = this.nanoseconds + other.nanoseconds;

    if (nanoseconds >= TimeUnit.sec) {
      // Carry the second.
      seconds += 1;
      nanoseconds -= TimeUnit.sec;
    }
    return TimeValue.secsAndNs(seconds, nanoseconds);
  }

  /**
   * Return a new time value that denotes the duration of the time interval
   * encoded by this time value minus the time interval encoded by the time
   * value given as a parameter.
   * @param other The time value to subtract from this one.
   */
  subtract(other: TimeValue): TimeValue {
    let s = this.seconds - other.seconds;
    let ns = this.nanoseconds - other.nanoseconds;

    if (ns < 0) {
      // Borrow a second
      s -= 1;
      ns += TimeUnit.sec;
    }

    if (s < 0) {
      throw new Error("Negative time value.");
    }
    return TimeValue.secsAndNs(s, ns);
  }

  multiply(factor: number): TimeValue {
    let seconds = this.seconds * factor;
    let nanoseconds = this.nanoseconds * factor;

    if (nanoseconds >= TimeUnit.sec) {
      // Carry seconds.
      const carry = Math.floor(nanoseconds / TimeUnit.sec);
      seconds += carry;
      nanoseconds -= carry * TimeUnit.sec;
    }
    return TimeValue.secsAndNs(seconds, nanoseconds);
  }

  difference(other: TimeValue): TimeValue {
    if (this.isEarlierThan(other)) {
      return other.subtract(this);
    } else {
      return this.subtract(other);
    }
  }

  /**
   * Return true if this time value denotes a time interval of equal length as
   * the interval encoded by the time value given as a parameter.
   * @param other The time value to compare to this one.
   */
  isEqualTo(other: TimeValue): boolean {
    return (
      this.seconds === other.seconds && this.nanoseconds === other.nanoseconds
    );
  }

  /**
   * Return true if this denotes a time interval of length zero.
   */
  isZero(): boolean {
    if (this.seconds === 0 && this.nanoseconds === 0) {
      return true;
    } else {
      return false;
    }
  }

  isNever(): boolean {
    if (this.seconds === Number.MIN_SAFE_INTEGER && this.nanoseconds === 0) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Return true if this time value denotes a time interval of smaller length
   * than the time interval encoded by the time value given as a parameter;
   * return false otherwise.
   *
   * NOTE: Performing this comparison involves a conversion to a big integer
   * and is therefore relatively costly.
   *
   * @param other The time value to compare to this one.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt|BigInt} for further information.
   */
  isEarlierThan(other: TimeValue): boolean {
    if (this.seconds < other.seconds) {
      return true;
    }
    if (
      this.seconds === other.seconds &&
      this.nanoseconds < other.nanoseconds
    ) {
      return true;
    }
    return false;
  }

  /**
   * Return true if this time value is later than the time given as a parameter.
   *
   * @param other The time value to compare to this one.
   */
  isLaterThan(other: TimeValue): boolean {
    if (this.seconds > other.seconds) {
      return true;
    }
    if (
      this.seconds === other.seconds &&
      this.nanoseconds > other.nanoseconds
    ) {
      return true;
    }
    return false;
  }

  /**
   * Return a millisecond representation of this time value.
   */
  public toMilliseconds(): number {
    return this.seconds * 1000 + Math.ceil(this.nanoseconds / 1000000);
  }

  /**
   * Print the number of seconds and nanoseconds in the time interval encoded
   * by this time value.
   */
  public toString(): string {
    return `(${this.seconds} secs; ${this.nanoseconds} nsecs)`;
  }

  /**
   * Return a tuple that holds the seconds and remaining nanoseconds that
   * jointly represent this time value.
   */
  public toTimeTuple(): [number, number] {
    return [this.seconds, this.nanoseconds];
  }

  /**
   * Get a 64 bit binary, little endian representation of this TimeValue.
   * Used by federates.
   */
  public toBinary(): Buffer {
    const buff = Buffer.alloc(8);
    if (this.seconds === Number.MIN_SAFE_INTEGER) {
      buff.writeBigUInt64LE(BigInt(0x8000000000000000n), 0);
    } else if (this.seconds === Number.MAX_SAFE_INTEGER) {
      buff.writeBigUInt64LE(BigInt(0x7fffffffffffffffn), 0);
    } else {
      const billion = BigInt(TimeUnit.secs);
      const bigTime = BigInt(this.nanoseconds) + BigInt(this.seconds) * billion;

      // Ensure the TimeValue fits into a 64 unsigned integer.
      const clampedTime = BigInt.asUintN(64, bigTime);
      if (clampedTime !== bigTime) {
        throw new Error(
          `TimeValue ${this.toString()} is too big to fit into ` +
            "a 64 bit unsigned integer"
        );
      }
      buff.writeBigUInt64LE(bigTime, 0);
    }
    return buff;
  }

  /**
   * Create a TimeValue from a 64bit little endian unsigned integer in a buffer.
   * @param buffer A 64 bit unsigned integer. Little endian.
   */
  public static fromBinary(buffer: Buffer): TimeValue {
    const billion = BigInt(TimeUnit.secs);

    // To avoid overflow and floating point errors, work with BigInts.
    const bigTime = buffer.readBigUInt64LE(0);
    if (bigTime === BigInt(0x8000000000000000n)) {
      return TimeValue.NEVER();
    } else if (bigTime === BigInt(0x7fffffffffffffffn)) {
      return TimeValue.FOREVER();
    }

    const bigSeconds = bigTime / billion;
    const bigNSeconds = bigTime % billion;

    return TimeValue.secsAndNs(Number(bigSeconds), Number(bigNSeconds));
  }

  /**
   * Give a value and time unit, return a new time value.
   *
   * The value is a `number` that is required to be
   * a positive integer. The time unit must be a member of the `TimeUnit` enum.
   * @param value A number (which must be a positive integer) that denotes
   * the length of the specified time interval, expressed as a multiple of
   * the given time unit.
   * @param unit The unit of measurement that applies to the given value.
   * @returns
   */
  public static withUnits(value: number, unit: TimeUnit): TimeValue {
    if (!Number.isInteger(value)) {
      throw new Error("Non-integer time values are illegal.");
    }
    if (value < 0) {
      throw new Error("Negative time values are illegal.");
    }

    const billion = BigInt(TimeUnit.secs);

    // To avoid overflow and floating point errors, work with BigInts.
    const bigT = BigInt(value) * BigInt(unit);
    const bigSeconds = bigT / billion;

    if (bigSeconds > Number.MAX_SAFE_INTEGER) {
      throw new Error("Unable to instantiate time value: value too large.");
    }
    return TimeValue.secsAndNs(Number(bigSeconds), Number(bigT % billion));
  }
}

/**
 * A superdense time instant, represented as a time value `time` (i.e.,
 * time elapsed since Epoch) paired with a microstep index to keep track of
 * iterations in superdense time. For each such iteration, `time` remains
 * the same, but `microstep` is incremented.
 */
export class Tag {
  /**
   * Time elapsed since Epoch.
   */
  readonly time: TimeValue;

  /**
   * Create a new tag using a time value and a microstep.
   * @param timeSinceEpoch Time elapsed since Epoch.
   * @param microstep Superdense time index.
   */
  constructor(timeSinceEpoch: TimeValue, readonly microstep: number = 0) {
    if (!Number.isInteger(microstep)) {
      throw new Error("Microstep must be integer.");
    }
    if (microstep < 0) {
      throw new Error("Microstep must be positive.");
    }
    this.time = timeSinceEpoch;
  }

  /**
   * Return `true` if this time instant is earlier than the tag given as a
   * parameter, false otherwise. For two tags with an equal `time`, one
   * instant is earlier than the other if its `microstep` is less than the
   * `microstep` of the other.
   * @param other The time instant to compare against this one.
   */
  isSmallerThan(other: Tag): boolean {
    return (
      this.time.isEarlierThan(other.time) ||
      (this.time.isEqualTo(other.time) && this.microstep < other.microstep)
    );
  }

  /**
   * Return `true` if the tag is smaller than or equal to the tag given as a parameter.
   * @param other The time instant to compare against this one.
   */
  isSmallerThanOrEqualTo(other: Tag): boolean {
    return !this.isGreaterThan(other);
  }

  /**
   * Return `true` if the tag is greater than the tag given as a parameter.
   * @param other The time instant to compare against this one.
   */
  isGreaterThan(other: Tag): boolean {
    return (
      this.time.isLaterThan(other.time) ||
      (this.time.isEqualTo(other.time) && this.microstep > other.microstep)
    );
  }

  /**
   * Return `true` if the tag is greater than or equal to the tag given as a parameter.
   * @param other The time instant to compare against this one.
   */
  isGreaterThanOrEqualTo(other: Tag): boolean {
    return !this.isSmallerThan(other);
  }

  /**
   * Return `true` if this tag is simultaneous with the tag given as
   * a parameter, false otherwise. Both `time` and `microstep` must be equal
   * for two tags to be simultaneous.
   * @param other The time instant to compare against this one.
   */
  isSimultaneousWith(other: Tag): boolean {
    return (
      this.time.isEqualTo(other.time) && this.microstep === other.microstep
    );
  }

  /**
   * Get a new time instant that represents this time instant plus
   * the given delay. The `microstep` of this time instant is ignored;
   * the returned time instant has a `microstep` of zero if the delay
   * is greater than zero. If the delay equals zero, the tag is returned
   * unchanged with its current `microstep`.
   * @param delay The time interval to add to this time instant.
   */
  getLaterTag(delay: TimeValue): Tag {
    if (delay.isZero() || delay.isNever()) {
      return this;
    } else {
      return new Tag(delay.add(this.time), 0);
    }
  }

  /**
   * Get a new time instant that has the same `time` but n `microsteps` later.
   */
  getMicroStepsLater(n: number): Tag {
    return new Tag(this.time, this.microstep + n);
  }

  /**
   * Obtain a time interval that represents the absolute (i.e., positive) time
   * difference between this time interval and the tag given as a parameter.
   * @param other The time instant for which to compute the absolute
   * difference with this time instant.
   */
  getTimeDifference(other: Tag): TimeValue {
    if (this.isSmallerThan(other)) {
      return other.time.subtract(this.time);
    } else {
      return this.time.subtract(other.time);
    }
  }

  /**
   * Return a human-readable string presentation of this time instant.
   */
  public toString(): string {
    return `(${this.time.toString()}, ${this.microstep})`;
  }

  /**
   * Get a 12-byte buffer for the tag.
   * Used by federates.
   */
  public toBinary(): Buffer {
    const timeBuffer = this.time.toBinary();
    const buf = Buffer.alloc(12);
    timeBuffer.copy(buf, 0, 0);
    buf.writeInt32LE(this.microstep, 8);
    return buf;
  }

  /**
   * Create a Tag from 8-byte TimeValue and 4-byte microstep in a buffer.
   * @param buffer A buffer of TimeValue and microstep.
   */
  public static fromBinary(buffer: Buffer): Tag {
    const timeBuffer = Buffer.alloc(8);
    buffer.copy(timeBuffer, 0, 0, 8);
    const time = TimeValue.fromBinary(timeBuffer);
    const microstep = buffer.readUInt32LE(8);

    return new Tag(time, microstep);
  }
}

/**
 * A descriptor to be used when scheduling events to denote as to whether
 * an event should occur with a delay relative to _physical time_ or _logical
 * time_.
 */
export enum Origin {
  physical = "physical",
  logical = "logical"
}

/**
 * Return a time value that reflects the current physical time as reported
 * by the platform.
 */
export function getCurrentPhysicalTime(): TimeValue {
  const t = MicroTime.now();
  const seconds: number = Math.floor(t / 1000000);
  const nseconds: number = t * 1000 - seconds * TimeUnit.sec;
  return TimeValue.secsAndNs(seconds, nseconds);
}

/**
 * Simple but accurate alarm that makes use of high-resolution timer.
 * The algorithm is inspired by nanotimer, written by Kevin Briggs.
 * @author Marten Lohstroh (marten@berkeley.edu)
 */
export class Alarm {
  /**
   * Handle for regular timeout, used for delays > 25 ms.
   */
  deferredRef: NodeJS.Timeout | undefined;

  /**
   * Handle for immediate, used for polling once the remaining delay is < 25
   * ms.
   */
  immediateRef: NodeJS.Immediate | undefined;

  /**
   * Delay in terms of milliseconds, used when deferring to regular timeout.
   */
  loResDelay = 0;

  /**
   * Start of the delay interval; tuple of seconds and nanoseconds.
   */
  hiResStart: [number, number] = [0, 0];

  /**
   * The delay interval in high resolution; tuple of seconds and nanoseconds.
   */
  hiResDelay: [number, number] = [0, 0];

  /**
   * Indicates whether the alarm has been set or not.
   */
  active = false;

  /**
   * Disable any scheduled timeouts or immediate events, and set the timer to
   * inactive.
   */
  unset(): void {
    if (this.deferredRef != null) {
      clearTimeout(this.deferredRef);
      this.deferredRef = undefined;
    }

    if (this.immediateRef != null) {
      clearImmediate(this.immediateRef);
      this.immediateRef = undefined;
    }

    this.active = false;
  }

  /**
   * Once the alarm has been initialized, see if the task can be performed or
   * a longer wait is necessary.
   * @param task The task to perform.
   * @param callback Optional callback used to report the wait time.
   */
  private try(
    task: () => void,
    callback?: (waitTime: TimeValue) => void
  ): void {
    // Record the current time.
    const hiResDif = process.hrtime(this.hiResStart);

    // See whether the requested delay has elapsed.
    if (
      this.hiResDelay[0] < hiResDif[0] ||
      (this.hiResDelay[0] === hiResDif[0] && this.hiResDelay[1] < hiResDif[1])
    ) {
      // No more immediates a scheduled.
      this.immediateRef = undefined;

      // The delay has elapsed; perform the task.
      if (this.active) {
        // If this attempt is the result of a deferred request, perform
        // the task synchronously.
        this.active = false;
        task();
        if (callback != null) {
          callback(TimeValue.secsAndNs(...hiResDif));
        }
      } else {
        // If this attempt is the result of a direct call to `set`, push
        // task onto the nextTick queue. This unwinds the stack, but it
        // bypasses the regular event queue. If events are recursively
        // requested to be performed with zero or near zero delay, this
        // will not cause the call stack to exceed its maximum size, but
        // it will starve I/O.
        this.active = true;
        process.nextTick(() => {
          if (this.active) {
            this.active = false;
            task();
            if (callback != null) {
              callback(TimeValue.secsAndNs(...hiResDif));
            }
          }
        });
      }
    } else {
      // The delay has not yet elapsed.
      // The following logic is based on the implementation of nanotimer.
      if (this.loResDelay > 25) {
        if (!this.active) {
          this.deferredRef = setTimeout(() => {
            this.try(task, callback);
          }, this.loResDelay - 25);
        } else {
          this.deferredRef = undefined;
          this.immediateRef = setImmediate(() => {
            this.try(task, callback);
          });
        }
      } else {
        this.immediateRef = setImmediate(() => {
          this.try(task, callback);
        });
      }
      this.active = true;
    }
  }

  /**
   * Set the alarm.
   * @param task The task to be performed.
   * @param delay The time has to elapse before the task can be performed.
   * @param callback Optional callback used to report the wait time.
   */
  public set(
    task: () => void,
    delay: TimeValue,
    callback?: (waitTime: TimeValue) => void
  ): void {
    // Reset the alarm if it was already active.
    if (this.active) {
      this.unset();
    }
    // Compute the delay
    this.hiResDelay = delay.toTimeTuple();
    this.loResDelay = delay.toMilliseconds();

    // Record the beginning of the delay interval.
    this.hiResStart = process.hrtime();
    this.try(task, callback);
  }
}
