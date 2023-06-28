/**
 * @file A collection of classes for dealing with graphs.
 * @author Marten Lohstroh <marten@berkeley.edu>
 */

import type { Sortable } from "./types";
import {Log} from "./util";

/**
 * A generic precedence graph.
 */
export class PrecedenceGraph<T> {
  
  /**
   * A map from nodes to the set of nodes that they depend on.
   */
  protected adjacencyMap = new Map<T, Set<T>>();

  /**
   * The total number of edges in the graph.
   */
  protected numberOfEdges = 0;

  /**
   * Add all the nodes and edges from the given precedence graph to this one.
   * @param pg A precedence graph
   */
  addAll(pg: this): void {
    for (const [k, v] of pg.adjacencyMap) {
      const nodes = this.adjacencyMap.get(k);
      if (nodes != null) {
        for (const n of v) {
          if (!nodes.has(n)) {
            nodes.add(n);
            this.numberOfEdges++;
          }
        }
      } else {
        this.adjacencyMap.set(k, v);
        this.numberOfEdges += v.size;
      }
    }
  }


  /**
   * Add the given node to this graph.
   * @param node 
   */
  addNode(node: T): void {
    if (!this.adjacencyMap.has(node)) {
      this.adjacencyMap.set(node, new Set());
    }
  }
  
  /**
   * Return the set of all incoming nodes of the given node.
   * Incoming nodes are immediate upstream neighbors.
   * @param node The node to retrieve the incoming nodes of.
   */
  getInNodes(node: T): Set<T> {
    return this.adjacencyMap.get(node) ?? new Set<T>();
  }

  /**
   * Return the set of all outgoing nodes of the given node.
   * Outgoing nodes are immediate downstream neighbors.
   * @param node The node to retrieve the outgoing nodes of.
   */
  getOutNodes(node: T): Set<T> {
    const backEdges = new Set<T>();
    this.adjacencyMap.forEach((edges, dep) => {
      edges.forEach((edge) => {
        if (edge === node) {
          backEdges.add(dep);
        }
      });
    });
    return backEdges;
  }

  /**
   * Return true if the graph has a cycle in it.
   */
  hasCycle(): boolean {
    const stack = new Array<T>();
    const visited = new Set<T>();
    const currentDirectAncestors = new Set<T>();

    // This uses DFS with iteration to check for back edges in the graph.
    // Iteration is used because TS does not have tail recursion.
    // Refer to https://stackoverflow.com/a/56317289
    for (const v of this.getNodes()) {
      if (visited.has(v)) {
        continue;
      }
      stack.push(v);

      while (stack.length !== 0) {
        const top = stack[stack.length - 1];

        if (visited.has(top)) {
          currentDirectAncestors.delete(top);
          stack.pop();
        } else {
          visited.add(top);
          currentDirectAncestors.add(top);
        }

        for (const child of this.getInNodes(top)) {
          if (currentDirectAncestors.has(child)) return true;
          if (!visited.has(child)) stack.push(child);
        }
      }
    }
    return false;
  }

  /**
   * Remove the given node from the graph.
   * @param node The node to remove.
   */
  removeNode(node: T): void {
    let deps: Set<T> | undefined;
    if ((deps = this.adjacencyMap.get(node)) != null) {
      this.numberOfEdges -= deps.size;
      this.adjacencyMap.delete(node);
      for (const [, e] of this.adjacencyMap) {
        if (e.has(node)) {
          e.delete(node);
          this.numberOfEdges--;
        }
      }
    }
  }

  /**
   * Add an edge that denotes origin effect relationship,
   * which, in the underlying dependency graph, has direction effect->origin.
   */
  addEdge(downstream: T, upstream: T): void {
    // FIXME: switch order.
    const deps = this.adjacencyMap.get(downstream);
    if (deps == null) {
      this.adjacencyMap.set(downstream, new Set([upstream]));
      this.numberOfEdges++;
    } else {
      if (!deps.has(upstream)) {
        deps.add(upstream);
        this.numberOfEdges++;
      }
    }
    // Create an entry for `dependsOn` if it doesn't exist.
    // This is so that the keys of the map contain all the
    // nodes in the graph.
    if (!this.adjacencyMap.has(upstream)) {
      this.adjacencyMap.set(upstream, new Set());
    }
  }

