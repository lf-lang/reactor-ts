// @flow

'use strict';

// declare interface Iterable<>
// see: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map

/**
 * Map with type information (i.e. all keys and values are of the same type),
 * enforced by flow. We should use this `Map` as a drop-in replacement at places
 * Javascript Map is used.
 */
export class Map<K, V> {

    obj: Object;

    constructor() {
        this.obj = {};
    }

    clear() {
        this.obj = {};
    }

    /**
     * Removes any value associated to the key and returns the value that
     * Map.prototype.has(key) would have previously returned.
     */
    delete(key: K): boolean {
        var present = this.has(key);
        delete this.obj[key];
        return present;
    }

    entries() {

        // FIXME:
        // Returns a new Iterator object that contains an array of [key, value] for each element in the Map object in insertion order.
    }

    //forEach() {
        // FIXME:
        // Calls callbackFn once for each key-value pair present in the Map object, in insertion order. If a thisArg parameter is provided to forEach, it will be used as the this value for each callback.
    //}

    get(key: K): ?V {
        return this.obj[key];
    }

    set(key: K, value: V) {
        this.obj[key] = value;
    }

    has(key: K): boolean {
        for (var k in this.keys()) {
            if (k == key) {
                return true;
            }
        }
        return false;
    }

    keys() {
        return this.obj.keys();
    }

    obj() {
        return this.obj.obj();
    }

    values(): Array<V> {
        var arr: Array<V> = [];
        for (var k in this.keys()) {
            arr.push(this.obj[k]);
        }
        return arr;
    }
}
