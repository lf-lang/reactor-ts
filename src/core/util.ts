import { LOADIPHLPAPI } from "dns";

const ulog = require("ulog");

/**
 * Utilities for the reactor runtime.
 * 
 * @author Marten Lohstroh (marten@berkeley.edu)
 */

export interface PrioritySetNode<P> {
    /**
     * Get a pointer to the next node in this priority set.
     */
    getNext(): PrioritySetNode<P> | undefined;
    
    /**
     * Set a pointer to the next node in this priority set.
     * @param node Next element in the priority set this node is a part of.
     */
    setNext(node: PrioritySetNode<P> | undefined): void;
    
    /**
     * Return the priority of this node.
     */
    getPriority(): P;

    /**
     * Determine whether this node has priority over the given node or not.
     * @param node A node to compare the priority of this node to.
     */
    hasPriorityOver: (node: PrioritySetNode<P> | undefined) => boolean;
    
    /**
     * If the given node is considered a duplicate of this node, then
     * update this node if needed, and return true. Return false otherwise.
     * @param node A node that may or may not be a duplicate of this node.
     */
    updateIfDuplicateOf: (node: PrioritySetNode<P> | undefined) => boolean;
}

export interface PrecedenceGraphNode<P> {
    setPriority(priority: P): void;
    toString(): string;
}

/**
 * A priority queue that overwrites duplicate entries.
 */
export class PrioritySet<P> {

  private head: PrioritySetNode<P> | undefined;
  private count: number = 0;

