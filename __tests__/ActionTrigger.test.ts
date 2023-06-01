import { App, Triggers, Args, Origin, TimeValue, Reactor, Timer, type Sched, Action } from '../src/core/internal';

// Upon initialization, this reactor should produce an
// output event
export class ActionTrigger extends Reactor {
  t1: Timer = new Timer(this, 0, 0);

  // This action is scheduled with a value.
  a1: Action<string> = new Action<string>(this, Origin.logical);

  // This action is never scheduled. It should never be present.
  a2: Action<string> = new Action<string>(this, Origin.logical);

  constructor (parent: Reactor | null) {
    super(parent);
    // Reaction priorities matter here. The overridden reaction must go first.
    this.addReaction(
      new Triggers(this.t1), new Args(this.schedulable(this.a1)),
      /**
             * Schedule the incorrect payload for action a1.
             */
      function (this, a1: Sched<string>) {
        a1.schedule(0, 'goodbye');
        console.log('Scheduling the overridden action in ScheduleOverriddenAction to trigger RespondToAction');
      }
    );

    this.addReaction(
      new Triggers(this.t1),
      new Args(this.schedulable(this.a1), this.a2),
      /**
             * Schedule the correct payload for action a1.
             */
      function (this, a1) {
        a1.schedule(0, 'hello');
        console.log('Scheduling the final action in ScheduleAction to trigger RespondToAction');
      }
    );

    this.addReaction(
      new Triggers(this.a1),
      new Args(this.a1, this.a2),
      /**
             * If the action payload is correct, test is successful. Otherwise it fails.
             * Since a2 was not scheduled it should return null on a call to get() and
             * should return false for isPresent().
             */
      function (this, a1: Action<string>, a2: Action<string>) {
        const msg = a1.get();
        const absent = !a2.get();
        if (msg == 'hello' && absent) {
          this.util.requestStop();
        } else {
          this.util.requestErrorStop(msg);
        }
        console.log('Response to action is reacting. String payload is: ' + msg);
      }
    );
  }
}

class ActionTriggerTest extends App {
  aTrigger: ActionTrigger;

  constructor (timeout: TimeValue, success?: () => void, fail?: () => void) {
    super(timeout, false, false, success, fail);
    this.aTrigger = new ActionTrigger(this);
  }
}

describe('ActionTrigger', function () {
  // Ensure the test will run for no more than 5 seconds.
  jest.setTimeout(5000);

  it('start runtime', done => {
    function failure () {
      throw new Error('Reactor has failed.');
    }

    // Tell the reactor runtime to successfully terminate after 3 seconds.
    const aTriggerTest = new ActionTriggerTest(TimeValue.secs(3), done, failure);
    // Don't give the runtime the done callback because we don't care if it terminates
    aTriggerTest._start();
  });
});
