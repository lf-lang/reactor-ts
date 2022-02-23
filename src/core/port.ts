import {
    Reaction, Reactor, Runtime, Tag, NonComposite, Trigger, TriggerManager,
    Absent, MultiRead, MultiReadWrite, Present, ReadWrite, Log
} from "./internal"


// FIXME(marten): moving these two to port.ts results in a circular import problem with many test files:

export abstract class Port<T extends Present> extends Trigger {
    
    protected receivers: Set<WritablePort<T>> = new Set();

    protected runtime!: Runtime;

    constructor(container: Reactor, alias?: string) {
        super(container, alias)
        this._linkToRuntimeObject()
    }

    /** The tag associated with this port's value, or undefined is there is none. */
    protected tag: Tag | undefined;

    /** The current value associated with this port. */
    protected value: T | Absent;

    // abstract get(): T | undefined;

    public _receiveRuntimeObject(runtime: Runtime) {
        if (!this.runtime) {
            this.runtime = runtime
        } else {
            throw new Error("Can only establish link to runtime once. Name: " + this._getFullyQualifiedName())
        }
    }

    /**
     * Returns true if the connected port's value has been set; false otherwise
     */
    public isPresent() {

        Log.debug(this, () => "In isPresent()...")
        Log.debug(this, () => "value: " + this.value);
        Log.debug(this, () => "tag: " + this.tag);
        Log.debug(this, () => "time: " + this.runtime.util.getCurrentLogicalTime())

        if (this.value !== undefined
            && this.tag !== undefined
            && this.tag.isSimultaneousWith(this.runtime.util.getCurrentTag())) {
            return true;
        } else {
            return false;
        }
    }
}

/**
 * Abstract class for a writable port. It is intended as a wrapper for a
 * regular port. In addition to a get method, it also has a set method and
 * a method for retrieving the port that it wraps.
 */
 export abstract class WritablePort<T extends Present> implements ReadWrite<T> {
    abstract get(): T | undefined;
    abstract set(value: T): void;
    abstract getPort(): IOPort<T> // FIXME: just extend interface instead.
}

export interface WritableMultiPort<T extends Present> extends MultiReadWrite<T> {
    getWriters(): Array<WritablePort<T>>
    getPorts(): Array<IOPort<T>>
}


interface IOPortManager<T extends Present> extends TriggerManager {
    addReceiver(port: WritablePort<T>): void;
    delReceiver(port: WritablePort<T>): void;
}

export abstract class IOPort<T extends Present> extends Port<T> {

    /**
     * Return the value set to this port. Return `Absent` if the connected
     * output did not have its value set at the current logical time.
     */
    public get(): T | Absent {
        if (this.isPresent()) {
            return this.value;
        } else {
            return undefined;
        }
    }

    /**
     * Only the holder of the key may obtain a writable port.
     * @param key
     */
    public asWritable(key: Symbol | undefined): WritablePort<T> {
        if (this._key === key) {
            return this.writer
        }
        throw Error("Referenced port is out of scope: " + this._getFullyQualifiedName()) // FIXME: adjust messages for other methods as well
        // FIXME: we could potentially do this for reads/triggers as well just for scope rule enforcement
    }

    /**
     * 
     * @param container Reference to the container of this port 
     * (or the container thereof).
     */
    public getManager(key: Symbol | undefined): IOPortManager<T> {
        if (this._key == key) {
            return this.manager
        }
        throw Error("Unable to grant access to manager.")
    }

    /**
     * Inner class instance to gain access to Write<T> interface.
     */
    protected writer = new class extends WritablePort<T> {
        constructor(private port:IOPort<T>) {
            super()
        }

        public set(value: T): void {
            this.port.value = value;
            this.port.tag = this.port.runtime.util.getCurrentTag();
            // Set values in downstream receivers.
            this.port.receivers.forEach(p => p.set(value))
            //console.log("Set called. The number of reactions is: " + this.port.reactions.size)
            // Stage triggered reactions for execution.
            this.port.reactions.forEach(r => this.port.runtime.stage(r))
        }

        public get(): T | Absent {
            return this.port.get()
        }

        public getPort(): IOPort<T> {
            return this.port
        }
        
        public toString(): string {
            return this.port.toString()
        }
        
    }(this)

