/**
 * Typescript runtime implementation of Online Facility Location benchmark program
 * of Savina benchmark suite.
 * 
 * @author Hokeun Kim (hokeunkim@berkeley.edu)
 */
import {Log, TimeValue, Origin, Args, Parameter, OutPort, InPort, State, Triggers, Action, Reactor, App, WritablePort} from "../core/internal";

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
    public static arrayClone(points: Point[]): Point[] {
        let newPoints = new Array<Point>()
        points.forEach(val => newPoints.push(val.clone()))
        return newPoints
    }
    public toString(): string {
        return `Point (x: ${this.x}, y: ${this.y})`
    }
    public getDistance(p: Point): number {
        let xDiff = p.x - this.x;
        let yDiff = p.y - this.y;
        let distance = Math.sqrt((xDiff * xDiff) + (yDiff * yDiff));
        return distance;
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
    public clone(): Box {
        return new Box(this.x1, this.y1, this.x2, this.y2)
    }
    public toString(): string {
        return `Box (x1: ${this.x1}, y1: ${this.y1}, x2: ${this.x2}, y2: ${this.y2})`
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
    // This 'quadrantReactors' is additional information for reactor-ts.
    // And it is not in the Akka-version implementation.
    quadrantReactors: number
    constructor(facilities: number,
        supportCustomers: number,
        quadrantReactors: number) {
            super()
            this.facilities = facilities
            this.supportCustomers = supportCustomers
            this.quadrantReactors = quadrantReactors
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
                    // TODO(hokeun): Replace this with sending RequestExitMsg.
                    toConsumer.set(new RequestExitMsg())
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
    // console.log(`minCost: ${minCost}, totalCost: ${totalCost.get()}`)
}

export class Summary extends Reactor {
    fromRootQuadrant: InPort<ConfirmExitMsg> = new InPort(this)
    constructor(parent: Reactor) {
        super(parent)

        this.addReaction(
            new Triggers(this.fromRootQuadrant),
            new Args(this.fromRootQuadrant),
            function(this,
                    fromRootQuadrant) {
                let msgFromRootQuadrant = fromRootQuadrant.get()
                if (msgFromRootQuadrant) {
                    console.log(`Num Facilities: ${msgFromRootQuadrant.facilities}, ` +
                        `Num customers: ${msgFromRootQuadrant.supportCustomers}, ` +
                        `Num quadrant reactors: ${msgFromRootQuadrant.quadrantReactors}`)
                } else {
                    console.log("Summary Error: ConfirmExitMsg from root quadrant is undefined.")
                    this.util.requestStop()
                }
                this.util.requestStop()
            }
        )
    }
}

export class Accumulator extends Reactor {
    // TODO(hokeun): After implementing multiports, change these into a multiport, fromQuadrants.
    fromFirstQuadrant: InPort<ConfirmExitMsg> = new InPort(this)
    fromSecondQuadrant: InPort<ConfirmExitMsg> = new InPort(this)
    fromThirdQuadrant: InPort<ConfirmExitMsg> = new InPort(this)
    fromFourthQuadrant: InPort<ConfirmExitMsg> = new InPort(this)
    toNextAccumulator: OutPort<ConfirmExitMsg> = new OutPort(this)

    constructor(parent: Reactor) {
        super(parent)

        this.addReaction(
            new Triggers(
                this.fromFirstQuadrant,
                this.fromSecondQuadrant,
                this.fromThirdQuadrant,
                this.fromFourthQuadrant),
            new Args(
                this.fromFirstQuadrant,
                this.fromSecondQuadrant,
                this.fromThirdQuadrant,
                this.fromFourthQuadrant,
                this.writable(this.toNextAccumulator)),
            function(this,
                    fromFirstQuadrant,
                    fromSecondQuadrant,
                    fromThirdQuadrant,
                    fromFourthQuadrant,
                    toNextAccumulator) {
                // Reaction.
                if (!fromFirstQuadrant.isPresent() ||
                        !fromSecondQuadrant.isPresent() ||
                        !fromThirdQuadrant.isPresent() ||
                        !fromFourthQuadrant.isPresent()) {
                    console.log("Accumulator Error: some inputs are missing.")
                    this.util.requestStop()
                }
                let msgFromFirstQuadrant = fromFirstQuadrant.get()
                let msgFromSecondQuadrant = fromSecondQuadrant.get()
                let msgFromThirdQuadrant = fromThirdQuadrant.get()
                let msgFromFourthQuadrant = fromFourthQuadrant.get()

                if (msgFromFirstQuadrant && msgFromSecondQuadrant && msgFromThirdQuadrant && msgFromFourthQuadrant) {
                    let numFacilities = msgFromFirstQuadrant.facilities +
                        msgFromSecondQuadrant.facilities +
                        msgFromThirdQuadrant.facilities +
                        msgFromFourthQuadrant.facilities
                    let numCustomers = msgFromFirstQuadrant.supportCustomers +
                        msgFromSecondQuadrant.supportCustomers +
                        msgFromThirdQuadrant.supportCustomers +
                        msgFromFourthQuadrant.supportCustomers
                    let numQuadrantReactors = msgFromFirstQuadrant.quadrantReactors +
                        msgFromSecondQuadrant.quadrantReactors +
                        msgFromThirdQuadrant.quadrantReactors +
                        msgFromFourthQuadrant.quadrantReactors
                    toNextAccumulator.set(
                        new ConfirmExitMsg(
                                numFacilities + 1, // Add one for the facility itself.
                                                   // (A quadrant with four children is considered as one facility in Akka-version implementation.)
                                numCustomers,
                                numQuadrantReactors + 1 // Add one for the quadrant reactor itself.
                            ))
                } else {
                    console.log("Accumulator Error: some input ConfirmExitMsg's are undefined.")
                    this.util.requestStop()
                }
            }

        )
    }
}
export class Quadrant extends Reactor {
    // Parameters.
    hasQuadrantProducer: Parameter<boolean> // Only the rootQuadrant doesn't have quadrant producer.
    positionRelativeToParent: Parameter<Position>
    boundary: Parameter<Box>
    threshold: Parameter<number>
    depth: Parameter<number>
    initLocalFacilities: Parameter<Array<Point>>
    initKnownFacilities: Parameter<number>
    initMaxDepthOfKnownOpenFacility: Parameter<number>
    initCustomers: Parameter<Array<Point>>

    // Input ports.
    fromProducer: InPort<Msg> = new InPort(this)

    // Output ports.
    toProducer: OutPort<Msg> = new OutPort(this)
    // TODO(hokeun): After implementing multiports, change these into a multiport, toChildren.
    toFirstChild: OutPort<Msg> = new OutPort(this)
    toSecondChild: OutPort<Msg> = new OutPort(this)
    toThirdChild: OutPort<Msg> = new OutPort(this)
    toFourthChild: OutPort<Msg> = new OutPort(this)
    // Only the ConfirmExitMsg goes through toAccumulator port.
    toAccumulator: OutPort<ConfirmExitMsg> = new OutPort(this)

    // States.
    facility: State<Point> = new State(new Point(0, 0))
    localFacilities: State<Array<Point>> = new State(new Array<Point>()) 
    knownFacilities: State<number> = new State(0)
    maxDepthOfKnownOpenFacility: State<number> = new State(0)
    supportCustomers: State<Array<Point>> = new State(new Array<Point>()) 
    // hasChildren, firstChild, secondChild, thirdChild, fourthChild are used for
    // children in Akka actor implementation.
    hasChildren: State<boolean> = new State(false)
    childrenBoundaries: State<Array<Box>> = new State(new Array<Box>())
    totalCost: State<number> = new State(0)

    constructor (parent: Reactor,
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
        this.boundary = new Parameter(boundary)
        this.threshold = new Parameter(threshold)
        this.depth = new Parameter(depth)
        this.initLocalFacilities = new Parameter(initLocalFacilities)
        this.initKnownFacilities = new Parameter(initKnownFacilities)
        this.initMaxDepthOfKnownOpenFacility = new Parameter(initMaxDepthOfKnownOpenFacility)
        this.initCustomers = new Parameter(initCustomers)

        // console.log(`New Quadrant actor created. boundary: ${this.boundary.get()}`)

        // Startup reaction for initialization of state variables using given parameters.
        this.addReaction(
            new Triggers(this.startup),
            new Args(
                // Parameters.
                this.boundary,
                this.initLocalFacilities,
                this.initKnownFacilities,
                this.initMaxDepthOfKnownOpenFacility,
                this.initCustomers,
                // States to be initialized.
                this.facility,
                this.localFacilities,
                this.knownFacilities,
                this.maxDepthOfKnownOpenFacility,
                this.supportCustomers,
                // Statie variable totalCost is initialized inside addCustomer().
                this.totalCost),
            function (this,
                    // Parameters.
                    boundary,
                    initLocalFacilities,
                    initKnownFacilities,
                    initMaxDepthOfKnownOpenFacility,
                    initCustomers,
                    // States to be initialized.
                    facility,
                    localFacilities,
                    knownFacilities,
                    maxDepthOfKnownOpenFacility,
                    supportCustomers,
                    totalCost) {
                facility.set((boundary.get().midPoint()))
                initLocalFacilities.get().forEach(val => localFacilities.get().push(val))
                localFacilities.get().push(facility.get())
                // localFacilities.get().forEach(val => console.log(`Element: ${val}`))
                knownFacilities.set(initKnownFacilities.get())
                maxDepthOfKnownOpenFacility.set(initMaxDepthOfKnownOpenFacility.get())
                initCustomers.get().forEach(val => {
                    if (boundary.get().contains(val)) {
                        addCustomer(val, localFacilities, supportCustomers, totalCost)
                    }
                })

                // console.log(`New Quadrant actor initialized. facility: ${facility.get()}`)
            }
        )

        // Main mutation reaction for QuadrantActor.process() of Akka implementation.
        this.addMutation(
            new Triggers(this.fromProducer),
            new Args(
                this.hasQuadrantProducer,
                this.positionRelativeToParent,
                this.boundary,
                this.threshold,
                this.facility,
                this.depth,
                this.fromProducer,
                this.writable(this.toProducer),
                this.writable(this.toFirstChild),
                this.writable(this.toSecondChild),
                this.writable(this.toThirdChild),
                this.writable(this.toFourthChild),
                this.writable(this.toAccumulator),
                this.localFacilities,
                this.knownFacilities,
                this.maxDepthOfKnownOpenFacility,
                this.supportCustomers,
                this.hasChildren,
                this.childrenBoundaries,
                this.totalCost),
            function (this,
                    hasQuadrantProducer,
                    positionRelativeToParent,
                    boundary,
                    threshold,
                    facility,
                    depth,
                    fromProducer,
                    toProducer,
                    toFirstChild,
                    toSecondChild,
                    toThirdChild,
                    toFourthChild,
                    toAccumulator,
                    localFacilities,
                    knownFacilities,
                    maxDepthOfKnownOpenFacility,
                    supportCustomers,
                    hasChildren,
                    childrenBoundaries,
                    totalCost) {
                let thisReactor = this.getReactor()
                let thisMutationSandbox = this

                // Helper functions for mutation reaction.
                let notifyParentOfFacility = function(p: Point): void {
                    if (hasQuadrantProducer.get()) {
                        toProducer.set(new FacilityMsg(
                            positionRelativeToParent.get(), depth.get(), p, true))
                    }
                }
                let partition = function(): void {
                    // console.log(`Quadrant at ${facility.get()} - Partition is called.`)
                    notifyParentOfFacility(facility.get().clone())
                    maxDepthOfKnownOpenFacility.set(
                        Math.max(maxDepthOfKnownOpenFacility.get(), depth.get()))

                    childrenBoundaries.get().push(new Box(boundary.get().x1, facility.get().y, facility.get().x, boundary.get().y2))
                    childrenBoundaries.get().push(new Box(facility.get().x, facility.get().y, boundary.get().x2, boundary.get().y2))
                    childrenBoundaries.get().push(new Box(boundary.get().x1, boundary.get().y1, facility.get().x, facility.get().y))
                    childrenBoundaries.get().push(new Box(facility.get().x, boundary.get().y1, boundary.get().x2, facility.get().y))

                    // console.log(`Children boundaries: ${childrenBoundaries.get()[0]}, ${childrenBoundaries.get()[1]}, ${childrenBoundaries.get()[2]}, ${childrenBoundaries.get()[3]}`)
                    let accumulator = new Accumulator(thisReactor)
                    var toAccumulatorOfQuadrant = (toAccumulator as unknown as WritablePort<Msg>).getPort()
                    // Connect Accumulator's output to Quadrant's output.
                    thisMutationSandbox.connect(accumulator.toNextAccumulator, toAccumulatorOfQuadrant)
                    
                    let firstChild = new Quadrant(
                        thisReactor, true, Position.BOT_LEFT, childrenBoundaries.get()[0], threshold.get(), depth.get() + 1,
                        Point.arrayClone(localFacilities.get()), knownFacilities.get(), maxDepthOfKnownOpenFacility.get(), Point.arrayClone(supportCustomers.get()))
                    var toFirstChildPort = (toFirstChild as unknown as WritablePort<Msg>).getPort()
                    thisMutationSandbox.connect(toFirstChildPort, firstChild.fromProducer)
                    thisMutationSandbox.connect(firstChild.toAccumulator, accumulator.fromFirstQuadrant)

                    let secondChild = new Quadrant(
                        thisReactor, true, Position.TOP_RIGHT, childrenBoundaries.get()[1], threshold.get(), depth.get() + 1,
                        Point.arrayClone(localFacilities.get()), knownFacilities.get(), maxDepthOfKnownOpenFacility.get(), Point.arrayClone(supportCustomers.get()))
                    var toSecondChildPort = (toSecondChild as unknown as WritablePort<Msg>).getPort()
                    thisMutationSandbox.connect(toSecondChildPort, secondChild.fromProducer)
                    thisMutationSandbox.connect(secondChild.toAccumulator, accumulator.fromSecondQuadrant)

                    let thirdChild = new Quadrant(
                        thisReactor, true, Position.BOT_LEFT, childrenBoundaries.get()[2], threshold.get(), depth.get() + 1,
                        Point.arrayClone(localFacilities.get()), knownFacilities.get(), maxDepthOfKnownOpenFacility.get(), Point.arrayClone(supportCustomers.get()))
                    var toThirdChildPort = (toThirdChild as unknown as WritablePort<Msg>).getPort()
                    thisMutationSandbox.connect(toThirdChildPort, thirdChild.fromProducer)
                    thisMutationSandbox.connect(thirdChild.toAccumulator, accumulator.fromThirdQuadrant)

                    let fourthChild = new Quadrant(
                        thisReactor, true, Position.BOT_RIGHT, childrenBoundaries.get()[3], threshold.get(), depth.get() + 1,
                        Point.arrayClone(localFacilities.get()), knownFacilities.get(), maxDepthOfKnownOpenFacility.get(), Point.arrayClone(supportCustomers.get()))
                    var toFourthChildPort = (toFourthChild as unknown as WritablePort<Msg>).getPort()
                    thisMutationSandbox.connect(toFourthChildPort, fourthChild.fromProducer)
                    thisMutationSandbox.connect(fourthChild.toAccumulator, accumulator.fromFourthQuadrant)

                    supportCustomers.set(new Array<Point>());
                    // Indicate that children quadrant actors have been created.
                    // After this partition() will never be called.
                    hasChildren.set(true)
                }

                // Reaction.
                let msg = fromProducer.get()
                switch (msg?.constructor) {
                    case CustomerMsg:
                        // Handling CustomerMsg for a new customoer.
                        // This message is propagated from root to the leaf facility.
                        // console.log(`Quadrant at ${facility.get()} - Received CustomerMsg: ${(<CustomerMsg>msg).point}`)
                        let point = (<CustomerMsg>msg).point;
                        if (!hasChildren.get()) {
                            // No open facility, thus, addCustomer(), then partition().
                            addCustomer(point, localFacilities, supportCustomers, totalCost)
                            if (totalCost.get() > threshold.get()) {
                                partition()
                            }
                        } else {
                            // A facility is already open, propagate customer to correct child.
                            // console.log(`Quadrant at ${facility.get()} - A child facility is already open.`)
                            for (let i = 0; i < childrenBoundaries.get().length; i++) {
                                if (childrenBoundaries.get()[i].contains(point)) {
                                    switch (i) {
                                        case 0:
                                            toFirstChild.set(msg)
                                            break
                                        case 1:
                                            toSecondChild.set(msg)
                                            break
                                        case 2:
                                            toThirdChild.set(msg)
                                            break
                                        case 3:
                                            toFourthChild.set(msg)
                                            break
                                    }
                                    break
                                }
                            }
                        }
                        break
                    case RequestExitMsg:
                        if (!hasChildren.get()) {
                            // No children, number of facilities will be counted on parent's side.
                            toAccumulator.set(new ConfirmExitMsg(
                                    0, // facilities
                                    supportCustomers.get().length, // supportCustomers
                                    1 // quadrantReactors
                                ))
                        } else {
                            toFirstChild.set(msg)
                            toSecondChild.set(msg)
                            toThirdChild.set(msg)
                            toFourthChild.set(msg)
                        }
                        break
                    default:
                        console.log(`Error: Recieved unknown message: ${msg?.constructor}`)
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
    summary: Summary
    constructor (name: string, timeout: TimeValue | undefined = undefined, keepAlive: boolean = false, fast: boolean = false, success?: () => void, fail?: () => void) {
        super(timeout, keepAlive, fast, success, fail);
        // TODO(hokeun): Change default for numPoints to 100000.
        let NUM_POINTS = 100000
        let GRID_SIZE = 500
        let F = Math.sqrt(2) * GRID_SIZE
        let ALPHA = 2.0

        this.producer = new Producer(this, NUM_POINTS, GRID_SIZE, TimeValue.nsec(1))

        this.rootQuadrant = new Quadrant(this,
                false, // hasQuadrantProducer
                Position.ROOT, // positionRelativeToParent
                new Box(0, 0, GRID_SIZE, GRID_SIZE), // boundry
                ALPHA * F, // threshold
                0, // depth
                new Array<Point>(), // initLocalFacilities
                1, // initKnownFacilities
                -1, //initMaxDepthOfKnownOpenFacility
                new Array<Point>() // initCustomers
            )

        this.summary = new Summary(this)

        this._connect(this.producer.toConsumer, this.rootQuadrant.fromProducer)
        this._connect(this.rootQuadrant.toAccumulator, this.summary.fromRootQuadrant)
    }
}

// ************* Instance FacilityLocation of class FacilityLocation
let _app = new FacilityLocation('FacilityLocation', undefined, false, true)
// ************* Starting Runtime for FacilityLocation of class FacilityLocation
_app._start();
