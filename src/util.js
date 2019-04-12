// @flow
'use strict'

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

  pop() {
    return this.data.splice(this._first(), 1)[0].value;
  }

  size() {
    return this.data.length;
  }
}