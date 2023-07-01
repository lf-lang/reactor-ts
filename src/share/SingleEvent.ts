import {
  type Write,
  type ReactionSandbox,
  type Parameter,
  Reactor,
  Timer,
  OutPort
} from "../core/internal";

function produceOutput<S>(
  this: ReactionSandbox,
  o: Write<S>,
  payload: Parameter<S>
): void {
  o.set(payload.get());

  // FIXME: create a test that actually tests double sets.
  // It's confusing to have SingleEvent be a DoubleEvent.
  // Duplicate sets for the same port is bad form,
  // but its worth checking that the correct value (from the last set)
  // is delivered.
  console.log("Writing payload to SingleEvent's output.");
}

export class SingleEvent<T> extends Reactor {
  o: OutPort<T> = new OutPort<T>(this);

  t1: Timer = new Timer(this, 0, 0);

  constructor(parent: Reactor, private readonly payload: Parameter<T>) {
    super(parent);
    this.addReaction(
      [this.t1],
      [this.writable(this.o), this.payload],
      produceOutput
    );
  }
}
