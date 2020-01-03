import {Reactor, OutPort, InPort, App} from '../src/core/reactor';

var app = new App();

class Component extends Reactor {
    a: InPort<string> = new InPort(this);
    b: OutPort<string> = new OutPort(this);

    constructor(parent: Reactor, alias:string) {
        super(parent);
        this.setAlias(alias);
    }
    child: Reactor | undefined;
}

describe('Container to Contained', () => {

    var container = new Component(app, "Container");
    var contained = new Component(container, "Contained");
    var grandcontained = new Component(contained, "GrandContained");

    container.child = contained;
    contained.child = grandcontained;

    var container2 = new Component(app, "Container2");
    var contained2 = new Component(container2, "Contained2");

    container2.child = contained2;

    // Normally _setAllParents would be called as part of the initialization
    // process for starting an app, but we call it directly here to set
    // parent attributes needed for this test.
    // container._setAllParents(null);
    // container2._setAllParents(null);

    it('reactor with self as child', () => {
        expect(() => {
            let loopy = new Component(app, "Loopy");
            loopy.child = loopy;
            loopy._checkAllParents(null);
        }).toThrowError();
    });

    it('reactor with a port constructed with the wrong parent', () => {
        expect(() => {
            let badPortComponent = new Component(app, "BadPortComponent");
            let otherComponent = new Component(app, "OtherComponent");

            // this port has been incorrectly constructed because it
            // is an attribute of badPortComponent, but is set in the constructor
            // with otherComponent as its parent 
            badPortComponent.a = new InPort(otherComponent);

            // _setAllParents should throw an error
            badPortComponent._checkAllParents(null);
        }).toThrowError();
    });

    
    it('contained reactor name', () => {
        // expect(contained._getName()).toBe("Contained");
        expect(contained.toString()).toBe("App/Container/Contained");
    });

    it('container reactor name', () =>{
        // expect(container._getName()).toBe("Container");
        expect(container.toString()).toBe("App/Container");

    })

    it('testing canConnect', () => {
        expect(container.canConnect(container.a, contained.a)).toBe(true);
        expect(container.canConnect(contained.a, container.a)).toBe(false);
        expect(container.canConnect(contained.a, contained.b)).toBe(false);
        expect(container.canConnect(contained.b, contained.a)).toBe(true);

        expect(container.canConnect(container.a, contained.b)).toBe(false);
        expect(container.canConnect(contained.b, container.a)).toBe(false);

        expect(container.canConnect(container.b, contained.a)).toBe(false);
        expect(container.canConnect(contained.a, container.b)).toBe(false);

        expect(container.canConnect(container.b, contained.b)).toBe(false);
        expect(container.canConnect(contained.b, container.b)).toBe(true);

        expect(container.canConnect(contained.a, contained2.a)).toBe(false);
        expect(container.canConnect(contained.a, contained2.b)).toBe(false);
        expect(container.canConnect(contained2.a, contained.a)).toBe(false);
        expect(container.canConnect(contained2.a, contained.a)).toBe(false);

        expect(container.canConnect(contained2.a, container.b)).toBe(false);
        expect(container.canConnect(contained2.a, container.a)).toBe(false);
       
        expect(container.child).toBeDefined();
        
        if (container.child) {
            expect(container.child.canConnect(grandcontained.a, contained.a)).toBe(false);
            expect(container.child.canConnect(grandcontained.b, contained.b)).toBe(true);
            expect(container.child.canConnect(grandcontained.a, container.a)).toBe(false);
            expect(container.child.canConnect(grandcontained.b, container.b)).toBe(false);
            expect(container.child.canConnect(grandcontained.a, container2.a)).toBe(false);
            expect(container.child.canConnect(grandcontained.b, container2.b)).toBe(false);
            expect(container.child.canConnect(grandcontained.a, contained2.a)).toBe(false);
            expect(container.child.canConnect(grandcontained.b, contained2.b)).toBe(false);
        }
                
    });
});