import { InPort, MutationSandbox, OutPort, Reactor, State } from "../../core/internal";
import { SORActor } from "./actor";
import { SORRunner } from "./runner";
import { Message, MessageTypes, SorBorder as SORBorder, SorBorder } from "./sorutils";

export class SORPeer extends Reactor {

    s: State<number>;
    partStart: State<number>;
    matrixPart: State<number[][]>;
    border: State<SORBorder>;
    sorSource: State<SORRunner>


    sorActors: State<Reactor[]>;
    public portFromSORRunner: InPort<Message>;

    constructor(
        parent: Reactor,
        s: number,
        partStart: number,
        matrixPart: number[][],
        border: SORBorder,
        sorSource: SORRunner
    ) {
        super(parent, "SORPeer");
        this.sorActors = new State([]);
        this.s = new State(s);
        this.partStart = new State(partStart);
        this.matrixPart = new State(matrixPart);
        this.border = new State(border);
        this.sorSource = new State(sorSource);

        this.portFromSORRunner = new InPort(this);
    }

    static boot(this: MutationSandbox, args: BootProcessingArgs) {
        const myBorder: SORActor[] = [];
        const {_s, border, sorActors, partStart} = args;
        const s = _s.get();
        const partStartVal = partStart.get();
        
        const sorActorsValue = sorActors.get();
        const borderValue = border.get();
        for (let i = 0; i < s; ++i) {
            sorActorsValue[i * (s - partStartVal + 1)] = borderValue.borderActors[i];
        }
        sorActors.set(sorActorsValue);

        for ()
    }
}

interface BootProcessingArgs {
    type: MessageTypes.sorBootMessage,
    _s: State<number>,
    border: State<SORBorder>,
    sorActors: State<SORActor[]>,
    partStart: State<number>,
}
interface ResultProcessingArgs {
    type: MessageTypes.sorResultMessage,
    expectingBoot: State<boolean>,
    totalMsgRcv: State<number>,
    returned: State<number>,
    gTotal: State<number>,
    s: State<number>,
    part: State<number>
}

type ProcessingArgs = BootProcessingArgs | ResultProcessingArgs;