import type {
  IOPort,
  MultiPort,
  ParmList,
  Port,
  Reactor,
  WritableMultiPort,
  WritablePort
} from "./internal";

/**
 * Type that describes a class with a constructor of which the arguments
 * are of type `ReactorArgs`.
 */
export type ReactorClass<T extends Reactor, S> = new (
  ...parameters: ParmList<S>
) => T;

/**
 * A bank of reactor instances.
 */
export class Bank<T extends Reactor, S> {
  /**
   * Array of reactor instances that constitute the bank.
   */
  private readonly members = new Array<T>();

  /**
   * A mapping from containing reactors to indices corresponding to the member
   * of a contained bank that is currently being initialized (if there is one).
   */
  public static readonly initializationMap = new Map<Reactor, number>();

  /**
   * Construct a new bank of given width on the basis of a given reactor class and a list of arguments.
   * @param width the width of the bank
   * @param cls the class to construct reactor instances of that will populate the bank
   * @param parameters the arguments to pass into the constructor of the given reactor class
   */
  constructor(
    container: Reactor,
    width: number,
    cls: ReactorClass<T, S>,
    ...parameters: ParmList<S>
  ) {
    for (let i = 0; i < width; i++) {
      Bank.initializationMap.set(container, i);
      console.log(`Setting initializing to ${i}`);
      this.members.push(Reflect.construct(cls, parameters, cls));
    }
    Bank.initializationMap.delete(container);
  }

  /**
   * Return all reactor instances in this bank.
   * @returns all reactor instances in this bank
   */
  public all(): T[] {
    return this.members;
  }

  /**
   * Return the reactor instance that corresponds to the given index.
   * @param index index of the reactor instance inside this bank
   * @returns the reactor instances that corresponds to the given index
   */
  public get(index: number): T {
    return this.members[index];
  }

  /**
   * Return a list of ports selected across all bank members by the given lambda.
   * @param selector lambda function that takes a reactor of type T and return a port of type P
   * @returns a list of ports selected across all bank members by the given lambda
   */
  public port<P extends Port<unknown> | MultiPort<unknown>>(
    selector: (reactor: T) => P
  ): P[] {
    return this.all().reduce(
      (acc, val) => acc.concat(selector(val)),
      new Array<P>(0)
    );
  }

  public toString(): string {
    return `bank(${this.members.length})`;
  }

  public allWritable<T>(
    ports: Array<MultiPort<T>>
  ): Array<WritableMultiPort<T>> {
    if (ports.length !== this.members.length) {
      throw new Error("Length of ports does not match length of reactors.");
    }
    const result = new Array<WritableMultiPort<T>>(ports.length);
    for (let i = 0; i < ports.length; i++) {
      result[i] = this.members[i].allWritable(ports[i]);
    }
    return result;
  }

  public writable<T>(ports: Array<IOPort<T>>): Array<WritablePort<T>> {
    if (ports.length !== this.members.length) {
      throw new Error("Length of ports does not match length of reactors.");
    }
    const result = new Array<WritablePort<T>>(ports.length);
    for (let i = 0; i < ports.length; i++) {
      result[i] = this.members[i].writable(ports[i]);
    }
    return result;
  }
}