    /**
     * Inner class instance to let the container configure this port.
     */
    protected manager:IOPortManager<T> = new class implements IOPortManager<T> {
        constructor(private port:IOPort<T>) {}
        getContainer(): Reactor {
            return this.port._getContainer()
        }

        /**
         * Add the given port to the list of receivers. If the connection was
         * established at runtime and the upstream port already has a value,
         * immediately propagate the value to the newly connected receiver.
         * @param port A newly connected downstream port.
         */
        addReceiver(port: WritablePort<T>): void {
            this.port.receivers.add(port)
            if (this.port.runtime.isRunning()) {
                let val = this.port.get()
                if (val !== undefined) {
                    port.set(val)
                }
            }
        }
        delReceiver(port: WritablePort<T>): void {
            this.port.receivers.delete(port)
        }
        addReaction(reaction: Reaction<unknown>): void {
            this.port.reactions.add(reaction)
            //console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        }
        delReaction(reaction: Reaction<unknown>): void {
            this.port.reactions.delete(reaction)
        }
    }(this)

    toString(): string {
        return this._getFullyQualifiedName();
    }
}


export class OutPort<T extends Present> extends IOPort<T> {

}

export class InPort<T extends Present> extends IOPort<T> {

}

export abstract class MultiPort<T extends Present> extends NonComposite implements MultiRead<T> {
    
    constructor(container: Reactor, readonly width: number) {
        super(container)
    }
    
    abstract get(index: number): T | Absent;
    
    public static values<T extends Present>(ports: Array<IOPort<T>>): Array<T | Absent> {
        let values = new Array<T | Absent>(ports.length);
        for (let i = 0; i < values.length; i++) {
            values[i] = ports[i].get();
        }
        return values
    }

    public abstract values(): Array<T | Absent>


    /**
     * Inner class instance to gain access to Write<T> interface.
     */
 protected writers = new class implements MultiReadWrite<T> {
    
    private readonly bla: Array<WritablePort<T>> = new Array();

     constructor(private port: MultiPort<T>) {
        // FIXME: won't work because channels have not been created yet
        //  port.channels().forEach(channel => {
        //      let writer = port.getContainer()?.writable(channel)
        //      if (writer) this.bla.push(writer)
        //  });
     }

    public get(index: number): T | undefined {
        return this.port.channel(index).get()
    }

    public set(index: number, value: T): void {
        this.port.getContainer()?.writable(this.port.channel(index)).set(value)
        //this.bla[index].set(value)
    }
    
}(this)

    public abstract channels(): Array<IOPort<T>>

    public abstract channel(index: number): IOPort<T>


    /**
     * Only the holder of the key may obtain a writable port.
     * @param key
     */
    public asWritable(key: Symbol | undefined): MultiReadWrite<T> {
        if (this._key === key) {
            return this.writers
        }
    throw Error("Referenced port is out of scope: " + this._getFullyQualifiedName())
}

public _receiveRuntimeObject(runtime: Runtime): void {
    throw new Error("Method not implemented.");
}

}

export class InMultiPort<T extends Present> extends MultiPort<T> {
    
    public get(index: number): T | undefined {
        return this._channels[index].get()
    }
    
    public channel(index: number): IOPort<T> {
        return this._channels[index]
    }
    
    private _channels: Array<InPort<T>>

    public channels() {
        return this._channels
    }

    constructor(container: Reactor, width: number) {
        super(container, width)
        this._channels = new Array<InPort<T>>(width)
        for (let i = 0; i < width; i++) {
            let port = new InPort<T>(container, this._getName())
        }
    }

    public values(): Array<T | Absent> {
        return MultiPort.values(this._channels)
    }
}
export class OutMultiPort<T extends Present> extends MultiPort<T> {

    public get(index: number): T | undefined {
        return this._channels[index].get()
    }
    
    public channel(index: number): IOPort<T> {
        return this._channels[index]
    }

    public _receiveRuntimeObject(runtime: Runtime): void {
        throw new Error("Method not implemented.");
    }
    
    private _channels: Array<OutPort<T>>

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
    
    public channels() {
        return this._channels
    }
}
