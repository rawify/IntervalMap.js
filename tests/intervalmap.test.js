
'use strict';

const { expect } = require('chai');

const Interval = require('@rawify/interval');
const IntervalMap = require('../dist/intervalmap.js');

describe('IntervalMap (edge cases)', function () {

    function newInterval(a, b) { return new Interval(a, b); }

    it('inserts and gets exact interval values; replaces on duplicate', function () {
        const m = new IntervalMap();
        m.set(newInterval(1, 5), 'A');
        expect(m.get(newInterval(1, 5))).to.equal('A');

        // Replace value for exact-duplicate interval
        m.set(newInterval(1, 5), 'A2');
        expect(m.get(newInterval(1, 5))).to.equal('A2');

        // Non-existent exact interval
        expect(m.get(newInterval(1, 4))).to.equal(null);
    });

    it('hasOverlap respects closed intervals (touching counts)', function () {
        const m = new IntervalMap();
        m.set(newInterval(10, 20), 'X');

        // Overlap inside
        expect(m.hasOverlap(newInterval(15, 18))).to.equal(true);
        // Touching left boundary: [5,10] with [10,20] (closed) => true
        expect(m.hasOverlap(newInterval(5, 10))).to.equal(true);
        // Touching right boundary: [20,25]
        expect(m.hasOverlap(newInterval(20, 25))).to.equal(true);
        // Gap
        expect(m.hasOverlap(newInterval(21, 25))).to.equal(false);
    });

    it('getOverlapping returns all overlaps (sorted by start,end) and handles boundaries', function () {
        const m = new IntervalMap();
        m.set(newInterval(0, 3), 'A');
        m.set(newInterval(3, 5), 'B');   // touches A at 3
        m.set(newInterval(6, 10), 'C');

        const q1 = m.getOverlapping(newInterval(3, 3));
        expect(q1.map(e => e.value)).to.deep.equal(['A', 'B']); // both contain 3 in closed semantics

        const q2 = m.getOverlapping(newInterval(1, 7));
        expect(q2.map(e => e.value)).to.deep.equal(['A', 'B', 'C']);

        const q3 = m.getOverlapping(newInterval(11, 12));
        expect(q3).to.deep.equal([]);
    });

    it('getAt fast path: returns one match (non-deterministic allowed) when overlaps exist; deterministic for non-overlap', function () {
        const m = new IntervalMap();
        // non-overlapping case
        m.set(newInterval(0, 10), 'A');
        m.set(newInterval(20, 30), 'B');

        expect(m.getAt(5)).to.equal('A');
        expect(m.getAt(25)).to.equal('B');
        expect(m.getAt(-1)).to.equal(null);

        // overlapping case — single result can be any overlapping value
        m.set(newInterval(5, 15), 'C');
        const one = m.getAt(7);
        expect(one).to.be.oneOf(['A', 'C']); // allow fast-path non-determinism

        // getAll=true should collect both
        const all = m.getAt(7, true);
        const vals = all.map(e => e.value).sort();
        expect(vals).to.deep.equal(['A', 'C'].sort());
    });

    it('delete handles leaf, one-child, and two-children cases; returns boolean', function () {
        const m = new IntervalMap();
        // build a small shape to exercise delete cases
        m.set(newInterval(10, 20), 'A'); // root
        m.set(newInterval(5, 8), 'L');   // leaf-ish
        m.set(newInterval(2, 3), 'LL');  // left-left to create depth
        m.set(newInterval(12, 18), 'B'); // right child
        m.set(newInterval(25, 30), 'C'); // right-right

        // delete non-existent
        expect(m.delete(newInterval(0, 1))).to.equal(false);

        // delete leaf
        expect(m.delete(newInterval(2, 3))).to.equal(true);
        expect(m.get(newInterval(2, 3))).to.equal(null);

        // delete node with one child (depending on rotations, this may vary but still valid)
        expect(m.delete(newInterval(5, 8))).to.equal(true);
        expect(m.get(newInterval(5, 8))).to.equal(null);

        // delete node with two children (root likely has both)
        expect(m.delete(newInterval(10, 20))).to.equal(true);
        expect(m.get(newInterval(10, 20))).to.equal(null);

        // sanity
        expect(m.hasOverlap(newInterval(25, 26))).to.equal(true);
        expect(m.hasOverlap(newInterval(40, 50))).to.equal(false);
    });

    it('toArray and forEach produce sorted-by-(start,end) results', function () {
        const m = new IntervalMap();
        m.set(newInterval(10, 20), 'A');
        m.set(newInterval(0, 5), 'B');
        m.set(newInterval(7, 9), 'C');
        m.set(newInterval(7, 8), 'D'); // same start, shorter end

        const arr = m.toArray();
        const pairs = arr.map(e => [e.interval.a ?? e.interval['a'], e.interval.b ?? e.interval['b']]);
        expect(pairs).to.deep.equal([
            [0, 5],
            [7, 8],
            [7, 9],
            [10, 20],
        ]);

        const seen = [];
        m.forEach((i, v) => { seen.push([i.a ?? i['a'], i.b ?? i['b'], v]); });
        expect(seen.map(x => x.slice(0, 2))).to.deep.equal(pairs);
    });

    it('clear resets size and empties queries', function () {
        const m = new IntervalMap();
        m.set(newInterval(1, 2), 'x');
        m.set(newInterval(3, 4), 'y');

        expect(m.getSize()).to.equal(2);
        expect(m.isEmpty()).to.equal(false);

        m.clear();
        expect(m.getSize()).to.equal(0);
        expect(m.isEmpty()).to.equal(true);
        expect(m.getOverlapping(newInterval(0, 10))).to.deep.equal([]);
    });

    it('clone performs deep clone of intervals (values copied by reference), structure independent', function () {
        const m = new IntervalMap();
        m.set(newInterval(1, 3), { id: 'A' });
        m.set(newInterval(5, 7), { id: 'B' });

        const c = m.clone();
        expect(c.getSize()).to.equal(2);

        // Structural independence: add/remove in original does not affect clone
        m.set(newInterval(9, 10), { id: 'C' });
        expect(c.getSize()).to.equal(2);
        expect(m.getSize()).to.equal(3);

        // Interval instances should be distinct objects (deep clone)
        const arrOrig = m.toArray();
        const arrClone = c.toArray();
        expect(arrOrig[0].interval).to.not.equal(arrClone[0].interval);
        expect(arrOrig[0].interval.a ?? arrOrig[0].interval['a'])
            .to.equal(arrClone[0].interval.a ?? arrClone[0].interval['a']);
    });

    it('fromArray(mergeSame=false) builds balanced tree with exact intervals kept', function () {
        const pairs = [
            { interval: newInterval(0, 5), value: 'A' },
            { interval: newInterval(3, 6), value: 'B' }, // overlaps, different value
            { interval: newInterval(10, 12), value: 'C' },
        ];
        const m = IntervalMap.fromArray(pairs, false);

        expect(m.getSize()).to.equal(3);

        // Overlap preserved
        const hits = m.getOverlapping(newInterval(4, 4)).map(e => e.value).sort();
        expect(hits).to.deep.equal(['A', 'B'].sort());

        // Exact intervals exist
        expect(m.get(newInterval(0, 5))).to.equal('A');
        expect(m.get(newInterval(3, 6))).to.equal('B');
    });

    it('fromArray(mergeSame=true) coalesces equal-value touching/overlapping intervals', function () {
        const pairs = [
            { interval: newInterval(0, 2), value: 'X' },
            { interval: newInterval(2, 5), value: 'X' }, // touches -> should merge with previous
            { interval: newInterval(6, 7), value: 'Y' },
            { interval: newInterval(6, 9), value: 'Y' }, // overlaps -> merge
            { interval: newInterval(4, 6), value: 'Z' }, // different value, between X/Y
        ];
        const m = IntervalMap.fromArray(pairs, true);

        // Expected merged: X -> [0,5], Y -> [6,9], Z stays [4,6]
        const arr = m.toArray();
        const printable = arr.map(e => ({ a: e.interval.a ?? e.interval['a'], b: e.interval.b ?? e.interval['b'], v: e.value }));

        // Order by (a,b)
        expect(printable).to.deep.equal([
            { a: 0, b: 5, v: 'X' },
            { a: 4, b: 6, v: 'Z' },
            { a: 6, b: 9, v: 'Y' },
        ]);

        // Overlap queries
        expect(m.getOverlapping(newInterval(2, 2)).map(e => e.value).sort()).to.deep.equal(['X'].sort());
        expect(m.getOverlapping(newInterval(6, 6)).map(e => e.value).sort()).to.deep.equal(['Y', 'Z'].sort());
    });

    it('boundary behavior: exact endpoints included (closed intervals) for getAt(getAll=true)', function () {
        const m = new IntervalMap();
        m.set(newInterval(0, 3), 'A');
        m.set(newInterval(3, 6), 'B');

        // At 3, both contain it (closed intervals)
        const all = m.getAt(3, true).map(e => e.value).sort();
        expect(all).to.deep.equal(['A', 'B'].sort());

        // Single (fast path) may return either; assert it returns one of them or null if tree empty
        const one = m.getAt(3);
        expect(one).to.be.oneOf(['A', 'B']);
    });

});
