/**
 * Typescript runtime implementation of Fork Join - Create benchmark programme
 * of Savina benchmark suite.
 * @author axmmisaka (github.com/axmmisaka)
 */

import {
    Log,
    Reactor,
    App,
    type TimeValue,
    InPort,
    OutPort
} from "../core/internal";

Log.global.level = Log.levels.ERROR;

const N = 4000;

export class ForkJoinReactor extends Reactor {
    // private valueToCalculate;
    triggerPort: InPort<number>;
    constructor(parent: Reactor, name = "Innocent Reactor") {
        super(parent);
        this.triggerPort = new InPort(this);
        this.addReaction(
            [this.triggerPort],
            [this.triggerPort],
            (inp) => {
                const val = inp.get();
                if (val == null) {
                    throw new Error(`inp is absent for ${this._getFullyQualifiedName()}`)
                }
                const sint = Math.sin(val);
                const res = sint * sint;
                if (res <= 0) {
                    throw new Error(`this is kinda insane, ${res}`);
                } else {
                    console.log(`I am ${this._getFullyQualifiedName()}. I finished calculating after ${this.util.getElapsedLogicalTime()}; ${this.util.getElapsedPhysicalTime()}. Result is ${res}`)
                }
            }
        );
    }
}

export class FJCreator extends Reactor {
    forks: ForkJoinReactor[];
    outp: OutPort<number>;

    constructor(parent: Reactor) {
        super(parent);
        this.forks = [];
        this.outp = new OutPort(this);
        this.addMutation(
            [this.startup],
            [this.writable(this.outp)],
            function (this, outp) {
                console.log("startup triggered!")
                for (let i = 0; i < N; ++i) {
                    const fork = this.addSibling(ForkJoinReactor, `FJReactor ${i}`);
                    // this.getReactor().forks.push(fork);
                    this.connect(outp.getPort(), fork.triggerPort);
                    console.log(`Fork ${i} created at physical time ${this.util.getElapsedPhysicalTime()}`)
                }
                outp.set(114.514);
            }
        )
    }
}

export class FJHost extends App {
    creator: FJCreator;
    constructor(
        name: string,
        timeout: TimeValue | undefined = undefined,
        keepAlive = false,
        fast = false,
        success?: () => void,
        fail?: () => void
    ) {
        super(timeout, keepAlive, fast, success, fail);
        this.creator = new FJCreator(this);
    }
}

const fj = new FJHost("FJ");
fj._start();
