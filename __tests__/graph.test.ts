import {DependencyGraph, PrioritySet, PrioritySetElement, SortableDependencyGraph, Sortable} from "../src/core/graph";
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
let node5:number = 5

let d0 = new DependencyGraph<number>()
d0.addNode(node1)
d0.addEdge(node1, node1)

test('test if one node cycle is caught', () => {
    expect(d0.hasCycle()).toEqual(true)
})
 
let d1 = new DependencyGraph<number>()
d1.addNode(node1)
d1.addNode(node2)

test('test hasCycle utility function on no cycle', () => {
    expect(d1.hasCycle()).toEqual(false)
})

let d2 = new DependencyGraph<number>()
d2.addNode(node1)
d2.addNode(node2)
d2.addEdge(node1, node2)

test('test leafNodes() helper function', () => {
    expect(d2.leafNodes()).toEqual(new Set([node1]))
})

test('test rootNodes() helper function', () => {
    expect(d2.rootNodes()).toEqual(new Set([node2]))
})

let d3 = new DependencyGraph<number>()
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

let d4 = new DependencyGraph<number>()
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

let d5 = new DependencyGraph<number>()
d5.addNode(node1)
d5.addNode(node2)
d5.addNode(node3)
d5.addEdge(node2, node1)
d5.addEdge(node3, node2)
d5.addEdge(node1, node3)

test('test hasCycle along on mutated graph', () => {
    expect(d5.hasCycle()).toEqual(true)
})

let d6 = new DependencyGraph<number>()
d6.addNode(node1)
d6.addNode(node2)
d6.addNode(node3)
d6.addEdge(node2, node1)
d6.addEdge(node3, node2)
d6.addEdge(node3, node1)

test('test hasCycle along on mutated graph with no cycles', () => {
    expect(d6.hasCycle()).toEqual(false)
})
class SimpleElement implements PrioritySetElement<number> {
    next: PrioritySetElement<number> | undefined;
    constructor(private priority: number) {}
    getPriority(): number {
        return this.priority
    }
    hasPriorityOver (node: PrioritySetElement<number>): boolean {
        return  this.priority < node.getPriority()
    }
    updateIfDuplicateOf (node: PrioritySetElement<number> | undefined): boolean {
        if(node) {
            return this.priority == node.getPriority()
        }
        return false
    }
}
test('test priority set', () => {
    let ps0 = new PrioritySet<number>()
    ps0.push(new SimpleElement(3))
    ps0.push(new SimpleElement(5))
    ps0.push(new SimpleElement(5))
    ps0.push(new SimpleElement(7))
    ps0.push(new SimpleElement(1))
    ps0.push(new SimpleElement(4))
    ps0.push(new SimpleElement(1))       
    expect(ps0.size()).toBe(5)
    expect(ps0.peek()?.getPriority()).toBe(1)
    expect(ps0.pop()?.getPriority()).toBe(1)
    ps0.empty()
    expect(ps0.size()).toBe(0)

})
let d7 = new DependencyGraph<number>()
let d8 = new DependencyGraph<number>()
let d9 = new DependencyGraph<number>()
test('test dependency graph', () => {
    expect(d7.getEdges(node1).size).toBe(0)
    d7.merge(d5)
    expect(d7.size()).toStrictEqual(d5.size())
    d8.addNode(node1)
    d9.addEdge(node1, node2)
    d8.merge(d9)
    expect(d8.size()).toStrictEqual(d9.size())
    expect(d9.getBackEdges(node2).size).toBe(1)
    d8.removeNode(node2)
    expect(d8.size()).toStrictEqual([1,0])
})


let d10 = new DependencyGraph<number>()
test('test add/remove Edges', () => {
    d10.addEdge(node1, node2)                   // {(node1 -> node2)}
    expect(d10.size()).toStrictEqual([2, 1])

    d10.addBackEdges(node2, new Set<number>().add(node1).add(node3))  // {(node1 -> node2), (node3 -> node2)}
    expect(d10.size()).toStrictEqual([3, 2])

    d10.addEdges(node1, new Set<number>().add(node2).add(node3).add(node4))      // {(node1 -> node2), (node1 -> node3), (node1 -> node4), (node3 -> node2)}
    expect(d10.size()).toStrictEqual([4, 4])

    d10.addEdges(node5, new Set<number>().add(node1))   // {(node1 -> node2), (node1 -> node3), (node1 -> node4), (node3 -> node2), {node5 -> node1}}
    expect(d10.size()).toStrictEqual([5, 5])    

    d10.removeEdge(node1, node2)        // {(node1 -> node3), (node1 -> node4), (node3 -> node2), {node5 -> node1}}
    expect(d10.size()).toStrictEqual([5, 4])

})

let d11 = new DependencyGraph<number>()
test('test the DOT representation of the dependency graph', () => {
    expect(d11.toString()).toBe('digraph G {'+'\n}')

    d11.addNode(node1)          // { node1 }
    expect(d11.toString()).toBe('digraph G {\n"1";\n}')

    d11.addEdge(node1, node2)   // { (node1 -> node2) }
    expect(d11.toString()).toBe('digraph G {\n"1"->"2";\n}')

    // d11.addEdge(node2, node1)   // { (node1 -> node2), (node2 -> node1) }
    // expect(d11.toString()).toBe('digraph G {\n}')
})

let sd0 = new SortableDependencyGraph<Sortable<number>>()
let sd1 = new SortableDependencyGraph<Sortable<number>>()

class SortVariable implements Sortable<number> {
    next: PrioritySetElement<number> | undefined;
    constructor(private priority: number) {}
    setPriority(priority: number): void {
        priority = this.priority
    }
}

test("test sortable dependency graph", () =>  {
    sd0.addEdge(new SortVariable(1), new SortVariable(1))
    sd0.updatePriorities(true, 100)
    sd1.updatePriorities(false, 100)

})