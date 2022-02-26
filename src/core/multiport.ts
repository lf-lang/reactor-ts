import { Absent, InPort, IOPort, MultiRead, MultiReadWrite, NonComposite, OutPort, Present, Reactor, Runtime, WritablePort } from "./internal";


export abstract class MultiPort<T extends Present> extends NonComposite implements MultiRead<T> {

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

    public abstract values(): Array<T | Absent>

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

    public _receiveRuntimeObject(runtime: Runtime): void {
        throw new Error("Method not implemented."); // FIXME(marten): extend Trigger instead?
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

    public values(): Array<T | Absent> {
        return MultiPort.values(this._channels)
    }
}
export class OutMultiPort<T extends Present> extends MultiPort<T> {

    public channel(index: number): OutPort<T> {
        return this._channels[index]
    }

    public _receiveRuntimeObject(runtime: Runtime): void {
        throw new Error("Method not implemented.");
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
