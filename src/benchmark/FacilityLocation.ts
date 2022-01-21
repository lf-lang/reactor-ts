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
    public clone(): Point {
        return new Point(this.x, this.y)
    }
    public getDistance(p: Point): number {
        let xDiff = p.x - this.x;
        let yDiff = p.y - this.y;
        let distance = Math.sqrt((xDiff * xDiff) + (yDiff * yDiff));
        return distance;
    }
    public toString(): string {
        return `Point (x: ${this.x}, y: ${this.y})`
    }
    public static random(gridSize: number): Point {
        return new Point(Math.random() * gridSize, Math.random() * gridSize)
    }
}

class Box {
    x1: number
    y1: number
    x2: number
    y2: number
    constructor(x1: number, y1: number, x2: number, y2: number) {
        this.x1 = x1
        this.y1 = y1
        this.x2 = x2
        this.y2 = y2
    }
    public contains(p: Point): boolean {
        return this.x1 <= p.x && this.y1 <= p.y && p.x <= this.x2 && p.y <= this.y2
    }
    public midPoint(): Point {
        return new Point((this.x1 + this.x2) / 2, (this.y1 + this.y2) / 2);
    }
}

enum Position {
    UNKNOWN = -2,
    ROOT = -1,
    TOP_LEFT = 0,
    TOP_RIGHT = 1,
    BOT_LEFT = 2,
    BOT_RIGHT = 3,
}

abstract class Msg {}

class FacilityMsg extends Msg {
    positionRelativeToParent: Position
    depth: number
    point: Point
    fromChild: boolean
    constructor(positionRelativeToParent: Position,
        depth: number,
        point: Point,
        fromChild: boolean) {
            super()
            this.positionRelativeToParent = positionRelativeToParent
            this.depth = depth
            this.point = point
            this.fromChild = fromChild
        }
}

class NextCustomerMsg extends Msg {}

