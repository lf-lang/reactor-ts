import {
  InPort,
  OutPort,
  State,
  Reactor,
  App,
  type TimeValue,
  Log
} from "../core/internal";

// This is the thrshold for the quicksort algorithm, feeding sorters below this number will use Array.prototype.sort()
// toSorted() is more ideal but I think there is some compatibility issue.
const T = 8;

const arr = [
  578, 530, 482, 105, 400, 787, 563, 613, 483, 888, 439, 928, 857, 404, 949,
  736, 68, 761, 951, 432, 799, 212, 108, 937, 562, 616, 436, 358, 221, 315, 423,
  539, 215, 795, 409, 227, 715, 847, 66, 242, 168, 637, 572, 468, 116, 668, 213,
  859, 880, 291, 609, 502, 486, 710, 662, 172, 991, 631, 120, 905, 751, 293,
  411, 503, 901, 53, 774, 145, 831, 140, 592, 184, 228, 111, 907, 640, 553, 519,
  579, 389, 735, 545, 975, 255, 83, 449, 673, 427, 369, 854, 86, 33, 885, 940,
  904, 764, 834, 250, 183, 191
];

Log.global.level = Log.levels.INFO;

// Change the boolean value to toggle between the "matryoshka" version or "flat" version.
const useHierarchy = true;

class QuickSorter extends Reactor {
  parentReadPort: InPort<number[]>;
  parentWritePort: OutPort<number[]>;
  leftWritePort: OutPort<number[]>;
  rightWritePort: OutPort<number[]>;
  leftReadPort: InPort<number[]>;
  rightReadPort: InPort<number[]>;

  resultArr: State<number[]>;
  numFragments: State<number>;

  leftReactor: State<QuickSorter | undefined>;
  rightReactor: State<QuickSorter | undefined>;