  push(element: PrioritySetNode<P>) {
    // update linked list
    if (this.head == undefined) {
      // create head
      element.setNext(undefined);
      this.head = element;
      this.count++;
      return;
    } else if (element.updateIfDuplicateOf(this.head)) {
      return;
    } else {
      // prepend
      if (element.hasPriorityOver(this.head)) {
        element.setNext(this.head);
        this.head = element;
        this.count++;
        return;
      }
      // seek
      var curr: PrioritySetNode<P> | undefined = this.head;
      while (curr) {
        let next: PrioritySetNode<P> | undefined = curr.getNext();
        if (next) {
          if (element.updateIfDuplicateOf(next)) {
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
      if (curr) {
        // insert
        element.setNext(curr.getNext()); // undefined if last
        curr.setNext(element);
        this.count++;
        return;
      }
    }
  }

  pop(): PrioritySetNode<P> | undefined {
    if (this.head) {
      let node = this.head;
      this.head = this.head.getNext();
      node.setNext(undefined); // unhook from linked list
      this.count--;
      return node;
    }
  }

  peek(): PrioritySetNode<P> | undefined {
    if (this.head) {
      return this.head;
    }
  }

  size(): number {
    return this.count;
  }
}

export class PrecedenceGraph<T extends PrecedenceGraphNode<unknown>> {

  protected graph: Map<T, Set<T>> = new Map(); // Map vertices to set of dependencies
  protected numberOfEdges = 0;
  //protected startNodes: Set<T> = new Set(); 

  merge(apg: this) {
    for (const [k, v] of apg.graph) {
      let nodes = this.graph.get(k);
      if (nodes) {
        for (let n of v) {
          if (!nodes.has(n)) {
            nodes.add(n);
            this.numberOfEdges++;
          }
        }
      } else {
        this.graph.set(k, v);
        this.numberOfEdges += v.size;
      }
    }
  }

  addNode(node: T) {
    if (!this.graph.has(node)) {
      this.graph.set(node, new Set());
    }
  }

  removeNode(node: T) {
    let deps: Set<T> | undefined;
    if (deps = this.graph.get(node)) {
        this.numberOfEdges -= deps.size;
        this.graph.delete(node);
        for (const [v, e] of this.graph) {
            if (e.has(node)) {
              e.delete(node);
              this.numberOfEdges--;
            }
        }
    }
  }

  // node -> deps
  addEdge(node: T, dependency: T) {
    let deps = this.graph.get(node);
    if (!deps) {
      this.graph.set(node, new Set([dependency]));
      this.numberOfEdges++;
    } else {
      if (!deps.has(dependency)) {
        deps.add(dependency);
        this.numberOfEdges++;
      }
    }
    if (!this.graph.has(dependency)) {
      this.graph.set(dependency, new Set());
    }
  }

  addBackEdges(node:T, antidependencies: Set<T>) {
    for (let a of antidependencies) {
      this.addEdge(a, node);
    }
  }
  
  addEdges(node: T, dependencies: Set<T>) {
    let deps = this.graph.get(node);
    if (!deps) {
      this.graph.set(node, new Set(dependencies));
      this.numberOfEdges += dependencies.size;
    } else {
      for (let dependency of dependencies) {
        if (!deps.has(dependency)) {
          deps.add(dependency);
          this.numberOfEdges++;
        }
        if (!this.graph.has(dependency)) {
          this.graph.set(dependency, new Set());
        }
      }
    }
  }

  removeEdge(node: T, dependency: T) {
    let deps = this.graph.get(node);
    if (deps && deps.has(dependency)) {
      deps.delete(dependency);
      this.numberOfEdges--;
    }
  }

  size() {
    return [this.graph.size, this.numberOfEdges];
  }

  updatePriorities(spacing: number = 100) {
    var start: Array<T> = new Array();
    var clone = new Map();
    var count = 0;

    /* duplicate the graph */
    for (const [v, e] of this.graph) {
      clone.set(v, new Set(e));
    }

    /* Populate start set */
    for (const [v, e] of this.graph) {
      if (!e || e.size == 0) {
        start.push(v);
        clone.delete(v);
      }
    }

    /* Sort reactions */
    for (var n: T | undefined; (n = start.shift()); count += spacing) {
      n.setPriority(count);

      // for each node v with an edge e from n to v do
      for (const [v, e] of clone) {
        if (e.has(n)) { // v depends on n
          e.delete(n);
        }
        if (e.size == 0) {
          start.push(v);
          clone.delete(v);
        }
      }
    }
    if (clone.size != 0) {
      return false; // ERROR: cycle detected
    } else {
      return true;
    }
  }

  nodes() {
    return this.graph.keys();
  }

  toString() {
    var dot = "digraph G {";
    var start: Array<T> = new Array();
    var graph = this.graph;
    
    function buildChain(node: T, visited:Set<T>):string {
      let dot = "";
      let match = false;

      // Mark current node as visited.
      visited.add(node);
      for (let [v,e] of graph) {
        if (e.has(node)) {
          // Antidependency found.
          let deps = graph.get(node);
          if (match || !deps || deps.size == 0) {
            // Start a new line when this is not the first match,
            // or when the current node is a start node.
            dot += "\n";
            visited = new Set();
          }
          dot += '"' + node.toString() + '"'
          if (!visited.has(v)) {
            dot += "->";
            dot += buildChain(v, visited);
          } else {
            // End the recursion.
            dot += "->";
            dot += '"' + v.toString() + '";';
            Log.debug("Cycle detected.");
          }
          match = true;
        }
      }
      if (!match) {
          dot += '"' + node.toString() + '"' + ";";
      }
      return dot;
    }  
  
    for (const [v, e] of this.graph) {
      if (!e || e.size == 0) {
        start.push(v);
      }
    }
    for (let s of start) {
      Log.debug("startnode: " + s);
      dot += buildChain(s, new Set());
    }
    dot += "\n}"
    return dot;
  }

}

/**
 * Log levels for `Log`.
 * @see Log
 */
enum LogLevel {
  ERROR = 1, 
  WARN,  // 2
  INFO,  // 3
  LOG,   // 4
  DEBUG, // 5
  TRACE, // 6
}

/**
 * Global logging facility that has multiple levels of severity.
 */
export class Log {

  public static levels = LogLevel;

  private static logger = ulog("reactor-ts");
  
  public static debug(msg: string) {
    this.logger.debug(msg);
  }
  
  public static error(msg: string) {
    this.logger.error(msg);
  }

  public static warn(msg: string) {
    this.logger.warn(msg);
  }

  public static info(msg: string) {
    this.logger.info(msg);
  }

  public static log(msg: string) {
    this.logger.info(msg);
  }

  public static trace(msg: string) {
    this.logger.trace(msg);
  }

  public static setLevel(level: LogLevel) {
    this.logger.level = level;
  }

  public static getLevel(): LogLevel {
    return this.logger.level;
  }

}