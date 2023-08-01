import {
  Component,
  type Variable,
  type Reactor,
  type Runtime,
  type Absent,
  type TaggedEvent,
  type Reaction,
  type Tag
} from "./internal";

export interface TriggerManager {
  getContainer: () => Reactor;
  addReaction: (reaction: Reaction<Variable[]>) => void;
  delReaction: (reaction: Reaction<Variable[]>) => void;
}

/**
 * Abstract class for a trigger. A trigger may be an action, port, or timer.
 */
export abstract class Trigger extends Component {
  /**
   * Reactions to trigger.
   */
  protected reactions = new Set<Reaction<Variable[]>>();

  /**
   * Request the manager of this trigger. The request will only be honored
   * if the correct key is given. Each component has a unique symbol (a key)
   * that is handed to the owner upon instantiation of the component. If the
   * wrong key is supplied, return undefined.
   * @param key The private key embedded in this trigger.
   */
  abstract getManager(key: symbol | undefined): TriggerManager;

  /**
   * Return whether or not this trigger is present.
   */
  abstract isPresent(): boolean;

  public getContainer(): Reactor {
    return this._getContainer();
  }
}

/**
 *
 */
export abstract class ScheduledTrigger<T> extends Trigger {
  protected value: T | Absent = undefined;

  protected tag: Tag | undefined;

  protected runtime!: Runtime;

  constructor(container: Reactor) {
    super(container);
    this._linkToRuntimeObject();
  }

  /**
   * Update the current value of this timer in accordance with the given
   * event, and trigger any reactions that list this timer as their trigger.
   * @param e Timestamped event.
   */
  public update(e: TaggedEvent<T>): void {
    if (!e.tag.isSimultaneousWith(this.runtime.util.getCurrentTag())) {
      throw new Error("Time of event does not match current logical time.");
    }
    if (e.trigger === this) {
      this.value = e.value;
      this.tag = e.tag;
      for (const r of this.reactions) {
        this.runtime.stage(r);
      }
    } else {
      throw new Error("Attempt to update action using incompatible event.");
    }
  }

  public getManager(key: symbol | undefined): TriggerManager {
    if (this._key === key) {
      return this.manager;
    }
    throw Error("Unable to grant access to manager.");
  }

  /**
   * Returns true if this action was scheduled for the current
   * logical time. This result is not affected by whether it
   * has a value.
   */
  public isPresent(): boolean {
    if (this.tag === undefined) {
      // This action has never been scheduled before.
      return false;
    }
    if (this.tag.isSimultaneousWith(this.runtime.util.getCurrentTag())) {
      return true;
    } else {
      return false;
    }
  }

  protected manager = new (class implements TriggerManager {
    constructor(private readonly trigger: ScheduledTrigger<T>) {}

    getContainer(): Reactor {
      return this.trigger._getContainer();
    }

    addReaction(reaction: Reaction<Variable[]>): void {
      this.trigger.reactions.add(reaction);
    }

    delReaction(reaction: Reaction<Variable[]>): void {
      this.trigger.reactions.delete(reaction);
    }
  })(this);

  public _receiveRuntimeObject(runtime: Runtime): void {
    if (this.runtime == null) {
      this.runtime = runtime;
    } else {
      throw new Error("Can only establish link to runtime once.");
    }
  }
}

// FIXME(marten): move these to trigger.ts and let them extend trigger
