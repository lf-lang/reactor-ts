import type {Read, ReactionSandbox} from "../core/internal";
import {Reactor, Triggers, Args, InPort, State} from "../core/internal";

function print(
  this: ReactionSandbox,
  i: Read<unknown>,
  expected: State<unknown>
): void {
  const received = i.get();
  if (received != null) {
    console.log(`Logging: ${received}`);
    if (received === expected.get()) {
      this.util.requestStop();
    } else {
      this.util.requestErrorStop(
        `Expected${expected.get()} but got ${received}`
      );
    }
  } else {
    throw new Error(
      "Log had no input available. This shouldn't happen because the logging reaction is triggered by the input"
    );
  }
}

export class Logger extends Reactor {
  i = new InPort(this);

  constructor(parent: Reactor, expected: unknown) {
    super(parent);
    this.addReaction(
      new Triggers(this.i),
      new Args(this.i, new State(expected)),
      print
    );
  }
}
