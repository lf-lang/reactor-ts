import {Reactor, OutPort, InPort, PureEvent, App, Executable} from '../src/reactor';

/**
    * An actor implementation is a reactive component with ports as properties.
    */
class Container extends Reactor {
    
    a: InPort<string> = new InPort(this);
    b: OutPort<string> = new OutPort(this);

    _checkTypes() {
        
    }

}


class Contained extends Reactor {

    a: InPort<string> = new InPort(this);
    b: OutPort<string> = new OutPort(this);

    _checkTypes() {

    }
}

var container = new Container(null);
var contained = new Contained(null);

// */__tests__/.*
describe('Container to Contained', () => {
    
    it('contained actor name', () => {
        var x: bigint = BigInt("0b11");

        console.log("My big int: " + x);
         expect(contained._getName()).toBe("Contained");
    });

    //container._add(contained);

});

// describe('Contained to Container', () => {
    
//     // it('contained actor name', () => {
//     //     expect(x._getName()).toBe("MyActor");
//     // });

// });
