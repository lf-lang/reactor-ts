import {Reactor, OutPort, InPort, App} from '../src/reactor';

/**
    * An actor implementation is a reactive component with ports as properties.
    */
class Container extends Reactor{
    
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



// */__tests__/.*
describe('Container to Contained', () => {

    var container = new Container(null, "Container");
    var contained = new Contained(container, "Contained");
    var grandcontained = new Contained(contained, "Grandcontained");

    var container2 = new Container(null, "Container2");
    var contained2 = new Contained(container2, "Contained2");
    
    it('contained reactor name', () => {
        // expect(contained._getName()).toBe("Contained");
        expect(contained.toString()).toBe("Container/Contained");
    });

    it('container reactor name', () =>{
        // expect(container._getName()).toBe("Container");
        expect(container.toString()).toBe("Container");

    })

    it('get container name from contained', () =>{
        let obtainedContainer = contained._getContainer();
        if(obtainedContainer){
            // expect(obtainedContainer._getName()).toBe("Container");
            expect(obtainedContainer.toString()).toBe("Container");
        } else {
            throw new Error("contained._getContainer() returns null");
        } 
    })

    it('get contained name from container', () =>{

        //This test assumes contained to be the only child
        for(let child of container.children){
            if(child){
                expect(child.toString()).toBe("Container/Contained");
            } else {
                throw new Error("Container has no children");
            }
        }
    })

    it('testing canConnect', () => {
        expect(container.a.canConnect(contained.a)).toBe(true);
        expect(contained.a.canConnect(container.a)).toBe(false);
        expect(contained.a.canConnect(contained.b)).toBe(false);
        expect(contained.b.canConnect(contained.a)).toBe(true);

        expect(container.a.canConnect(contained.b)).toBe(false);
        expect(contained.b.canConnect(container.a)).toBe(false);

        expect(container.b.canConnect(contained.a)).toBe(false);
        expect(contained.a.canConnect(container.b)).toBe(false);

        expect(container.b.canConnect(contained.b)).toBe(false);
        expect(contained.b.canConnect(container.b)).toBe(true);

        expect(contained.a.canConnect(contained2.a)).toBe(false);
        expect(contained.a.canConnect(contained2.b)).toBe(false);
        expect(contained2.a.canConnect(contained.a)).toBe(false);
        expect(contained2.a.canConnect(contained.a)).toBe(false);

        expect(contained2.a.canConnect(container.b)).toBe(false);
        expect(contained2.a.canConnect(container.a)).toBe(false);
       
        expect(grandcontained.a.canConnect(contained.a)).toBe(false);
        expect(grandcontained.b.canConnect(contained.b)).toBe(true);
        expect(grandcontained.a.canConnect(container.a)).toBe(false);
        expect(grandcontained.b.canConnect(container.b)).toBe(false);
        expect(grandcontained.a.canConnect(container2.a)).toBe(false);
        expect(grandcontained.b.canConnect(container2.b)).toBe(false);
        expect(grandcontained.a.canConnect(contained2.a)).toBe(false);
        expect(grandcontained.b.canConnect(contained2.b)).toBe(false);
        

    });
});