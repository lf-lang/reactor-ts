'use strict'

import { _schedule } from "./reactor";

// var Heap = require('heap');
// FIXME: use heap

export type Priority = number;

export class PriorityQueue<T> {
  
  data:Array<{value:T, priority:Priority}>;

  constructor() {
    this.data = [];
  }

  _first() {
    let index = 0;
    let min = Infinity;
    for (let i = 0; i < this.data.length; i++) {
      let priority = this.data[i].priority;
      if (Math.min(min, priority) === priority) {
        min = priority;
        index = i;
      }
    }
    return index;
  }

  remove(priority:Priority) {
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].priority == priority) {
        delete this.data[i];
      }
    }
  }

  push(value:T, priority:Priority = 0) {
    return this.data.push({
      value: value,
      priority: priority
    });
  }

  first() {
    return this.data[this._first()];
  }

  pop(): T {
    return this.data.splice(this._first(), 1)[0].value;
  }

  size() {
    return this.data.length;
  }
}

/* // only need these when using threads
interface Vertex {
  depth: number;
  branchID: bigint;
}
*/

export interface Vertex {
  precedence: number;
}

export class PrecedenceGraph<T extends Vertex> {

  private graph:Map<T, Set<T>> = new Map(); // Map vertices to set of dependencies
  private numberOfEdges = 0;

  addVertex(vertex:T) {
    if (!this.graph.has(vertex)){
      this.graph.set(vertex, new Set());
    }
  }

  removeVertex(vertex:T) {
    let deps:Set<T>|undefined;
    if (deps = this.graph.get(vertex)) {
      this.numberOfEdges -= deps.size;
      this.graph.delete(vertex);
      for (const [v, e] of this.graph) {
        if (e.has(vertex)) {
          e.delete(vertex);
          this.numberOfEdges--;
        }
      }
    }
  }

  // node -> deps
  addEdge(node:T, dependency:T) {
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

  addEdges(node:T, dependencies:Set<T>) {
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

  removeEdge(node:T, dependency:T) {
    let deps = this.graph.get(node);
    if (deps && deps.has(dependency)) {
      deps.delete(dependency);
      this.numberOfEdges--;
    }
  }

  size() {
    return [this.graph.size, this.numberOfEdges];
  }

  orderVertices(spacing:number=100) {
    var start: Array<T> = new Array();
    var clone = new Map();
    var count = 0;
    
    /* duplicate the graph */
    for (const [v,e] of this.graph) {
      clone.set(v, new Set(e));
    }

    /* Populate start set */
    for (const [v,e] of this.graph) {
      if (!e || e.size == 0) {
        start.push(v);
        clone.delete(v);
      }
    }
  
    /* Sort reactions */
    for (var n:T|undefined; (n = start.shift()) != null; count += spacing) {
      n.precedence = count;

      // for each node v with an edge e from n to v do
      for (const [v,e] of clone) {
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
}