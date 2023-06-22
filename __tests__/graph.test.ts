import type {PrioritySetElement, Sortable} from "../src/core/graph";
import {
  DependencyGraph,
  PrioritySet,
  SortableDependencyGraph
} from "../src/core/graph";
/**
 * The tests below test the functionality of the hasCycle() utility function on various
 * dependency graphs, in combination with various graph manipulation utilities
 *
 * @author Matt Chorlian (mattchorlian@berkeley.edu)
 */

const node1 = 1;
const node2 = 2;
const node3 = 3;
const node4 = 4;
const node5 = 5;

const d0 = new DependencyGraph<number>();
d0.addNode(node1);
d0.addEdge(node1, node1);

test("test if one node cycle is caught", () => {
  expect(d0.hasCycle()).toEqual(true);
});

const d1 = new DependencyGraph<number>();
d1.addNode(node1);
d1.addNode(node2);

test("test hasCycle utility function on no cycle", () => {
  expect(d1.hasCycle()).toEqual(false);
});

const d2 = new DependencyGraph<number>();
d2.addNode(node1);
d2.addNode(node2);
d2.addEdge(node1, node2);

test("test pureEffectNodes() helper function", () => {
  expect(d2.pureEffectNodes()).toEqual(new Set([node1]));
});

test("test pureOriginNodes() helper function", () => {
  expect(d2.pureOriginNodes()).toEqual(new Set([node2]));
});

const d3 = new DependencyGraph<number>();
d3.addNode(node1);
d3.addNode(node2);
d3.addEdge(node1, node2);
d3.addEdge(node2, node1);

test("test hasCycle utility function on a cycle", () => {
  expect(d3.hasCycle()).toEqual(true);
});

test("test number of edges", () => {
  expect(d3.size()[1]).toBe(2);
});

const d4 = new DependencyGraph<number>();
d4.addNode(node1);
d4.addNode(node2);
d4.addNode(node3);
d4.addNode(node4);
d4.addEdge(node2, node1);
d4.addEdge(node3, node2);
d4.addEdge(node4, node3);
d4.addEdge(node1, node4);

test("test hasCycle utility function on a larger cycle", () => {
  expect(d4.hasCycle()).toEqual(true);
});

const d5 = new DependencyGraph<number>();
d5.addNode(node1);
d5.addNode(node2);
d5.addNode(node3);
d5.addEdge(node2, node1);
d5.addEdge(node3, node2);
d5.addEdge(node1, node3);

test("test hasCycle along on mutated graph", () => {
  expect(d5.hasCycle()).toEqual(true);
});

const d6 = new DependencyGraph<number>();
d6.addNode(node1);
d6.addNode(node2);
d6.addNode(node3);
d6.addEdge(node2, node1);
d6.addEdge(node3, node2);
d6.addEdge(node3, node1);

test("test hasCycle along on mutated graph with no cycles", () => {
  expect(d6.hasCycle()).toEqual(false);
});
class SimpleElement implements PrioritySetElement<number> {
  next: PrioritySetElement<number> | undefined;

  constructor(private priority: number) {}

  getPriority(): number {
    return this.priority;
  }

  hasPriorityOver(node: PrioritySetElement<number>): boolean {
    return this.priority < node.getPriority();
  }

  updateIfDuplicateOf(node: PrioritySetElement<number> | undefined): boolean {
    if (node) {
      return this.priority == node.getPriority();
    }
    return false;
  }
}
const ps0 = new PrioritySet<number>();
test("test priority set", () => {
  ps0.push(new SimpleElement(3));
  ps0.push(new SimpleElement(5));
  ps0.push(new SimpleElement(5));
  ps0.push(new SimpleElement(7));
  ps0.push(new SimpleElement(1));
  ps0.push(new SimpleElement(4));
  ps0.push(new SimpleElement(1));
  expect(ps0.size()).toBe(5);
  expect(ps0.peek()?.getPriority()).toBe(1);
  expect(ps0.pop()?.getPriority()).toBe(1);
  ps0.empty();
  expect(ps0.size()).toBe(0);
});
const d7 = new DependencyGraph<number>();
const d8 = new DependencyGraph<number>();
const d9 = new DependencyGraph<number>();
test("test dependency graph", () => {
  expect(d7.getOriginsOfEffect(node1).size).toBe(0);
  d7.merge(d5);
  expect(d7.size()).toStrictEqual(d5.size());

  d8.addNode(node1);
  d9.addEdge(node1, node2);
  d8.merge(d9);
  expect(d8.size()).toStrictEqual(d9.size());
  expect(d9.getEffectsOfOrigin(node2).size).toBe(1);
  d8.removeNode(node2);
  expect(d8.size()).toStrictEqual([1, 0]);
});

