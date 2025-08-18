
import Interval from "@rawify/interval";

export default class IntervalMap<V = any> {
    constructor();

    set(it: Interval, val: V): this;
    get(it: Interval): V | null;
    delete(it: Interval): boolean;

    hasOverlap(q: Interval): boolean;
    getOverlapping(q: Interval): Array<{ interval: Interval; value: V }>;
    getAt(x: number, getAll: true): Array<{ interval: Interval; value: V }>;
    getAt(x: number, getAll?: false): V | null;

    getSize(): number;
    isEmpty(): boolean;
    clear(): this;

    forEach(fn: (interval: Interval, value: V) => void): this;
    toArray(): Array<{ interval: Interval; value: V }>;
    toString(): string;

    clone(): IntervalMap<V>;

    /**
     * Build a balanced tree from pairs. When `mergeSame` is true,
     * overlapping/touching intervals with equal value are coalesced first.
     */
    static fromArray<V>(
        pairs: Array<{ interval: Interval; value: V }>,
        mergeSame?: boolean
    ): IntervalMap<V>;
}
