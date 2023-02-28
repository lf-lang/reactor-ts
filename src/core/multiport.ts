import {
    Absent, InPort, IOPort, MultiRead, MultiReadWrite, OutPort, Present, 
    Reactor, Runtime, WritablePort, Trigger, TriggerManager, Reaction, Component
} from "./internal";
import { WritableMultiPort } from "./port";

/**
 * A trigger that represents a multiport. All of channels of a multiport can be read.
 * To obtain a writable version, see @link{Reactor.allWritable()}.
 *  
 * @author Marten Lohstroh <marten@berkeley.edu>
 * @author Hokeun Kim <hokeun@berkeley.edu>
 */
export abstract class MultiPort<T extends Present> extends Trigger implements MultiRead<T> {

    /**
     * Return all channels of this multiport.
     */
    abstract channels(): Array<IOPort<T>>

    /**
     * Return the channel identified by the given index.
     * @param index the index of the requested channel
     */
    abstract channel(index: number): IOPort<T>

    /**
     * The channels of this multiport.
     */
    protected _channels: Array<IOPort<T>>

    /** @inheritdoc */
    private readonly _width: number

    /**
     * Given an array of ports (channels), return an array holding the ports'
     * current values.
     * @param ports the ports to return the values of
     * @returns the current values of the given ports
     */
    public static values<T extends Present>(ports: Array<IOPort<T>>): Array<T | Absent> {
        let values = new Array<T | Absent>(ports.length);
        for (let i = 0; i < values.length; i++) {
            values[i] = ports[i].get();
        }
        return values
    }

    /**
     * Construct a new multiport.
     * @param container the reactor that will contain the new instance
     * @param width the number of channels of newly created instance
     */
    constructor(private container: Reactor, width: number) {
        super(container)
        this._channels = new Array(width)
        this._width = width
    }

    /**
     * Obtain a writable version of this port, provided that the caller holds the required key.
     * @param key
     */
     public asWritable(key: Symbol | undefined): WritableMultiPort<T> {
        if (this._key === key) {
            return this.writer
        }
        throw Error("Referenced port is out of scope: " + this._getFullyQualifiedName())
    }

    /** @inheritdoc */
    public get(index: number): T | undefined {
        return this._channels[index].get()
    }

    /** @inheritdoc */
    getManager(key: Symbol | undefined): TriggerManager {
        if (this._key == key) {
            return this.manager
        }
        throw Error("Unable to grant access to manager.")
    }

    /**
     * Return whether this multiport has any channels that are present.
     * @returns true if there are any present channels
     */
    isPresent(): boolean {
        return this.channels().some(channel => channel.isPresent())
    }

    /**
     * Return the number of channels of this multiport.
     * @returns the number of channels
     */
    public width(): number {
        return this._width
    }

    /**
     * Return an array of which the elements represent the current value of 
     * each channel, which may either be present or absent (i.e., undefined).
     * @returns an array of values
     */
    public values(): Array<T | Absent> {
        return MultiPort.values(this._channels)
    }

    /**
     * Inner class instance to let the container configure this port.
     */
     protected manager = new class implements TriggerManager {
        /** @inheritdoc */
        constructor(private port: MultiPort<T>) { }
        
        /** @inheritdoc */
        getContainer(): Reactor {
            return this.port.getContainer()
        }

        /** @inheritdoc */
        addReaction(reaction: Reaction<unknown>): void {
            this.port.channels().forEach(
                channel => channel.getManager(
                    this.getContainer()._getKey(channel)
                ).addReaction(reaction))
        }

        /** @inheritdoc */
        delReaction(reaction: Reaction<unknown>): void {
            this.port.channels().forEach(
                channel => channel.getManager(
                    this.port._key
                ).delReaction(reaction)
            )
        }
    }(this)

    /**
     * Unimplemented method (multiports require not access to the runtime object).
     */
    public _receiveRuntimeObject(runtime: Runtime): void {
        throw new Error("Multiports do not request to be linked to the" +
            " runtime object, hence this method shall not be invoked.");
    }

    /**
    * Inner class instance to gain access to MultiWrite<T> interface.
    */
    protected writer = new class extends WritableMultiPort<T> {
        
        getPorts(): IOPort<T>[] {
            return this.port._channels
        }

        /**
         * Storage for obtained writers.
         */
        private readonly cache: Array<WritablePort<T>>
        
        /** @inheritdoc */
        constructor(private port: MultiPort<T>) {
            super()
            this.cache = new Array();
        }

        /** @inheritdoc */
        public get(index: number): T | undefined {
            return this.port._channels[index].get()
        }

        /** @inheritdoc */
        public set(index: number, value: T): void {
            let writableChannel = this.cache[index]
            if (writableChannel === undefined) {
                writableChannel = this.port.getContainer()
                    .writable(this.port._channels[index])
                this.cache[index] = writableChannel
            }
            writableChannel.set(value)
        }

        /** @inheritdoc */
        public width(): number {
            return this.port.width()
        }
        
        /** @inheritdoc */
        public values(): Array<T | Absent> {
            return this.port.values()
        }
    }(this)

    public toString() {
        return this.container.toString() + "." + Component.keyOfMatchingEntry(this, this.container)
    }

}

/**
 * A trigger that represents an input port that is also multiport.
 *  
 * @author Marten Lohstroh <marten@berkeley.edu>
 * @author Hokeun Kim <hokeun@berkeley.edu>
 */
export class InMultiPort<T extends Present> extends MultiPort<T> {

    /** @inheritdoc */
    public channel(index: number): InPort<T> {
        return this._channels[index]
    }

    /** @inheritdoc */
    public channels(): Array<InPort<T>> {
        return this._channels
    }

    /** @inheritdoc */
    constructor(container: Reactor, width: number) {
        super(container, width)
        for (let i = 0; i < width; i++) {
            this._channels[i] = new InPort<T>(container)
        }
    }
}

/**
 * A trigger that represents an output port that is also multiport.
 *  
 * @author Marten Lohstroh <marten@berkeley.edu>
 * @author Hokeun Kim <hokeun@berkeley.edu>
 */
export class OutMultiPort<T extends Present> extends MultiPort<T> {

    /** @inheritdoc */
    constructor(container: Reactor, width: number) {
        super(container, width)
        for (let i = 0; i < width; i++) {
            this._channels[i] = new OutPort<T>(container)
        }
    }

    /** @inheritdoc */
    public channel(index: number): OutPort<T> {
        return this._channels[index]
    }

    /** @inheritdoc */
    public channels(): Array<OutPort<T>> {
        return this._channels
    }

    /** @inheritdoc */
    public values(): Array<T | Absent> {
        return MultiPort.values(this._channels)
    }
}
