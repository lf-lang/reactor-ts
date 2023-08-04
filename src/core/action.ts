import type {Absent, Read, Sched, Reactor, TriggerManager} from "./internal";
import {
  Log,
  TaggedEvent,
  getCurrentPhysicalTime,
  Origin,
  Tag,
  TimeUnit,
  TimeValue,
  ScheduledTrigger
} from "./internal";

const defaultMIT = TimeValue.withUnits(1, TimeUnit.nsec); // FIXME

export abstract class SchedulableAction<T> implements Sched<T> {
  abstract get(): T | undefined;
  abstract schedule(
    extraDelay: 0 | TimeValue,
    value: T,
    intendedTag?: Tag
  ): void;
}

/**
 * An action denotes a self-scheduled event.
 * An action, like an input, can cause reactions to be invoked.
 * Whereas inputs are provided by other reactors, actions are scheduled
 * by this reactor itself, either in response to some observed external
 * event or as a delayed response to some input event. The action can be
 * scheduled by a reactor by invoking the schedule function in a reaction
 * or in an asynchronous callback that has been set up in a reaction.
 */
export class Action<T> extends ScheduledTrigger<T> implements Read<T> {
  readonly origin: Origin;

  readonly minDelay: TimeValue;

  readonly minInterArrival: TimeValue = defaultMIT;

  public get(): T | Absent {
    if (this.isPresent()) {
      return this.value;
    } else {
      return undefined;
    }
  }

  public asSchedulable(key: symbol | undefined): Sched<T> {
    if (this._key === key) {
      return this.scheduler;
    }
    throw Error("Invalid reference to container.");
  }

  public getManager(key: symbol | undefined): TriggerManager {
    if (this._key === key) {
      return this.manager;
    }
    throw Error("Unable to grant access to manager.");
  }

  protected scheduler = new (class<T> extends SchedulableAction<T> {
    get(): T | undefined {
      return this.action.get();
    }

    constructor(private readonly action: Action<T>) {
      super();
    }

    schedule(extraDelay: 0 | TimeValue, value: T, intendedTag?: Tag): void {
      if (!(extraDelay instanceof TimeValue)) {
        extraDelay = TimeValue.zero();
      }

      let tag = this.action.runtime.util.getCurrentTag();
      const delay = this.action.minDelay.add(extraDelay);

      tag = tag.getLaterTag(delay);

      if (this.action.origin === Origin.physical) {
        tag = new Tag(getCurrentPhysicalTime(), 0).getLaterTag(delay);
      } else if (this.action instanceof FederatePortAction) {
        if (intendedTag === undefined) {
          throw new Error(
            "Logical FederatedPortAction must have an intended tag from RTI."
          );
        }
        if (
          !this.action.runtime.util.isLastTAGProvisional() &&
          !intendedTag.isGreaterThan(this.action.runtime.util.getCurrentTag())
        ) {
          throw new Error(
            `Intended tag must be greater than current tag. Intended tag: ${String(
              intendedTag
            )}` +
              ` Current tag: ${String(
                this.action.runtime.util.getCurrentTag()
              )}`
          );
        }
        if (
          this.action.runtime.util.isLastTAGProvisional() &&
          !intendedTag.isGreaterThanOrEqualTo(
            this.action.runtime.util.getCurrentTag()
          )
        ) {
          throw new Error(
            "Intended tag must be greater than or equal to current tag" +
              `, when the last TAG is provisional. Intended tag: ${String(
                intendedTag
              )}` +
              ` Current tag: ${String(
                this.action.runtime.util.getCurrentTag()
              )}`
          );
        }
        Log.debug(
          this,
          () =>
            `Using intended tag from RTI, similar to schedule_at_tag(tag) with an intended tag: ${String(
              intendedTag
            )}`
        );
        tag = intendedTag;
      }

      Log.debug(
        this,
        () => `Scheduling ${this.action.origin} action 
                ${String(
                  this.action._getFullyQualifiedName()
                )} with tag: ${tag}`
      );

      this.action.runtime.schedule(new TaggedEvent(this.action, tag, value));
    }
  })(this);

  /**
   * Construct a new action.
   * @param __container__ The reactor containing this action.
   * @param origin Optional. If physical, then the hardware clock on the local
   * platform is used to determine the tag of the resulting event. If logical,
   * the current logical time (plus one microstep) is used as the offset.
   * @param minDelay Optional. Defaults to 0. Specifies the intrinsic delay of
   * any events resulting from scheduling this action.
   * @param minInterArrival Optional. Defaults to 1 nsec. Specifies the minimum
   * intrinsic delay between to occurrences of this action.
   */
  constructor(
    __container__: Reactor,
    origin: Origin,
    minDelay: TimeValue = TimeValue.secs(0),
    minInterArrival: TimeValue = defaultMIT
  ) {
    super(__container__);
    this.origin = origin;
    this.minDelay = minDelay;
  }

  public toString(): string {
    return this._getFullyQualifiedName();
  }
}

export class Startup extends Action<unknown> {
  // FIXME: this should not be a schedulable trigger, just a trigger
  constructor(__parent__: Reactor) {
    super(__parent__, Origin.logical);
  }
}

export class Shutdown extends Action<unknown> {
  constructor(__parent__: Reactor) {
    super(__parent__, Origin.logical);
  }
}

export class Dummy extends Action<unknown> {
  constructor(__parent__: Reactor) {
    super(__parent__, Origin.logical);
  }
}

export class FederatePortAction<T> extends Action<T> {
  constructor(
    __parent__: Reactor,
    origin: Origin,
    minDelay: TimeValue = TimeValue.zero()
  ) {
    super(__parent__, origin, minDelay);
  }
}
