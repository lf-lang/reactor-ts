import {Reactor, OutPort, InPort, App, Executable} from '../src/reactor';

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

var container = new Container(null, "Container");
var contained = new Contained(container, "Contained");

// */__tests__/.*
describe('Container to Contained', () => {
    
    it('contained reactor name', () => {
         expect(contained._getName()).toBe("Contained");
    });

    it('container reactor name', () =>{
        expect(container._getName()).toBe("Container");
    })

    it('get container name from contained', () =>{
        let obtainedContainer = contained._getContainer();
        if(obtainedContainer){
            // expect(obtainedContainer._getName()).toBe("Container");
            expect(obtainedContainer._getName()).toBe("Container");
        } else {
            throw new Error("contained._getContainer() returns null");
        } 
    })

    it('get contained name from container', () =>{

        //This test assumes contained to be the only child
        for(let child of container.children){
            if(child){
                expect(child._getName()).toBe("Contained");
            } else {
                throw new Error("Container has no children");
            }
        }
    })

    //container._add(contained);

});


// describe('Contained to Container', () => {
    
//     // it('contained actor name', () => {
//     //     expect(x._getName()).toBe("MyActor");
//     // });

// });
