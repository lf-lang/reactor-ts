import {DirectorBase} from './director';
import {InputPort, OutputPort, Composite} from './hierarchy';

describe('directorbase', () => {
    let director = new DirectorBase();

    it('cannot push to unassociated port', () => {
        let input: InputPort<number> = new InputPort("in");
        expect(() => {
            director.push(input);
        }).toThrowError("Cannot send to an unassociated port.");
    });


    it('cannot connect unassociated port', () => {
        let input: InputPort<number> = new InputPort("in");
        let output: InputPort<number> = new OutputPort("out");
        expect(() => {
            director.connect(input, output);
        }).toThrowError("Cannot connect unaffiliated ports; " +
                        "add them to a container first.");
    });

    it('push to input port', () => {
        let composite = new Composite("composite");
        let input: InputPort<number> = new InputPort("in");
        let output: OutputPort<number> = new OutputPort("out");
        composite.add(input);
        composite.add(output);
        let relation = director.connect(input, output);
        director.push(input, 1);
        expect(relation.buffer).toEqual([1]);

        // let value = director.peek(input, 0);
        // expect(value).toBe(1);
    });
});
