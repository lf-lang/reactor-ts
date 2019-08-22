'use strict'

import { _schedule } from "./reactor";

export type Priority = number;

export interface PrioritySetNode<T,S> {
  _id:T;
  _priority:S;
  _next:PrioritySetNode<T,S>|null;
  hasPrecedenceOver(node:PrioritySetNode<T,S>);
}

export interface PrecedenceGraphNode {
  _priority: number;
}

export class PrioritySet<T,S> {

  elements: Map<T, PrioritySetNode<T,S>>;
  head: PrioritySetNode<T,S>|null;

  push(element: PrioritySetNode<T,S>) {
    let duplicate = this.elements.get(element._id);
    this.elements.set(element._id, element);
    if (duplicate == null) {
      // add node to list
      if (this.head == null || element.hasPrecedenceOver(this.head)) {
        // prepend if list is empty or element has highest precedence
        element._next = this.head;
        this.head = element;
      } else {
        // insert
        var curr = this.head;
        var prev;
        while (curr._next != null) {
          if (element.hasPrecedenceOver(curr)) {
            break;
          } else {
            prev = curr;
            curr = curr._next;
          }
        }
        prev._next = element;
        element._next = curr;
      }
    }
  }

  pop():PrioritySetNode<T,S>|undefined {
    if (this.head != null) {
      if (this.head != null) {
        let node = this.head;
        this.elements.delete(this.head._id);
        this.head = this.head._next;
        return node;
      }
    }
  }

  peek(): PrioritySetNode<T,S>|undefined {
    if (this.head != null) {
      return this.head;
    }
  }
}

export class PrecedenceGraph<T extends PrecedenceGraphNode> {

  private graph:Map<T, Set<T>> = new Map(); // Map vertices to set of dependencies
  private numberOfEdges = 0;

  addNode(node:T) {
    if (!this.graph.has(node)){
      this.graph.set(node, new Set());
    }
  }

  removeNode(node:T) {
    let deps:Set<T>|undefined;
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

  updatePriorities(spacing:number=100) {
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
      n._priority = count;

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