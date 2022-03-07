import type { Tag, ScheduledTrigger, Present, PrioritySetElement } from "./internal";

/**
 * An event is caused by a timer or a scheduled action. Each event is tagged
 * with a time instant and may carry a value of arbitrary type. The tag will
 * determine the event's position with respect to other events in the event
 * queue.
 */
 export class TaggedEvent<T extends Present> implements PrioritySetElement<Tag> {

    /**
     * Pointer to the next element of the priority set that this event might
     * be hooked into.
     */
    public next: PrioritySetElement<Tag> | undefined;

    /**
     * Construct a new tagged event.
     * @param trigger The trigger of this event.
     * @param tag The tag at which this event occurs.
     * @param value The value associated with this event. 
     * 
     */
    constructor(public trigger: ScheduledTrigger<T>, public tag: Tag, public value: T) {
    }

    /**
     * Return true if this event has a smaller tag than the given event, false
     * otherwise.
     * @param node The event to compare this event's tag against.
     */
    hasPriorityOver(node: PrioritySetElement<Tag> | undefined) {
        if (node) {
            return this.getPriority().isSmallerThan(node.getPriority());
        } else {
            return false;
        }
    }

    /**
     * Determine whether the given event is a duplicate of this one. If so, assign the
     * value this event to the given one. Otherwise, return false.
     * @param node The event adopt the value from if it is a duplicate of this one.
     */
    updateIfDuplicateOf(node: PrioritySetElement<Tag> | undefined) {
        if (node && node instanceof TaggedEvent) {
            if (this.trigger === node.trigger && this.tag.isSimultaneousWith(node.tag)) {
                node.value = this.value; // update the value
                return true;
            }
        }
        return false;
    }

    /**
     * Return the tag associated with this event.
     */
    getPriority(): Tag {
        return this.tag;
    }
}