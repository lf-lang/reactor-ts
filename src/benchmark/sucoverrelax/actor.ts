/* eslint-disable @typescript-eslint/prefer-readonly */
// The SOR (Re)actor
import { InPort, Reactor, State } from "../../core/internal";
import { Message } from "./sorutils";

export class SORActor extends Reactor {
    constructor(
        parent: Reactor,
        pos: number,
        _value: number,
        colour: number,
        nx: number,
        ny: number,
        omega: number,
        sorSource: Reactor,
        peer: boolean
    ) {
        super(parent, "SORActor");

        const x = Math.floor(pos / ny);
        const y = pos % ny;

        const omegaOverFour = 0.25 * omega;
        const oneMinusOmega = 1.0 - omega;

        this.portFromRunner = new InPort<Message>(this);

        const neighbours = (() => {
            const calPos = (x: number, y: number): number => (x * ny + y);

            if (x > 0 && x < nx - 1 && y > 0 && y < ny - 1) {
                return [calPos(x, y + 1),
                calPos(x + 1, y),
                calPos(x, y - 1),
                calPos(x - 1, y)];
            }
            if ((x === 0 || x === (nx - 1)) && (y === 0 || y === (ny - 1))) {
                return [
                    (x === 0) ? calPos(x + 1, y) : calPos(x - 1, y),
                    (y === 0) ? calPos(x, y + 1) : calPos(x, y - 1)
                ];
            }
            if ((x === 0 || x === (nx - 1)) || (y === 0 || y === (ny - 1))) {
                if (x === 0 || x === nx - 1) {
                    return [
                        (x === 0) ? calPos(x + 1, y) : calPos(x - 1, y),
                        calPos(x, y + 1),
                        calPos(x, y - 1)
                    ];
                }
                return [
                    (y === 0) ? calPos(x, y + 1) : calPos(x, y - 1),
                    calPos(x+1, y),
                    calPos(x-1, y)
                ];
            }
            return [];
        })();
    }

    private iter = new State(0);
    private maxIter = new State(0);
    private msgRcv = new State(0);
    private sorActors = new State<Reactor[]>([]);
    
    public portFromRunner: InPort<Message>;
}