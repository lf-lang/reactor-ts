import {PrecedenceGraph, Vertex} from '../src/util';

class Reaction implements Vertex {
    id: number;
    precedence:number;
    constructor(id: number) {
        this.id = id;
    }
}

var graph:PrecedenceGraph<Reaction> = new PrecedenceGraph();

var nodes = [new Reaction(1), new Reaction(2), new Reaction(3), 
    new Reaction(4), new Reaction(5), new Reaction(6)];

var r7 = new Reaction(7);

graph.addEdge(nodes[3], nodes[5]);
graph.addEdge(nodes[4], nodes[3]);
graph.addEdge(nodes[2], nodes[3]);
graph.addEdge(nodes[1], nodes[2]);
graph.addEdge(nodes[1], nodes[4]);
graph.addEdge(nodes[0], nodes[1]);
graph.addEdge(nodes[0], nodes[4]);

graph.orderVertices();

describe('Precedence Graph', () => {
    
    it('precedence of node 3', () => {
         expect(nodes[2]).toEqual({id: 3, precedence: 300});
    });

    it('precedence of node 2', () => {
        expect(nodes[1]).toEqual({id: 2, precedence: 400});
    });

    it('remove dependency 5 -> 4', () => {
        graph.removeEdge(nodes[4], nodes[3]);
        expect(graph.size()[0]).toEqual(6); // V
        expect(graph.size()[1]).toEqual(6); // E
    });

    it('remove node 2', () => {
        graph.removeVertex(nodes[1]);
        expect(graph.size()[0]).toEqual(5); // V
        expect(graph.size()[1]).toEqual(3); // E
    });

    it('add node 7, put in front of 3', () => {
        graph.addVertex(r7);
        graph.addEdges(nodes[2], new Set([r7, nodes[3]]));
        expect(graph.size()[0]).toEqual(6); // V
        expect(graph.size()[1]).toEqual(4); // E
    });

    it('reorder vertices', () => {
        graph.orderVertices();
        
        expect(nodes[5]).toEqual({id: 6, precedence: 0});
        expect(nodes[4]).toEqual({id: 5, precedence: 100});
        expect(r7).toEqual({id: 7, precedence: 200});
        expect(nodes[3]).toEqual({id: 4, precedence: 300});
        expect(nodes[0]).toEqual({id: 1, precedence: 400});
        expect(nodes[2]).toEqual({id: 3, precedence: 500});
    });

    it('introduce a cycle', () => {
        graph.addEdge(nodes[5], nodes[2]);
        expect(graph.orderVertices()).toBeFalsy();
    });

});
