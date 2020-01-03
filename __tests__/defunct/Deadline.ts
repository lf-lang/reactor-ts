import {Reactor, Reaction, Timer, Deadline, App} from '../../src/core/reactor';
import {TimeInterval} from "../../src/core/time"

// This test is supposed to violate this deadline.
export class Dead extends Deadline {
    
    // In this test the deadline is gauranteed to be violated so this handler should be
    // invoked. 
    handler(){
        (this.state as any).success();
    }
}

// This test is supposed to not violate this deadline.
export class Alive extends Deadline{

    //  In this test the deadline is gauranteed to be violated so this handler should be
    //  invoked. 
    handler(){
        console.log("failing alive");
        (this.state as any).fail();
    }
}

export class SoonDead<T> extends Reaction<T> {

    /**
     * This reaction should never be invoked because the deadline is gauranteed
     * too be broken.
     * @override
     */
    react(){
        console.log("failing soondead");
        (this.state as any).fail();
    }
}

export class WasteTime<T> extends Reaction<T> {

    /**
     * This reaction has higher priority than SoonDead and wastes time,
     * guaranteeing the deadline will be violated.
     * @override
     */
    react(){
        for(let i = 0; i < 1000000000; i++ );
    }
}

/**
 * This reactor demonstrates the deadline component.
 * The soonDead reaction has a deadline that should be missed.
 */
export class ShowDeadline extends Reactor {

    t: Timer = new Timer(this, 0,0);

    waste: Reaction<any>;
    soonDead: Reaction<any>;

    success: () => void
    fail: () => void

    constructor(parent:Reactor | null, success: () => void, fail: () => void) {
        super(parent);
        this.success = success;
        this.fail = fail;
        
        this.waste = new WasteTime(this, [this.t], []);
        this.waste.setDeadline(new Alive(this, new TimeInterval(10)));
        this.soonDead = new SoonDead(this, [this.t], []);
        this.soonDead.setDeadline(new Dead(this, new TimeInterval(0)));
    }

}


class DeadlineTest extends App{
    showDeadline: ShowDeadline;

    constructor(name:string, timeout: TimeInterval, success: ()=> void, fail: ()=>void){
        super(timeout);
        this.setAlias(name);
        this.showDeadline = new ShowDeadline(this, success, fail);
    }
}

// This test shows the ShowDeadline reactor is able to trigger a reaction on
// a contained reactor's output.
describe('OutputEventTest', function () {

    // Ensure the test will run for no more than 5 seconds.
    jest.setTimeout(5000);

    it('start runtime', done => {
        console.log("starting test");

        function failRuntime(){
            // throw new Error("Runtime has failed.");
            console.log("Runtime has no more events on the queue");
        };

        function failReactor(){
            throw new Error("Reactor has failed.");
        };

        // Tell the reactor runtime to successfully terminate after 3 seconds.
        var sDeadline = new DeadlineTest("ShowDeadline", new TimeInterval(3), done, failReactor);
        sDeadline._start();
    })
});
