import {Reactor, InPort, OutPort, Reaction, VarList, Readable, Writable} from '../reactor';

export class Adder extends Reactor {    
    
    in1: InPort<number> = new InPort(this);
    in2: InPort<number> = new InPort(this);
    out: OutPort<number> = new OutPort(this);

    constructor(parent:Reactor, name: string) {
        super(parent, name);
        this.addReaction(new AddTwo(this, [this.in1, this.in2], this.check(this.in1, this.in2, this.getWritable(this.out))));
    }
}

class AddTwo<T> extends Reaction<T> {
    
    //@ts-ignore
    react(in1: Readable<number>, in2: Readable<number>, out:Writable<number>):void {
        let a = in1.get();
        let b = in2.get();
        if (a == null) {
            a = 0;
        }
        if (b == null) {
            b = 0;
        }
        out.set(a + b);
    }
}