  constructor(parent: Reactor) {
    super(parent);
    this.parentReadPort = new InPort<number[]>(this);
    this.parentWritePort = new OutPort<number[]>(this);
    this.leftWritePort = new OutPort<number[]>(this);
    this.rightWritePort = new OutPort<number[]>(this);
    this.leftReadPort = new InPort<number[]>(this);
    this.rightReadPort = new InPort<number[]>(this);
    this.resultArr = new State([]);
    this.numFragments = new State(0);

    this.leftReactor = new State(undefined);
    this.rightReactor = new State(undefined);

    // When the parent sends a message, we send it to children.
    this.addMutation(
      [this.parentReadPort],
      [
        this.parentReadPort,
        this.writable(this.parentWritePort),
        this.leftWritePort,
        this.rightWritePort,
        this.leftReadPort,
        this.rightReadPort,
        this.resultArr,
        this.numFragments,
        this.leftReactor,
        this.rightReactor
      ],
      function (
        this,
        parentReadPort,
        parentWritePort,
        leftWritePort,
        rightWritePort,
        leftread,
        rightread,
        resultArr,
        numFragments,
        stateLeftReactor, // This is really cursed, but s_ is to indicate that this is a state
        stateRightReactor
      ) {
        const hierarchyImplementation = (
          useHierarchy ? this.addChild : this.addSibling
        ).bind(this);

        const fullarr = parentReadPort.get();
        if (fullarr == null) {
          throw Error("Received null from port");
        }
        if (fullarr.length < T) {
          const sorted = [...fullarr].sort((a, b) => a - b);
          parentWritePort.set(sorted);
          return;
        }
        const pivot = fullarr[0];
        const leftToSort = fullarr.filter((val) => val < pivot);
        const righttoSort = fullarr.filter((val) => val > pivot);
        const pivots = fullarr.filter((val) => val === pivot);

        resultArr.set(pivots);
        numFragments.set(numFragments.get() + 1);

        console.log(
          `I received a request! ${fullarr}! Pivot is ${pivot}, so I divided it into ${leftToSort} and ${righttoSort}`
        );

        // First, create 2 new reactors
        const leftReactor = hierarchyImplementation(QuickSorter);
        const rightReactor = hierarchyImplementation(QuickSorter);

        stateLeftReactor.set(leftReactor);
        stateRightReactor.set(rightReactor);

        // Connect ports accoringly
        this.connect(leftWritePort, leftReactor.parentReadPort);
        this.connect(rightWritePort, rightReactor.parentReadPort);

        this.connect(leftReactor.parentWritePort, leftread);
        this.connect(rightReactor.parentWritePort, rightread);

        this.getReactor().writable(leftWritePort).set(leftToSort);
        this.getReactor().writable(rightWritePort).set(righttoSort);
      }
    );

    this.addMutation(
      [this.leftReadPort],
      [
        this.leftReadPort,
        this.resultArr,
        this.numFragments,
        this.writable(this.parentWritePort),
        this.leftReactor
      ],
      function (
        this,
        leftreadport,
        resultArr,
        numFragments,
        parentWrite,
        stateLeftReactor
      ) {
        const leftResult = leftreadport.get();
        const myResult = resultArr.get();
        const leftReactor = stateLeftReactor.get();
        if (leftResult == null) {
          throw Error("Left return null");
        }
        if (myResult.length === 0) {
          throw Error(
            "Result length is 0, but should contain at least the pivots."
          );
        }
        if (leftReactor == null) {
          throw Error("Right reactor is null.");
        }

        console.log(`I received a result from my left! ${leftResult}!`);
        resultArr.set([...leftResult, ...myResult]);

        this.delete(leftReactor);
        stateLeftReactor.set(undefined);

        numFragments.set(numFragments.get() + 1);
        if (numFragments.get() === 3) {
          parentWrite.set(resultArr.get());
        }
      }
    );

    this.addMutation(
      [this.rightReadPort],
      [
        this.rightReadPort,
        this.resultArr,
        this.numFragments,
        this.writable(this.parentWritePort),
        this.rightReactor
      ],
      function (
        this,
        rightreadport,
        resultArr,
        numFragments,
        parentWrite,
        stateRightReactor
      ) {
        const rightResult = rightreadport.get();
        const myResult = resultArr.get();
        const rightReactor = stateRightReactor.get();
        if (rightResult == null) {
          throw Error("Right return null");
        }
        if (myResult.length === 0) {
          throw Error(
            "Result length is 0, but should contain at least the pivots."
          );
        }
        if (rightReactor == null) {
          throw Error("Right reactor is null.");
        }

        console.log(`I received a result from my right! ${rightResult}!`);
        resultArr.set([...myResult, ...rightResult]);

        // Destroy right reactor and the connection

        this.delete(rightReactor);
        stateRightReactor.set(undefined);

        numFragments.set(numFragments.get() + 1);
        if (numFragments.get() === 3) {
          parentWrite.set(resultArr.get());
        }
      }
    );
  }
}

class Supplier extends Reactor {
  rootWritePort: OutPort<number[]>;
  rootReadPort: InPort<number[]>;

  constructor(parent: Reactor, arr: number[], name = "Innocent Supplier") {
    super(parent);
    this.rootWritePort = new OutPort<number[]>(this);
    this.rootReadPort = new InPort<number[]>(this);
    this.addReaction(
      [this.startup],
      [this.writable(this.rootWritePort)],
      function (this, rootwrite) {
        rootwrite.set(arr);
      }
    );

    this.addReaction(
      [this.rootReadPort],
      [this.rootReadPort],
      function (this, rootReadPort) {
        console.log(`I received final result: ${rootReadPort.get() ?? "null"}`);
      }
    );
  }
}

class Arbiter extends App {
  rootSorter: QuickSorter;
  supplier: Supplier;

  constructor(
    name: string,
    timeout: TimeValue | undefined = undefined,
    keepAlive = false,
    fast = false,
    success?: () => void,
    fail?: () => void
  ) {
    super(timeout, keepAlive, fast, success, fail);
    this.rootSorter = new QuickSorter(this);
    this.supplier = new Supplier(this, arr);
    this._connect(this.supplier.rootWritePort, this.rootSorter.parentReadPort);
    this._connect(this.rootSorter.parentWritePort, this.supplier.rootReadPort);
  }
}

const arb = new Arbiter("arbiter");
arb._start();