  removeEdge(downstream: T, upstream: T): void {
    const deps = this.adjacencyMap.get(downstream);
    if (deps?.has(upstream) ?? false) {
      deps?.delete(upstream);
      this.numberOfEdges--;
    }
  }

  size(): [number, number] {
    return [this.adjacencyMap.size, this.numberOfEdges];
  }

  getNodes(): IterableIterator<T> {
    return this.adjacencyMap.keys();
  }

  toString: () => string = () => this.toMermaidRepresentation();

  /**
   * Return a representation that conforms with the syntax of mermaid.js
   * @param edgesWithIssue Edges in the **dependency** graph that causes issues
   * to the execution. A set containing arrays with [effect, origin].
   */
  toMermaidRepresentation(edgesWithIssue?: Set<[T, T]>): string {
    if (edgesWithIssue == null) edgesWithIssue = new Set();
    let result = "graph";
    const nodeToNumber = new Map<T, number>();
    const getNodeString = (node: T, def: string): string => {
      if (node == null || node?.toString === Object.prototype.toString) {
        console.error(
          `Encountered node with no toString() implementation: ${String(
            node?.constructor
          )}`
        );
        return def;
      }
      return node.toString();
    };

    // Build a block here since we only need `counter` temporarily here
    {
      let counter = 0;
      for (const v of this.getNodes()) {
        result += `\n${counter}["${getNodeString(v, String(counter))}"]`;
        nodeToNumber.set(v, counter++);
      }
    }
    // This is the effect
    for (const s of this.getNodes()) {
      // This is the origin
      for (const t of this.getInNodes(s)) {
        result += `\n${nodeToNumber.get(t)}`;
        result += edgesWithIssue.has([s, t]) ? " --x " : " --> ";
        result += `${nodeToNumber.get(s)}`;
      }
    }
    return result;
  }

  /**
   * Return a DOT representation of the graph.
   */
  toDOTRepresentation(): string {
    let dot = "";
    const graph = this.adjacencyMap;
    const visited = new Set<T>();

    /**
     * Store the DOT representation of the given chain, which is really
     * just a stack of nodes. The top node of the stack (i.e., the first)
     * element in the chain is given separately.
     * @param node The node that is currently being visited.
     * @param chain The current chain that is being built.
     */
    function printChain(node: T, chain: T[]): void {
      dot += "\n";
      dot += `"${node}"`;
      // TODO (axmmisaka): check if this is equivalent;
      // https://stackoverflow.com/a/47903498
      if (node?.toString === Object.prototype.toString) {
        console.error(
          `Encountered node with no toString() implementation: ${String(
            node?.constructor
          )}`
        );
      }
      while (chain.length > 0) {
        dot += `->"${chain.pop()}"`;
      }
      dot += ";";
    }

    /**
     * Recursively build the chains that emanate from the given node.
     * @param node The node that is currently being visited.
     * @param chain The current chain that is being built.
     */
    function buildChain(node: T, chain: T[]): void {
      let match = false;
      for (const [v, e] of graph) {
        if (e.has(node)) {
          // Found next link in the chain.
          const deps = graph.get(node);
          if (match || deps == null || deps.size === 0) {
            // Start a new line when this is not the first match,
            // or when the current node is a start node.
            chain = [];
            Log.global.debug("Starting new chain.");
          }

          // Mark current node as visited.
          visited.add(node);
          // Add this node to the chain.
          chain.push(node);

          if (chain.includes(v)) {
            Log.global.debug("Cycle detected.");
            printChain(v, chain);
          } else if (visited.has(v)) {
            Log.global.debug("Overlapping chain detected.");
            printChain(v, chain);
          } else {
            Log.global.debug("Adding link to the chain.");
            buildChain(v, chain);
          }
          // Indicate that a match has been found.
          match = true;
        }
      }
      if (!match) {
        Log.global.debug("End of chain.");
        printChain(node, chain);
      }
    }

    const start = new Array<T>();
    // Build a start set of node without dependencies.
    for (const [v, e] of this.adjacencyMap) {
      if (e == null || e.size === 0) {
        start.push(v);
      }
    }

    // Build the chains.
    for (const s of start) {
      buildChain(s, []);
    }

    return "digraph G {" + dot + "\n}";
  }

