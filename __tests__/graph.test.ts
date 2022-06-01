import {DependencyGraph} from "../src/core/graph";

/** 
 * The tests below test the functionality of the hasCycle() utility function on various
 * dependency graphs, in combination with various graph manipulation utilities
 * 
 * @author Matt Chorlian (mattchorlian@berkeley.edu)
 */

let node1:number = 1
let node2:number = 2
let node3:number = 3
let node4:number = 4

let d0 = new DependencyGraph()
d0.addNode(node1)
d0.addEdge(node1, node1)

test('test if one node cycle is caught', () => {
    expect(d0.hasCycle()).toEqual(true)
})
 
let d1 = new DependencyGraph()
d1.addNode(node1)
d1.addNode(node2)

test('test hasCycle utility function on no cycle', () => {
    expect(d1.hasCycle()).toEqual(false)
})

let d2 = new DependencyGraph()
d2.addNode(node1)
d2.addNode(node2)
d2.addEdge(node1, node2)

test('test leafNodes() helper function', () => {
    expect(d2.leafNodes()).toEqual(new Set([node1]))
})

test('test rootNodes() helper function', () => {
    expect(d2.rootNodes()).toEqual(new Set([node2]))
})

let d3 = new DependencyGraph()
d3.addNode(node1)
d3.addNode(node2)
d3.addEdge(node1, node2)
d3.addEdge(node2, node1)

test('test hasCycle utility function on a cycle', () => {
    expect(d3.hasCycle()).toEqual(true)
})

test('test number of edges', () => {
    expect(d3.size()[1]).toBe(2)
})

let d4 = new DependencyGraph()
d4.addNode(node1)
d4.addNode(node2)
d4.addNode(node3)
d4.addNode(node4)
d4.addEdge(node2, node1)
d4.addEdge(node3, node2)
d4.addEdge(node4, node3)
d4.addEdge(node1, node4)

test('test hasCycle utility function on a larger cycle', () => {
    expect(d4.hasCycle()).toEqual(true)
})

let d5 = new DependencyGraph()
d5.addNode(node1)
d5.addNode(node2)
d5.addNode(node3)
d5.addEdge(node2, node1)
d5.addEdge(node3, node2)
d5.addEdge(node1, node3)

test('test hasCycle along on mutated graph', () => {
    expect(d5.hasCycle()).toEqual(true)
})

let d6 = new DependencyGraph()
d6.addNode(node1)
d6.addNode(node2)
d6.addNode(node3)
d6.addEdge(node2, node1)
d6.addEdge(node3, node2)
d6.addEdge(node3, node1)

test('test hasCycle along on mutated graph with no cycles', () => {
    expect(d6.hasCycle()).toEqual(false)
})