class CustomerMsg extends Msg {
    // The producer variable is not needed since hasQuadrantProducer
    // is used to determin whether a quadrant producer (parent) exists and
    // toProducer is used for a port to the producer.
    point: Point
    constructor(point: Point) {
            super()
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

// Top level producer reactor that is not a quadrant.
export class Producer extends Reactor {
    // TODO(hokeun): Consider using NextCustomerMsg from the rootQuadrant as a trigger
    // instead of using this nextCustomer action with some delay.
    // Without some delay, it will become a zero-dely loop.
    // Note that either way we can implement the benchmark correctly.
    // It will be just a matter of style (using actions vs. messages).
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
                    toConsumer.set(new CustomerMsg(Point.random(gridSize.get())))
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

// Global helper functions used by both the Quadrant reactor's constructor and reaction.
function findCost(point: Point,
        localFacilities: State<Array<Point>>): number {
    let result = Number.MAX_VALUE
    localFacilities.get().forEach(loopPoint => {
        let distance = loopPoint.getDistance(point)
        if (distance < result) {
            result = distance
        }
    });
    return result
}
function addCustomer(point: Point,
        localFacilities: State<Array<Point>>,
        supportCustomers: State<Array<Point>>,
        totalCost: State<number>): void {
    supportCustomers.get().push(point.clone())
    let minCost = findCost(point, localFacilities)
    totalCost.set(totalCost.get() + minCost)
    console.log(`minCost: ${minCost}, totalCost: ${totalCost.get()}`)
}

export class Quadrant extends Reactor {
    // Parameters.
    hasQuadrantProducer: Parameter<boolean> // Only the rootQuadrant doesn't have quadrant producer.
    positionRelativeToParent: Parameter<Position>
    threshold: Parameter<number>
    depth: Parameter<number>
    fromProducer: InPort<Msg> = new InPort(this)
    toProducer: OutPort<Msg> = new OutPort(this)

    // States.
    facility: State<Point>
    localFacilities: State<Array<Point>> = new State(new Array<Point>()) 
    knownFacilities: State<number> = new State(0)
    maxDepthOfKnownOpenFacility: State<number> = new State(0)
    supportCustomers: State<Array<Point>> = new State(new Array<Point>()) 
    // hasChildren, firstChild, secondChild, thirdChild, fourthChild are used for
    // children in Akka actor implementation.
    hasChildren: State<boolean> = new State(false)
    totalCost: State<number> = new State(0)

    constructor (parent:Reactor,
            hasQuadrantProducer: boolean,
            positionRelativeToParent: Position,
            boundary: Box,
            threshold: number,
            depth: number,
            initLocalFacilities: Array<Point>,
            initKnownFacilities: number,
            initMaxDepthOfKnownOpenFacility: number,
            initCustomers: Array<Point>) {
        super(parent)
        this.hasQuadrantProducer = new Parameter(hasQuadrantProducer)
        this.positionRelativeToParent = new Parameter(positionRelativeToParent)
        this.threshold = new Parameter(threshold)
        this.facility = new State<Point>(boundary.midPoint())
        this.depth = new Parameter(depth)
        initLocalFacilities.forEach(val => this.localFacilities.get().push(val))
        this.localFacilities.get().push(this.facility.get())
        this.localFacilities.get().forEach(val => console.log(`Element: ${val}`))
        this.knownFacilities.set(initKnownFacilities)
        this.maxDepthOfKnownOpenFacility.set(initMaxDepthOfKnownOpenFacility)
        initCustomers.forEach(val => {
            if (boundary.contains(val)) {
                addCustomer(val, this.localFacilities, this.supportCustomers, this.totalCost)
            }
        })

        // Main reaction for QuadrantActor.process() of Akka implementation
        this.addReaction(
            new Triggers(this.fromProducer),
            new Args(
                this.hasQuadrantProducer,
                this.positionRelativeToParent,
                this.threshold,
                this.facility,
                this.depth,
                this.fromProducer,
                this.writable(this.toProducer),
                this.localFacilities,
                this.supportCustomers,
                this.totalCost,
                this.hasChildren),
            function (this,
                    hasQuadrantProducer,
                    positionRelativeToParent,
                    threshold,
                    facility,
                    depth,
                    fromProducer,
                    toProducer,
                    localFacilities,
                    supportCustomers,
                    totalCost,
                    hasChildren) {
                // Helper functions
                let notifyParentOfFacility = function(p: Point): void {
                    if (hasQuadrantProducer.get()) {
                        toProducer.set(new FacilityMsg(
                            positionRelativeToParent.get(), depth.get(), p, true))
                    }
                }
                let partition = function(): void {
                    console.log("Partition is called.")
                    notifyParentOfFacility(facility.get().clone())
                    // TODO(hokeun): Implement partition().
                }

                // Reaction
                let msg = fromProducer.get()
                switch (msg?.constructor) {
                    case CustomerMsg:
                        if (!hasChildren.get()) {
                            // No open facility, thus, addCustomer(), then partition().
                            let point = (<CustomerMsg>msg).point;
                            addCustomer(point, localFacilities, supportCustomers, totalCost)
                            if (totalCost.get() > threshold.get()) {
                                partition()
                            }
                        } else {
                            // A facility is already open, propagate customer to correct child.
                            // TODO(hokeun): Implement this part.
                        }
                        console.log(`Received CustomerMsg: ${(<CustomerMsg>msg).point}`)
                        break
                    default:
                        console.log("Error: Recieved unknown message.")
                        this.util.requestErrorStop()
                        break
                }
            }
        )
    }
}

export class FacilityLocation extends App {
    producer: Producer
    rootQuadrant: Quadrant
    constructor (name: string, timeout: TimeValue | undefined = undefined, keepAlive: boolean = false, fast: boolean = false, success?: () => void, fail?: () => void) {
        super(timeout, keepAlive, fast, success, fail);
        // TODO(hokeun): Change default for numPoints to 100000.
        let NUM_POINTS = 10
        let GRID_SIZE = 500
        let F = Math.sqrt(2) * GRID_SIZE
        let ALPHA = 2.0

        this.producer = new Producer(this, NUM_POINTS, GRID_SIZE, TimeValue.nsec(1))

        // TODO(hokeun): Set hasQuadrantProducer = true for other quadrants.
        // TODO(hokeun): Use an empty array, i.e., new Array<Point>(), for initLocalFacilities and initCustomers.
        this.rootQuadrant = new Quadrant(this,
                false, // hasQuadrantProducer
                Position.ROOT, // positionRelativeToParent
                new Box(0, 0, GRID_SIZE, GRID_SIZE), // boundry
                ALPHA * F, // threshold
                0, // depth
                [new Point(1, 2), new Point(3, 4)] ,// initLocalFacilities
                1, // initKnownFacilities
                -1, //initMaxDepthOfKnownOpenFacility
                [new Point(12, 34), new Point(56, 78)] // initCustomers
            )
        this._connect(this.producer.toConsumer, this.rootQuadrant.fromProducer)
    }
}

// ************* Instance FacilityLocation of class FacilityLocation
let _app = new FacilityLocation('FacilityLocation', undefined, false, true)
// ************* Starting Runtime for FacilityLocation of class FacilityLocation
_app._start();
