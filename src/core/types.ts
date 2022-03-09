
import { Tag, TimeValue, Trigger } from "./internal";

/**
 * A variable can be read, written to, or scheduled. Variables may be passed to
 * reactions in an argument list.
 * @see Read
 * @see Write
 * @see Sched
 */
 export type Variable = Read<unknown> | MultiRead<unknown> | Array<Read<unknown> | MultiRead<unknown>>

/**
 * Interface for writable ports.
 */
 export interface Write<T> {
    set: (value: T) => void;
}

/**
 * Type for simple variables that are both readable and writable.
 */
 export type ReadWrite<T> = Read<T> & Write<T>;

 export type MultiReadWrite<T> = MultiRead<T> & MultiWrite<T>;
 
 /**
  * Interface for readable variables.
  */
export interface Read<T> {
    get(): T | Absent;
 }
 
 export interface MultiRead<T> {
    
    /**
     * Return the number of channels.
     */
    width(): number

    /**
     * Given an index that identifies a particular channel, return the current
     * value of the identified channel.
     * @param index the index that identifies the channel to return the value of
     * @returns the value that corresponds to the identified channel
     */
    get(index: number): T | Absent
 }
 
 export interface MultiWrite<T> {
    /**
     * Return the number of channels.
     */
    width(): number
    
    set: (index: number, value: T) => void;
    
    values(): Array<T | Absent>
 }

 //--------------------------------------------------------------------------//
// Types                                                                    //
//--------------------------------------------------------------------------//

/**
 * Type that denotes the absence of a value.
 * @see Variable
 */
export type Absent = undefined;

/**
 * Conditional type for argument lists of reactions. If the type variable
 * `T` is inferred to be a subtype of `Variable[]` it will yield `T`; it  
 * will yield `never` if `T` is not a subtype of `Variable[]`.
 * @see Reaction
 */
export type ArgList<T> = T extends Variable[] ? T : never;

export type ParmList<T> = T extends any[] ? T : never;

/**
 * Type for data exchanged between ports.
 */
export type Present = (number | bigint | string | boolean | symbol | object | null);


export class Args<T extends Variable[]> {
    tuple: T;
    constructor(...args: T) {
        this.tuple = args;
    }
}

export class Triggers {
    list: Array<Trigger | Array<Trigger>>;
    constructor(trigger: Trigger | Array<Trigger>, ...triggers: Array<Trigger | Array<Trigger>>) {
        this.list = triggers.concat(trigger)
    }
}


/**
 * Interface for schedulable actions.
 */
 export interface Sched<T> extends Read<T> {
    schedule: (extraDelay: TimeValue | 0, value: T, intendedTag?: Tag) => void;
    // FIXME: it makes sense to be able to check the presence of a (re)schedulable action.
}

