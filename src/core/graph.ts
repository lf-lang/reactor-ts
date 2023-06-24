import {Log} from "./util";

/**
 * Utilities for the reactor runtime.
 *
 * @author Marten Lohstroh (marten@berkeley.edu)
 */

export interface PrioritySetElement<P> {
  /**
   * Pointer to the next node in the priority set.
   */
  next: PrioritySetElement<P> | undefined;

  /**
   * Return the priority of this node.
   */
  getPriority: () => P;

  /**
   * Determine whether this node has priority over the given node or not.
   * @param node A node to compare the priority of this node to.
   */
  hasPriorityOver: (node: PrioritySetElement<P>) => boolean;

  /**
   * If the given node is considered a duplicate of this node, then
   * update this node if needed, and return true. Return false otherwise.
   * @param node A node that may or may not be a duplicate of this node.
   */
  updateIfDuplicateOf: (node: PrioritySetElement<P> | undefined) => boolean;
}

export interface Sortable<P> {
  setPriority: (priority: P) => void;

  // getSTPUntil(): TimeInstant
  // setSTPUntil(): TimeInstant
}

/**
 * A priority queue that overwrites duplicate entries.
 */
export class PrioritySet<P> {
  private head: PrioritySetElement<P> | undefined;

  private count = 0;

  push(element: PrioritySetElement<P>): void {
    // update linked list
    if (this.head === undefined) {
      // create head
      element.next = undefined;
      this.head = element;
      this.count++;
    } else if (element.updateIfDuplicateOf(this.head)) {
      // updateIfDuplicateOf returned true, i.e.,
      // it has updated the value of this.head to
      // equal that of element.
    } else {
      // prepend
      if (element.hasPriorityOver(this.head)) {
        element.next = this.head;
        this.head = element;
        this.count++;
        return;
      }
      // seek
      let curr: PrioritySetElement<P> | undefined = this.head;
      while (curr != null) {
        const next: PrioritySetElement<P> | undefined = curr.next;
        if (next != null) {
          if (element.updateIfDuplicateOf(next)) {
            // updateIfDuplicateOf returned true, i.e.,
            // it has updated the value of this.head to
            // equal that of element.
            return;
          } else if (element.hasPriorityOver(next)) {
            break;
          } else {
            curr = next;
          }
        } else {
          break;
        }
      }
      if (curr != null) {
        // insert
        element.next = curr.next; // undefined if last
        curr.next = element;
        this.count++;
      }
    }
  }

  pop(): PrioritySetElement<P> | undefined {
    if (this.head != null) {
      const node = this.head;
      this.head = this.head.next;
      node.next = undefined; // unhook from linked list
      this.count--;
      return node;
    }
  }

  peek(): PrioritySetElement<P> | undefined {
    if (this.head != null) {
      return this.head;
    }
  }

  size(): number {
    return this.count;
  }

  empty(): void {
    this.head = undefined;
    this.count = 0;
  }
}

export class DependencyGraph<T> {
  /**
   * Map nodes to the set of nodes that they depend on.
   **/
  protected adjacencyMap = new Map<T, Set<T>>();

  protected numberOfEdges = 0;

