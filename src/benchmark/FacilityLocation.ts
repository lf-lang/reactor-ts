import {Args, Parameter, OutPort, InPort, State, Triggers, Timer, Reactor, App} from "../core/reactor";
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

abstract class Msg {}

class FacilityMsg extends Msg {
    positionRelativeToParent: number
    depth: number
    point: Point
    fromChild: Boolean
    constructor(positionRelativeToParent: number,
        depth: number,
        point: Point,
        fromChild: Boolean) {
            super()
            this.positionRelativeToParent = positionRelativeToParent
            this.depth = depth
            this.point = point
            this.fromChild = fromChild
        }
}

class NextCustomerMsg extends Msg {}

class CustomerMsg extends Msg {
    producer: Reactor
    point: Point
    constructor(producer: Reactor,
        point: Point) {
            super()
            this.producer = producer
            this.point = point
        }
}

class RequestExitMsg extends Msg {}

class ConfirmExitMsg extends Msg {
    facilities: number
    supportCustomers: number
    constructor(facilities: number,
        supportCustomers: number) {
            super()
            this.facilities = facilities
            this.supportCustomers = supportCustomers
        }
}

export class Producer extends Reactor {
    out: OutPort<Msg> = new OutPort(this)
    itemsProduced: State<number> = new State(0)
    constructor (parent:Reactor) {
        super(parent)
        this.addReaction(
            new Triggers(this.startup),
            new Args(this.writable(this.out)),
            function (this, out) {
                var startTime = this.util.getCurrentPhysicalTime()
                // `this` is reaction, and parent is reactor containing this reaction.
                out.set(new CustomerMsg(parent, new Point(12.345, 67.89)))
                let elapsedTime = this.util.getCurrentPhysicalTime().subtract(startTime)
                console.log("Elapsed time: " + elapsedTime)
            }
        )
    }
}

export class Quadrant extends Reactor {
    in: InPort<Msg> = new InPort(this)
    constructor (parent:Reactor) {
        super(parent)
        this.addReaction(
            new Triggers(this.in),
            new Args(this.in),
            function (this, __in) {
                let msg = __in.get()
                switch (msg?.constructor) {
                    case CustomerMsg:
                        console.log("Received CustomerMsg.")
                        console.log("Point x: " + (<CustomerMsg>msg).point.x)
                        console.log("Point y: " + (<CustomerMsg>msg).point.y)
                        break
                    default:
                        console.log("Error: Recieved unknown message.")
                        break
                }
            }
        )
    }
}

export class FacilityLocation extends App {
    producer: Producer
    quadrant: Quadrant
    constructor (name: string, timeout: TimeValue | undefined = undefined, keepAlive: boolean = false, fast: boolean = false, success?: () => void, fail?: () => void) {
        super(timeout, keepAlive, fast, success, fail);
        this.producer = new Producer(this)
        this.quadrant = new Quadrant(this)
        this._connect(this.producer.out, this.quadrant.in)
    }
}

// ************* Instance FacilityLocation of class FacilityLocation
let _app = new FacilityLocation('FacilityLocation', undefined, false, true)
// ************* Starting Runtime for FacilityLocation of class FacilityLocation
_app._start();
