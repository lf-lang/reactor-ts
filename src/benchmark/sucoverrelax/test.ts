import { App, InPort, OutPort, Reactor } from "../../core/internal";

class Master extends Reactor {
    outp: OutPort<number>;

    constructor(parent: Reactor, receivers: Receiver[]) {
        super(parent, "");
        this.outp = new OutPort(this);

        this.addMutation(
            [this.startup],
            [this.outp],
            function(this, outp) {
                let i = 0;
                for (const r of receivers) {
                    this.connect(outp, r.inp);
                    console.log(`Master: triggering ${i}`)
                    this.getReactor().writable(outp).set(i);
                    console.log(`Master: disconnecting ${i}`)
                    this.disconnect(outp, r.inp);
                    ++i;
                }
            }
        );
    }
}

class Receiver extends Reactor {
    inp: InPort<number>;
    outp: OutPort<number>;

    constructor(parent: Reactor, receiver2: Receiver2) {
        super(parent, "");
        this.inp = new InPort(this);
        this.outp = new OutPort(this);

        this.addMutation(
            [this.inp],
            [this.inp, this.outp],
            function(this, inp, outp) {
                const message = inp.get();
                if (message == null) {
                    throw Error("Receiver: Message is null.");
                }
                console.log(`Receiver: message ${message}. Sending.`);
                this.connect(outp, receiver2.inp);
                this.getReactor().writable(outp).set(message);
                this.disconnect(outp, receiver2.inp);
            }
        );
    }
}

class Receiver2 extends Reactor {
    inp: InPort<number>;

    constructor(parent: Reactor) {
        super(parent, "");
        this.inp = new InPort(this);

        this.addReaction(
            [this.inp],
            [this.inp], 
            function (this, inp) {
                console.log(`Receiver2: received ${inp.get()}`)
            }
        );
    }
}

class Apppp extends App {
    master: Master;
    recvs: Receiver[];
    recv2: Receiver2;

    constructor() {
        super(undefined, undefined, false, ()=>(undefined), ()=>(undefined), "");
        this.recv2 = new Receiver2(this);
        this.recvs = [];
        for (let i = 0; i < 10; ++i) {
            this.recvs.push(new Receiver(this, this.recv2));
        }
        this.master = new Master(this, this.recvs);
    }
}

const app = new Apppp();
app._start();