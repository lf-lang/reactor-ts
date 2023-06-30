import {type TimeValue, Tuple} from "../core/internal";
import {
  Log,
  Parameter,
  CalleePort,
  CallerPort,
  Timer,
  Reactor,
  App
} from "../core/internal";

Log.global.level = Log.levels.ERROR;

export class Ping extends Reactor {
  count: Parameter<number>;

  client: CallerPort<number, number>;

  constructor(parent: Reactor, count = 100000) {
    super(parent);
    this.count = new Parameter(count); // Parameter
    this.client = new CallerPort(this);
    this.addReaction(
      new Tuple(this.startup),
      new Tuple(this.client, this.count),
      function (
        this,
        __client: CallerPort<number, number>,
        count: Parameter<number>
      ) {
        const startTime = this.util.getCurrentPhysicalTime();
        let pingsLeft = count.get();
        while (pingsLeft > 0) {
          // console.log("Ping!")
          const ret = __client.invoke(pingsLeft);
          if (ret !== 0) pingsLeft -= 1;
        }
        const elapsedTime = this.util
          .getCurrentPhysicalTime()
          .subtract(startTime);
        console.log(`Elapsed time: ${elapsedTime}`);
        // this.util.requestShutdown();
      }
    );
    this.addReaction(
      new Tuple(this.startup),
      new Tuple(this.client, this.count),
      function (
        this,
        __client: CallerPort<number, number>,
        count: Parameter<number>
      ) {
        // Dummy
      }
    );
  }
}

export class Pong extends Reactor {
  server: CalleePort<number, number>;

  dummy: Timer = new Timer(this, 0, 0);

  constructor(parent: Reactor) {
    super(parent);
    this.server = new CalleePort(this);
    this.addReaction(
      new Tuple(this.dummy),
      new Tuple(this.dummy),
      function (this) {
        return undefined;
      }
    );
    this.addReaction(
      new Tuple(this.server),
      new Tuple(this.server),
      function (this, __server: CalleePort<number, number>) {
        // console.log("Pong!")
        const msg = __server.get();
        // TODO (axmmisaka): the old behaviour is if msg is falsy; i.e. undefined or 0.
        if (msg !== undefined) __server.return(msg);
      }
    );
    this.addReaction(
      new Tuple(this.dummy), // replace this with `server` and an error is thrown.
      new Tuple(this.dummy),
      function (this) {
        return undefined;
      }
    );
  }
}

export class PingPong extends App {
  ping: Ping;

  pong: Pong;

  constructor(
    name: string,
    timeout: TimeValue | undefined = undefined,
    keepAlive = false,
    fast = false,
    success?: () => void,
    fail?: () => void
  ) {
    super(timeout, keepAlive, fast, success, fail);
    this.ping = new Ping(this, 1000000); // 1000000
    this.pong = new Pong(this);
    this._connectCall(this.ping.client, this.pong.server);
  }
}
// =============== END reactor class PingPong

// ************* Instance PingPong of class PingPong
const _app = new PingPong("PingPong", undefined, false, true);
// ************* Starting Runtime for PingPong of class PingPong
_app._start();
