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