const d10 = new DependencyGraph<number>();
test("test add/remove Edges", () => {
  d10.addEdge(node1, node2); // {(node1 -> node2)}
  expect(d10.size()).toStrictEqual([2, 1]);

  d10.addEdge(node1, node2);
  d10.addEdge(node3, node2);
  expect(d10.size()).toStrictEqual([3, 2]);

  d10.addEdge(node1, node2);
  d10.addEdge(node1, node3);
  d10.addEdge(node1, node4);
  expect(d10.size()).toStrictEqual([4, 4]);

  d10.addEdge(node5, node1);
  expect(d10.size()).toStrictEqual([5, 5]);

  d10.removeEdge(node1, node2); // {(node1 -> node3), (node1 -> node4), (node3 -> node2), {node5 -> node1}}
  expect(d10.size()).toStrictEqual([5, 4]);
});

const d11 = new DependencyGraph<number>();
const d12 = new DependencyGraph<Object>();
test("test the DOT representation of the dependency graph", () => {
  expect(d11.toString()).toBe("digraph G {" + "\n}");

  d11.addNode(node1); // { node1 }
  expect(d11.toString()).toBe('digraph G {\n"1";\n}');

  d11.addEdge(node1, node2); // { (node1 -> node2) }
  d11.addEdge(node2, node3); // { (node1 -> node2 -> node3) }
  expect(d11.toString()).toBe('digraph G {\n"1"->"2"->"3";\n}');

  const obj = {0: 1};
  d12.addNode(obj);
  expect(d12.toString()).toBe('digraph G {\n"[object Object]";\n}');

  d11.addEdge(node2, node1);
  expect(d11.toString()).toBe('digraph G {\n"2"->"1"->"2"->"3";\n}');
  d11.addEdge(node1, node3);
  expect(d11.toString()).toBe('digraph G {\n"1"->"2"->"1"->"3";\n"2"->"3";\n}');
});

const d13 = new DependencyGraph<number>();
test("test for reachableOrigins function of the dependency graph", () => {
  d13.addEdge(node1, node2);
  d13.addEdge(node1, node3);
  d13.addEdge(node2, node4); // { (node1 -> node2 -> node4), (node1 -> node3) }
  expect(d13.reachableOrigins(node1, new Set<number>(d13.getNodes())).size).toBe(
    3
  );
  expect(d13.reachableOrigins(node2, new Set<number>(d13.getNodes())).size).toBe(
    1
  );
  expect(d13.reachableOrigins(node3, new Set<number>(d13.getNodes())).size).toBe(
    0
  );
  expect(d13.reachableOrigins(node4, new Set<number>(d13.getNodes())).size).toBe(
    0
  );
});

const sd0 = new SortableDependencyGraph<Sortable<number>>();
const sd1 = new SortableDependencyGraph<Sortable<number>>();

class SortVariable implements Sortable<number> {
  next: PrioritySetElement<number> | undefined;

  constructor(private priority: number) {}

  setPriority(priority: number): void {
    priority = this.priority;
  }
}

const s0 = new SortVariable(0);
const s1 = new SortVariable(1);
test("test sortable dependency graph", () => {
  sd0.addEdge(s0, s1);
  expect(sd0.updatePriorities(false, 100)).toBe(true);
  sd0.addEdge(s1, s0);
  expect(sd0.updatePriorities(true, 0)).toBe(false);
  expect(sd1.updatePriorities(true, 0)).toBe(true);
});
