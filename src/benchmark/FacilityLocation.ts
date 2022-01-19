import {Args, Parameter, OutPort, InPort, Triggers, Timer, Reactor, App } from "../core/reactor";
import {TimeValue} from "../core/time"
import {Log} from "../core/util"

Log.global.level = Log.levels.INFO;

class Point {
    x: number
    y: number
    constructor(x: number, y: number) {
            this.x = x
            this.y = y
    }
}

export class Producer extends Reactor {
    out: OutPort<Point> = new OutPort(this);
    constructor (parent:Reactor) {
        super(parent)
        this.addReaction(
            new Triggers(this.startup),
            new Args(this.writable(this.out)),
            function (this, out) {
                var startTime = this.util.getCurrentPhysicalTime()
                out.set(new Point(12.345, 67.89))
                let elapsedTime = this.util.getCurrentPhysicalTime().subtract(startTime)
                console.log("Elapsed time: " + elapsedTime)
            }
        )
    }
}

export class Quadrant extends Reactor {
    in: InPort<Point> = new InPort(this)
    constructor (parent:Reactor) {
        super(parent)
        this.addReaction(
            new Triggers(this.in),
            new Args(this.in),
            function (this, __in) {
                let v = __in.get()
                console.log("Input x: " + v?.x)
                console.log("Input y: " + v?.y)
            }
        )
    }
}

export class FacilityLocation extends App {
    producer: Producer
    quadrant: Quadrant
    constructor (name: string, timeout: TimeValue | undefined = undefined, keepAlive: boolean = false, fast: boolean = false, success?: () => void, fail?: () => void) {
        super(timeout, keepAlive, fast, success, fail);
        this.producer = new Producer(this) //1000000
        this.quadrant = new Quadrant(this)
        this._connect(this.producer.out, this.quadrant.in)
    }
}

// ************* Instance FacilityLocation of class FacilityLocation
let _app = new FacilityLocation('FacilityLocation', undefined, false, true)
// ************* Starting Runtime for FacilityLocation of class FacilityLocation
_app._start();