  merge(apg: this): void {
    for (const [k, v] of apg.adjacencyMap) {
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

  addNode(node: T): void {
    if (!this.adjacencyMap.has(node)) {
      this.adjacencyMap.set(node, new Set());
    }
  }

  getOriginsOfEffect(node: T): Set<T> {
    return this.adjacencyMap.get(node) ?? new Set<T>();
  }

  getEffectsOfOrigin(node: T): Set<T> {
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
   * Return the subset of origins that are reachable from the given effect.
   * @param effect A node in the graph that to search upstream of.
   * @param origins A set of nodes to be found anywhere upstream of effect.
   */
  reachableOrigins(effect: T, origins: Set<T>): Set<T> {
    const visited = new Set<T>();
    const reachable = new Set<T>();
    /**
     * Recursively traverse the graph to collect reachable origins.
     * @param current The current node being visited.
     */
    const search = (current: T): void => {
      visited.add(current);
      if (origins.has(current)) reachable.add(current);
      for (const next of this.getOriginsOfEffect(current)) {
        if (!visited.has(next)) search(next);
      }
    }
    search(effect);
    reachable.delete(effect);

    return reachable;
  }

  /**
   * This uses DFS with iteration to check for back edges in the graph.
   * Iteration is used because TS does not have tail recursion.
   * Refer to https://stackoverflow.com/a/56317289
   */
  hasCycle(): boolean {
    const stack = new Array<T>;
    const visited = new Set<T>;
    const currentDirectAncestors = new Set<T>;

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

        for (const child of this.getOriginsOfEffect(top)) {
          if (currentDirectAncestors.has(child)) return true;
          if (!visited.has(child)) stack.push(child);
        }
      }
    }
    return false;
  }

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
  addEdge(effect: T, origin: T): void {
    const deps = this.adjacencyMap.get(effect);
    if (deps == null) {
      this.adjacencyMap.set(effect, new Set([origin]));
      this.numberOfEdges++;
    } else {
      if (!deps.has(origin)) {
        deps.add(origin);
        this.numberOfEdges++;
      }
    }
    // Create an entry for `dependsOn` if it doesn't exist.
    // This is so that the keys of the map contain all the
    // nodes in the graph.
    if (!this.adjacencyMap.has(origin)) {
      this.adjacencyMap.set(origin, new Set());
    }
  }

  removeEdge(node: T, dependsOn: T): void {
    const deps = this.adjacencyMap.get(node);
    if (deps?.has(dependsOn) ?? false) {
      deps?.delete(dependsOn);
      this.numberOfEdges--;
    }
  }

  size(): [number, number] {
    return [this.adjacencyMap.size, this.numberOfEdges];
  }

  getNodes(): IterableIterator<T> {
    return this.adjacencyMap.keys();
  }

  toString : (() => string) = (() => this.toMermaidRepresentation());

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
          `Encountered node with no toString() implementation: ${String(node?.constructor)}`
        );
        return def;
      }
      return node.toString();
    };

    // Build a block here since we only need `counter` temporarily here
    {
      let counter = 0;
      for (const v of this.getNodes()) {
        result += `\n${counter}["${getNodeString(v, String(counter))}"]`
        nodeToNumber.set(v, counter++);
      }
    }
    // This is the effect
    for (const s of this.getNodes()) {
      // This is the origin
      for (const t of this.getOriginsOfEffect(s)) {
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

  public pureOriginNodes(): Set<T> {
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

  // Leaf nodes are nodes that do not depend on any other nodes.
  //
  // In the context of cyclic graphs it is therefore possible to
  // have a graph without any leaf nodes.
  // As a result, starting a graph search only from leaf nodes in a
  // cyclic graph, will not necessarily traverse the entire graph.
  public pureEffectNodes(): Set<T> {
    const leafs = new Set<T>(this.getNodes());
    for (const node of this.getNodes()) {
      for (const dep of this.getOriginsOfEffect(node)) {
        leafs.delete(dep);
      }
    }
    return leafs;
  }
}

export class SortableDependencyGraph<
  T extends Sortable<number>
> extends DependencyGraph<T> {
  static fromDependencyGraph<R, T extends Sortable<number>>(
      apg: DependencyGraph<R>, 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: new (...args: any[]) => T): SortableDependencyGraph<T> {
    const collapsed = new SortableDependencyGraph<T>();

    // Originally from reactor.ts. This removes all nodes that are not of type `Sortable<number>`,
    // And reassign node relationship, preserving original lineage.
    const visited = new Set();
    const search = (reaction: T, nodes: Set<R>): void => {
      for (const node of nodes) {
        if (node instanceof type) {
          collapsed.addEdge(reaction, node);
          if (!visited.has(node)) {
            visited.add(node);
            search(node, apg.getOriginsOfEffect(node));
          }
        } else {
          search(reaction, apg.getOriginsOfEffect(node));
        }
      }
    }
    const leafs = apg.pureEffectNodes();
    for (const leaf of leafs) {
      if (leaf instanceof type) {
        collapsed.addNode(leaf);
        search(leaf, apg.getOriginsOfEffect(leaf));
        visited.clear();
      }
    }

    return collapsed;
  }

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
