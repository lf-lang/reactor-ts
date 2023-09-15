import { InMultiPort, InPort, MutationSandbox, OutMultiPort, OutPort, Parameter, Reactor, State, Variable, } from "../../core/internal";
import { SORActor } from "./actor";
import { SORPeer } from "./peer";
import { Message, MessageTypes, SORBootMessage, SORBorderMessage, SORResultMessage, SORStartMessage, SorBorder, jacobi, omega, randomMatrix } from "./sorutils";

export class SORRunner extends Reactor {
    protected s: State<number>;
    protected part: State<number>;

    protected sorActors: State<SORActor[]>;
    protected sorPeer: State<SORPeer | undefined>;

    // Definition of Ports. Initialisation will take place in the constructor, because some of them needs to access
    // some parametres.
    /// Runner will interact with App. It will receive BootMsg, and send ResultMsg.
    /// In the original Savina benchmark suite there is no ResultMsg. 
    /// Instead, Runner handles validation and simply quits the programme.
    /// We are taking a more based approach but there is no difference.
    /// See https://github.com/shamsimam/savina/blob/52e546959a57670cdba7a88f0a030b53cfdb16d6/src/main/scala/edu/rice/habanero/benchmarks/sor/SucOverRelaxAkkaActorBenchmark.scala#L112-L115
    protected portFromApp: InPort<SORBootMessage>;
    protected portToApp: OutPort<unknown[]>;

    /// Runner will send StartMsg to all actors, and receive ResultMsg from all actors.
    /// Runner will also supply them with a the list of actors. We will do the same, connection will be handled by individual Actors.
    protected portsFromActors: InMultiPort<SORResultMessage>;
    protected portsToActors: OutMultiPort<SORStartMessage>;

    /// Runner will send BootMsg to Peer, and receive BorderMsg OR ResultMsg from Peer.
    /// I am using a 3-port approach here, this way I can handle SORResultMessage in a single mutation.
    protected portFromPeerBorder: InPort<SORBorderMessage>;
    protected portFromPeerResult: InPort<SORResultMessage>;
    protected portToPeer: OutPort<SORBootMessage>;

    protected gTotal = new State(0.0);
    protected returned = new State(0);
    protected totalMsgRcv = new State(0);
    protected expectingBoot = new State(true);

    // In Savina, randoms is accessed directly from SucOverRelaxConfig.
    // Here we pass it in to the closure.
    constructor(parent: Reactor, s: number, _randoms: number[][]) {
        super(parent);
        this.s = new State(s);
        // In the scala implementation a simple /2 was used.
        // In JS we might need to enforce some sort of guarantee as it was used to calculate position
        const part = Math.floor(s / 2);
        this.part = new State(part);

        // The following lines are from Savina. They should be rather irrelevant, actually, because message passing are handled by ports
        this.sorActors = new State([]);
        this.sorPeer = new State(undefined);

        // Initialisation of ports
        this.portFromApp = new InPort(this);
        this.portToApp = new OutPort(this);
        // size * (part + 1) is the size of sorActors in the Savina benchmark
        this.portsFromActors = new InMultiPort(this, s * (part + 1));
        this.portsToActors = new OutMultiPort(this, s * (part + 1));

        this.portFromPeerBorder = new InPort(this);
        this.portFromPeerResult = new InPort(this);
        this.portToPeer = new OutPort(this);
        
        this.addMutation(
            [this.startup],
            [],
            function (this) {
                console.log("I am SORRunner [M1]. I am trolling.")
            }
        );

        // SORRunner::process(mst: SorBootMessage) and SORRunner::boot
        this.addMutation(
            [this.portFromApp],
            [this.portFromApp, this.expectingBoot, this.sorActors],
            function(this, portFromApp, expectingBoot, sorActorsState) {
                const { A } = portFromApp.get()!;

                const sorActors = sorActorsState.get();
                expectingBoot.set(false);
                // SORRunner::boot
                const myBorder: SORActor[] = [];
                const randoms = randomMatrix;
                // In Scala/Akka, 0 until s is [0, s)
                for (let i = 0; i < s; ++i) {
                    let c = i % 2;
                    for (let j = 0; j < part; ++j) {
                        const pos = i * (part + i) + j;
                        c = 1 - c;
                        sorActors[pos] = this.addSibling(SORActor, pos, A[i][j], c, s, part + 1, omega, this.getReactor(), false);
                        
                    }
                }
            }
        )


    }


}
