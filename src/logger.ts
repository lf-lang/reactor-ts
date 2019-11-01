
import {Reactor, InPort, OutPort, Trigger, Reaction, Timer, TimeInterval} from './reactor';

export class Print extends Reaction{

    /**
     * Call console.log on the input
     * @override
     */
    react(){
        const received = (this.state as any).i.get();
        if( received ){
            console.log("Logging: " + received);
        } else {
            console.log("Log got a null");
        }
    }
}


export class Logger extends Reactor {

    i: InPort<any> = new InPort<any>(this);

    constructor() {
        super(null, "Logger");
        
        const r = new Print(this, [this.i], 0);
        this._reactions.push(r);
    }

}