  public sourceNodes(): Set<T> {
    const roots = new Set<T>();
    /* Populate start set */
    for (const [v, e] of this.adjacencyMap) {
      if (e == null || e.size === 0) {
        roots.add(v); // leaf nodes have no dependencies
        // clone.delete(v); // FIXME add a removeNodes function to factor out the duplicate code below
      }
    }
    return roots;
  }

  // Source nodes are nodes that do not depend on any other nodes.
  // In the context of cyclic graphs it is therefore possible to have a graph without any source nodes.
  // As a result, starting a graph search only from leaf nodes in a cyclic graph will not necessarily traverse the entire graph.
  public sinkNodes(): Set<T> {
    const leafs = new Set<T>(this.getNodes());
    for (const node of this.getNodes()) {
      for (const dep of this.getInNodes(node)) {
        leafs.delete(dep);
      }
    }
    return leafs;
  }
}

export class SortablePrecedenceGraph<
  T extends Sortable<number>
> extends PrecedenceGraph<T> {

  static fromPrecedenceGraph<R, T extends Sortable<number>>(
    apg: PrecedenceGraph<R>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type: new (...args: any[]) => T
  ): SortablePrecedenceGraph<T> {
    const collapsed = new SortablePrecedenceGraph<T>();

    // Originally from reactor.ts.
    // This removes all nodes that are not of type `T`,
    // and reassign node relationship in a way that preserves original lineage.
    const visited = new Set();
    const search = (parentNode: T, nodes: Set<R>): void => {
      for (const node of nodes) {
        if (node instanceof type) {
          collapsed.addEdge(parentNode, node);
          if (!visited.has(node)) {
            visited.add(node);
            search(node, apg.getInNodes(node));
          }
        } else {
          search(parentNode, apg.getInNodes(node));
        }
      }
    };
    const leafs = apg.sinkNodes();
    for (const leaf of leafs) {
      if (leaf instanceof type) {
        collapsed.addNode(leaf);
        search(leaf, apg.getInNodes(leaf));
        visited.clear();
      }
    }

    return collapsed;
  }

  // This implements Kahn's algorithm
  updatePriorities(destructive: boolean, spacing = 100): boolean {
    const start = new Array<T>();
    let graph: Map<T, Set<T>>;
    let count = 0;
    if (!destructive) {
      graph = new Map();
      /* duplicate the map */
      for (const [v, e] of this.adjacencyMap) {
        graph.set(v, new Set(e));
      }
    } else {
      graph = this.adjacencyMap;
    }

    /* Populate start set */
    for (const [v, e] of this.adjacencyMap) {
      if (e == null || e.size === 0) {
        start.push(v); // start nodes have no dependencies
        graph.delete(v);
      }
    }
    /* Sort reactions */
    for (let n: T | undefined; (n = start.shift()) != null; count += spacing) {
      n.setPriority(count);
      // for each node v with an edge e from n to v do
      for (const [v, e] of graph) {
        if (e.has(n)) {
          // v depends on n
          e.delete(n);
        }
        if (e.size === 0) {
          start.push(v);
          graph.delete(v);
        }
      }
    }
    if (graph.size !== 0) {
      return false; // ERROR: cycle detected
    } else {
      return true;
    }
  }
}
