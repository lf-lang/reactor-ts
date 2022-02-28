import { Absent, InPort, IOPort, MultiRead, MultiReadWrite, OutPort, Present, Reactor, Runtime, WritablePort, Trigger, TriggerManager, Reaction } from "./internal";

export abstract class MultiPort<T extends Present> extends Trigger implements MultiRead<T> {

    protected _channels: Array<IOPort<T>>

    abstract channels(): Array<IOPort<T>>

    abstract channel(index: number): IOPort<T>

    constructor(container: Reactor, readonly width: number) {
        super(container)
        this._channels = new Array(width)
    }

    /**
    * Inner class instance to gain access to Write<T> interface.
    */
    protected writer = new class implements MultiReadWrite<T> {

        private readonly cache: Array<WritablePort<T>>

        constructor(private port: MultiPort<T>) {
            this.cache = new Array();
        }

        public get(index: number): T | undefined {
            return this.port._channels[index].get()
        }

        public set(index: number, value: T): void {
            let writableChannel = this.cache[index]
            if (writableChannel === undefined) {
                writableChannel = this.port.getContainer()
                    .writable(this.port._channels[index])
                this.cache[index] = writableChannel
            }
            writableChannel.set(value)
        }

        public width(): number {
            return this.port.width
        }

        public values(): Array<T | Absent> {
            return this.port.values()
        }
    }(this)

    public get(index: number): T | undefined {
        return this._channels[index].get()
    }

    public static values<T extends Present>(ports: Array<IOPort<T>>): Array<T | Absent> {
        let values = new Array<T | Absent>(ports.length);
        for (let i = 0; i < values.length; i++) {
            values[i] = ports[i].get();
        }
        return values
    }

    public values(): Array<T | Absent> {
        return MultiPort.values(this._channels)
    }

    /**
     * Only the holder of the key may obtain a writable port.
     * @param key
     */
    public asWritable(key: Symbol | undefined): MultiReadWrite<T> {
        if (this._key === key) {
            return this.writer
        }
        throw Error("Referenced port is out of scope: " + this._getFullyQualifiedName())
    }


    /**
     * Inner class instance to let the container configure this port.
     */
    protected manager = new class implements TriggerManager {
        constructor(private port: MultiPort<T>) { }

        getContainer(): Reactor {
            return this.port.getContainer()
        }

        addReaction(reaction: Reaction<unknown>): void {
            this.port.channels().forEach(channel => channel.getManager(this.getContainer()._getKey(channel)).addReaction(reaction))
        }

        delReaction(reaction: Reaction<unknown>): void {
            this.port.channels().forEach(channel => channel.getManager(this.port._key).delReaction(reaction))
        }
    }(this)

    getManager(key: Symbol | undefined): TriggerManager {
        if (this._key == key) {
            return this.manager
        }
        throw Error("Unable to grant access to manager.")
    }

    isPresent(): boolean {
        return this.channels().some(channel => channel.isPresent())
    }

    public _receiveRuntimeObject(runtime: Runtime): void {
        throw new Error("Multiports do not request to be linked to the runtime object, hence this method shall not be invoked.");
    }


}

export class InMultiPort<T extends Present> extends MultiPort<T> {

    public channel(index: number): InPort<T> {
        return this._channels[index]
    }

    public channels(): Array<InPort<T>> {
        return this._channels
    }

    constructor(container: Reactor, width: number) {
        super(container, width)
        this._channels = new Array<InPort<T>>(width)
        for (let i = 0; i < width; i++) {
            this._channels[i] = new InPort<T>(container)
        }
    }


}
export class OutMultiPort<T extends Present> extends MultiPort<T> {

    public channel(index: number): OutPort<T> {
        return this._channels[index]
    }

    constructor(container: Reactor, width: number) {
        super(container, width)
        this._channels = new Array<OutPort<T>>(width)
        for (let i = 0; i < width; i++) {
            this._channels[i] = new OutPort<T>(container)
        }
    }

    public values(): Array<T | Absent> {
        return MultiPort.values(this._channels)
    }

    public channels(): Array<OutPort<T>> {
        return this._channels
    }
}
