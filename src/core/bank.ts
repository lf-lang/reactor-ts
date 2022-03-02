import { Port, Present, Reactor } from './internal';

/**
 * Type that describes a class with a constructor of which the arguments 
 * are of type `ReactorArgs`.
 */
export type ReactorClass<T extends Reactor, S> = {
    new(...args: ReactorArgs<S>): T;
}

/**
 * Type that describes a tuple of arguments passed into the constructor 
 * of a reactor class.
 */
export type ReactorArgs<T> = T extends any[] ? T : never;

/**
 * A bank of reactor instances.
 */
export class Bank<T extends Reactor, S> {

    /**
     * Array of reactor instances that constitute the bank.
     */
    private readonly members: Array<T> = new Array();

    /**
     * Index of the bank member that is currently being initialized,
     * or -1 if there is not initialization happening.
     */
    private initializing = -1

    /**
     * Construct a new bank of given width on the basis of a given reactor class and a list of arguments.
     * @param width the width of the bank
     * @param cls the class to construct reactor instances of that will populate the bank
     * @param args the arguments to pass into the constructor of the given reactor class
     */
    constructor(width: number, cls: ReactorClass<T, S>, ...args: ReactorArgs<S>) {
        for (let i = 0; i < width; i++) {
            this.members.push(Reflect.construct(cls, args, cls));
            this.initializing = i
        }
        this.initializing = -1
    }

    /**
     * Return the index of the member that is currently being initialized.
     * @returns the index of the currently initializing member
     */
    public initializingMember() {
        return this.initializing
    }

    /**
     * Return all reactor instances in this bank.
     * @returns all reactor instances in this bank
     */
    public all(): Array<T> {
        return this.members
    }

    /**
     * Return the reactor instance that corresponds to the given index.
     * @param index index of the reactor instance inside this bank
     * @returns the reactor instances that corresponds to the given index
     */
    public get(index: number): T {
        return this.members[index]
    }

    /**
     * Return a list of ports selected across all bank members by the given lambda.
     * @param selector lambda function that takes a reactor of type T and return a port of type P
     * @returns a list of ports selected across all bank members by the given lambda
     */
    public port<P extends Port<Present>>(selector: (reactor: T) => P): Array<P> {
        return this.all().reduce((acc, val) => acc.concat(selector(val)), new Array<P>(0))
    }
}
