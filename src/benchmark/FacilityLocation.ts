/**
 * Typescript runtime implementation of Online Facility Location benchmark program
 * of Savina benchmark suite.
 * 
 * @author Hokeun Kim (hokeunkim@berkeley.edu)
 */
import {Args, Parameter, OutPort, InPort, State, Triggers, Action, Timer, Reactor, App} from "../core/reactor";
import {TimeValue, Origin} from "../core/time"
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
    nextCustomer: Action<NextCustomerMsg>
    numPoints: Parameter<number>
    gridSize: Parameter<number>
    toConsumer: OutPort<Msg> = new OutPort(this)
    itemsProduced: State<number> = new State(0)
    // TODO(hokeun): Change default for numPoints to 100000.
    constructor (parent:Reactor, numPoints: number = 10, gridSize: number = 500, period: TimeValue) {
        super(parent)
        this.numPoints = new Parameter(numPoints)
        this.gridSize = new Parameter(gridSize)
        this.nextCustomer = new Action<NextCustomerMsg>(this, Origin.logical, period)
        this.addReaction(
            new Triggers(this.startup, this.nextCustomer),
            new Args(this.schedulable(this.nextCustomer), this.numPoints, this.gridSize, this.writable(this.toConsumer), this.itemsProduced),
            function (this, nextCustomer, numPoints, gridSize, toConsumer, itemsProduced) {
                if (itemsProduced.get() < numPoints.get()) {
                    // Send CustomerMsg to the consumer.
                    // `this` is reaction, and parent is reactor containing this reaction.
                    toConsumer.set(new CustomerMsg(parent, new Point(Math.random() * gridSize.get(), Math.random() * gridSize.get())))
                    // Increase itemsProduced by 1.
                    itemsProduced.set(itemsProduced.get() + 1)
                    // Schedule next customer (NextCustomerMsg).
                    nextCustomer.schedule(0, new NextCustomerMsg())
                } else {
                    this.util.requestStop()
                }
            }
        )
    }
}

export class Quadrant extends Reactor {
    fromParent: InPort<Msg> = new InPort(this)
    constructor (parent:Reactor) {
        super(parent)
        this.addReaction(
            new Triggers(this.fromParent),
            new Args(this.fromParent),
            function (this, fromParent) {
                let msg = fromParent.get()
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
        // TODO(hokeun): Change default for numPoints to 100000.
        this.producer = new Producer(this, 10, 500, TimeValue.nsec(1))
        this.quadrant = new Quadrant(this)
        this._connect(this.producer.toConsumer, this.quadrant.fromParent)
    }
}

// ************* Instance FacilityLocation of class FacilityLocation
let _app = new FacilityLocation('FacilityLocation', undefined, false, true)
// ************* Starting Runtime for FacilityLocation of class FacilityLocation
_app._start();
