import { Reactor } from "../../core/reactor";
import { SORActor } from "./actor";

// Savina implementation of PRNG
export class SavinaPRNG {
    private value: number;

    constructor(value?: number) {
        this.value = value ?? 1145141919;
    }

    public nextNumber(): number {
        this.value = ((this.value * 1309) + 13849) & 65535;
        return this.value;
    }

    public nextFloat(): number {
        return 1.0 / (this.nextNumber() + 1);
    }
}

// This is not a recommended way to use JS, but whatever......

export const refVal = [
    0.000003189420084871275,
    0.001846644602759566,
    0.0032099996270638005,
    0.0050869220175413146,
    0.008496328291240363,
    0.016479973604143234,
    0.026575660248076397,
    // This is different from the Savina one because JS doesn't have high precision
    1.026575660248076,
    2.026575660248076,
    3.026575660248076
];

export const jacobi = 100;

export const omega = 1.25;

export function randomMatrix(m: number, n: number): number[][] {
    const mat = [];
    const prng = new SavinaPRNG(114514);
    for (let i = 0; i < m; ++i) {
        const row = [];
        for (let j = 0; j < n; ++j) {
            row.push(prng.nextFloat() * 1e-6);
        }
        mat.push(row);
    }
    return mat;
}

export function jgfValidate(gTotal: number, size: number): void {
    const dev = Math.abs(gTotal - refVal[size]);
    if (dev > 1.0e-12) {
        console.log("Validation failed");
        console.log(`GTotal=${gTotal}; ${refVal[size]}; ${dev}; ${size}`);
    } else {
        console.log("Validation OK!");
    }
}

export enum MessageTypes {
    sorBootMessage,
    sorResultMessage,
    sorBorderMessage,
    sorStartMessage,
    sorValueMessage,
}

export class SorBorder {
    borderActors: SORActor[];
    constructor(borderActors: SORActor[]) {
        this.borderActors = borderActors;
    }
}

export interface SORBootMessage {
    messageType: MessageTypes.sorBootMessage;
}

export interface SORResultMessage {
    messageType: MessageTypes.sorResultMessage;
    mx: number;
    my: number;
    mv: number;
    msgRcv: number;
}

export interface SORBorderMessage {
    messageType: MessageTypes.sorBorderMessage;

    mBorder: SorBorder;
}

export interface SORStartMessage {
    messageType: MessageTypes.sorStartMessage;
    mi: number;
    mActors: SORActor[];
}

export interface SORValueMessage {
    messageType: MessageTypes.sorValueMessage;
}

export type Message = SORBootMessage | SORResultMessage | SORBorderMessage | SORStartMessage | SORValueMessage;

