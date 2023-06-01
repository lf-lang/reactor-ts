import { Reactor, App, Triggers, Args, Timer, OutPort, InPort, TimeUnit, TimeValue, Origin, Log, LogLevel, Action } from '../src/core/internal';

/* Set a port in startup to get thing going */
class Starter extends Reactor {
  public out = new OutPort<number>(this);

  constructor (parent: Reactor | null) {
    super(parent);
    this.addReaction(
      new Triggers(this.startup),
      new Args(this.writable(this.out)),
      function (this, __out) {
        __out.set(4);
      }
    );
  }
}

/* A reactor with a deadline in its constructor */
class R1 extends Reactor {
  public in = new InPort<number>(this);
  public out = new OutPort<number>(this);

  constructor (parent: Reactor | null, deadline: TimeValue, deadlineMiss?: () => void) {
    super(parent);
    this.addReaction(
      new Triggers(this.in),
      new Args(this.in, this.writable(this.out)),
      function (this, __in, __out) {
        const util = this.util;
        const initialElapsedTime = util.getElapsedPhysicalTime();
        const tmp = __in.get();

        if (tmp != null) {
          console.log('Received ' + tmp.toString());
        }

        let out = 0;

        try {
          // let sleep_time =  new UnitBasedTimeValue(2, TimeUnit.sec);
          // let startTime = util.getCurrentPhysicalTime();
          // let finishTime = startTime.add(sleep_time)
          // // Busy wait
          // while(util.getCurrentPhysicalTime().isEarlierThan(finishTime));

          while (util.getElapsedPhysicalTime().isEarlierThan(initialElapsedTime.add(TimeValue.withUnits(1, TimeUnit.sec))));
        } finally {
          if (tmp != null) {
            out = tmp + 4;
          }
          if (out != null) {
            console.log('Sending ' + out.toString());
            __out.set(out);
          }
        }
      },
      deadline,
      deadlineMiss

    );
  }
}

class R2 extends Reactor {
  public in = new InPort<number>(this);

  constructor (parent: Reactor | null, deadline?: TimeValue, deadlineMiss?: () => void) {
    super(parent);
    this.addReaction(
      new Triggers(this.in),
      new Args(this.in),
      function (this, __in) {
        const tmp = __in.get();
        /* Do Nothing */
        try {
          if (tmp != null) {
            console.log('Received ' + tmp.toString());
          }
        } finally { /* empty */ }
      },
      deadline,
      deadlineMiss

    );
  }
}

class TestApp extends App {
  start: Starter;
  reactor1: R1;
  reactor2: R2;

  constructor (name: string, timeout: TimeValue, success?: () => void, fail?: () => void, deadlineMiss?: () => void, secondTimeout?: TimeValue) {
    super(timeout, false, false, success, fail);
    this.start = new Starter(this);
    this.reactor1 = new R1(this, timeout, deadlineMiss);
    this.reactor2 = new R2(this, secondTimeout, deadlineMiss);
    this._connect(this.start.out, this.reactor1.in);
    this._connect(this.reactor1.out, this.reactor2.in);
  }
}

class ReactorWithAction extends App {
  a = new Action<number>(this, Origin.logical);
  t = new Timer(this, TimeValue.withUnits(1, TimeUnit.msec), TimeValue.withUnits(1, TimeUnit.sec));

  constructor (name: string, timeout: TimeValue, success?: () => void, fail?: () => void, deadlineMiss?: () => void) {
    super(timeout, false, false, success, fail);
    this.addReaction(
      new Triggers(this.t),
      new Args(this.schedulable(this.a)),
      function (this, a) {
        a.schedule(0, 1);
      }
    );
  }
}

describe('Testing deadlines', function () {
  jest.setTimeout(5000);

  it('Missed reaction deadline on InPort', done => {
    Log.global.level = LogLevel.WARN;

    function fail (): void {
      throw new Error('Test has failed.');
    }

    const app = new TestApp('testApp', TimeValue.withUnits(1, TimeUnit.nsec), done, fail);

    // spyOn(app, '_start').and.callThrough

    // expect(() => {app._start()}).toThrowError("Deadline violation occurred!");

    /* FIXME: Deadlines are not working */
    app._start();
  });

  it('Missed reaction deadline on the second reaction in the chain', done => {
    // let consoleOutput: string[] = []

    Log.global.level = LogLevel.WARN;

    function fail (): void {
      throw new Error('Test has failed.');
    }

    const app = new TestApp('testApp', TimeValue.nsecs(1), done, fail, undefined, TimeValue.nsecs(1));

    // const spy = jest.spyOn(global.console, 'warn').mockImplementation(warn => {
    //         consoleOutput.push(warn);
    //         global.console.error("Deadline missed!");
    //         done();
    //     }
    //     );

    console.log(app.toString());

    app._start();

    // expect(consoleOutput).toEqual(["Deadline missed!"]);

    // spy.mockRestore()
  });

  it('Missed deadline with custom message', done => {
    Log.global.level = LogLevel.WARN;

    // let deadlineMissed:string = ""

    function fail (): void {
      throw new Error('Test has failed.');
    }

    const app = new TestApp('testApp', TimeValue.withUnits(1, TimeUnit.nsec), done, fail, () => { Log.global.warn('Deadline missed!'); }, TimeValue.withUnits(1, TimeUnit.nsec));

    app._start();

    // expect(deadlineMissed).toEqual("Deadline missed!");

    // expect(consoleOutput).toEqual(expect.arrayContaining(expect.objectContaining('Deadline missed!')));
    // expect(consoleOutput).toContain('Deadline missed!');
  });
});

describe('Testing Reactions', function () {
  function fail (): void {
    throw new Error('Test has failed.');
  }

  it('Manually call reactions', () => {
    const app = new TestApp('testApp', TimeValue.withUnits(5000, TimeUnit.msec), () => (undefined), fail);

    /* FIXME: Find a way to manually test reactors */
    /* let reactions = app.reactor1._getReactions();

        reactions.forEach( function (reaction) {
            reaction.doReact();
        });
 */
  });

  it('Mutate a reaction', () => {
    return undefined;
  });
});

describe('Testing Actions', function () {
  it('Mismatched logical time', () => {
    Log.global.level = LogLevel.WARN;

    function fail (): void {
      throw new Error('Test has failed.');
    }

    /* FIXME: Deadlines are not working. Jest throws timeout error before LF */
    // let app = new ReactorWithAction("testApp", TimeValue.secs(1,TimeUnit.sec), done, fail)

    /* FIXME: Deadlines are not working */
    // app._start();
  });
});
