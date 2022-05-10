import {DependencyGraph} from "../src/core/graph";

/** 
 * The tests below test the functionality of the hasCycle() utility function on various
 * dependency graphs, in combination with various graph manipulation utilities
 * 
 * @author Matt Chorlian (mattchorlian@berkeley.edu)
 */

let simple = new DependencyGraph()
let n:number = 1
simple.addNode(n)
simple.addEdge(n, n)

test('test if one node cycle is caught', () => {
    expect(simple.hasCycle()).toEqual(true)
})

 
let d = new DependencyGraph()
let node1:number = 1
let node2:number = 2
d.addNode(node1)
d.addNode(node2)


test('test hasCycle utility function on no cycle', () => {
    expect(d.hasCycle()).toEqual(false)
})

d.addEdge(node1, node2)

test('test leafNodes() helper function', () => {
    expect(d.leafNodes()).toEqual(new Set([node1]))
})

test('test rootNodes() helper function', () => {
    expect(d.rootNodes()).toEqual(new Set([node2]))
})

d.addEdge(node2, node1)


test('test hasCycle utility function on a cycle', () => {
    expect(d.hasCycle()).toEqual(true)
})

test('test number of edges', () => {
    expect(d.size()[1]).toBe(2)
})

let d2 = new DependencyGraph()
let n1:number = 1
let n2:number = 2
let n3:number = 3
let n4:number = 4
d2.addNode(n1)
d2.addNode(n2)
d2.addNode(n3)
d2.addNode(n4)
d2.addEdge(n2, n1)
d2.addEdge(n3, n2)
d2.addEdge(n4, n3)
d2.addEdge(n1, n4)

test('test hasCycle utility function on a larger cycle', () => {
    expect(d2.hasCycle()).toEqual(true)
})

d2.removeNode(n4)
d2.addEdge(n1, n3)

test('test hasCycle along on mutated graph', () => {
    expect(d2.hasCycle()).toEqual(true)
})

d2.removeEdge(n1, n3)
d2.addEdge(n3, n1)

test('test hasCycle along on mutated graph with no cycles', () => {
    expect(d2.hasCycle()).toEqual(false)
})

