# IntervalMap.js

[![NPM Package](https://img.shields.io/npm/v/intervalmap.svg?style=flat)](https://www.npmjs.com/package/intervalmap "View this project on npm")
[![MIT license](http://img.shields.io/badge/license-MIT-brightgreen.svg)](http://opensource.org/licenses/MIT)

**IntervalMap.js** is a fast map-like data structure where the **key is a numeric interval** and the **value is arbitrary data**.  
Internally it uses an **AVL-balanced interval tree** for efficient insertions and queries.  
It builds on top of **[Interval.js](https://www.npmjs.com/package/@rawify/interval)**.

> Interval semantics are **closed**: an interval `[a, b]` contains both endpoints `a` and `b`.

## Features

- **Map semantics**: `set(interval, value)`, `get(interval)`, `delete(interval)`
- **Interval queries**:
  - `hasOverlap(queryInterval)` - fast overlap check
  - `getOverlapping(queryInterval)` - collect all overlapping entries (sorted by start, then end)
  - `getAt(x, getAll = false)` - point query (single fast match, or all matches)
- **Efficient core**: AVL tree with subtree `max` endpoint for tight pruning
- **Batch build**: `IntervalMap.fromArray(pairs, mergeSame)` builds a perfectly balanced tree
- **Utilities**: `forEach`, `toArray`, `clear`, `clone`, `getSize`, `isEmpty`, `toString`

## Installation

```bash
npm install intervalmap
# or
yarn add intervalmap
````

## Usage

Browser (minified bundle):

```html
<script src="path/to/interval.min.js"></script>
<script src="path/to/intervalmap.min.js"></script>
<script>
  const map = new IntervalMap();
  map.set(new Interval(0, 10), 'A');
  console.log(map.getAt(5)); // 'A'
</script>
```

Node / bundlers (ESM):

```js
import Interval from '@rawify/interval';
import IntervalMap from 'intervalmap';

const map = new IntervalMap();
map.set(new Interval(0, 10), 'A');
map.set(new Interval(20, 30), 'B');

console.log(map.hasOverlap(new Interval(8, 22))); // true
console.log(map.getAt(25)); // 'B'  (single fast match)
console.log(map.getAt(10, true)); // [{ interval:[0,10], value:'A' }] (all matches)
```

CommonJS:

```js
const Interval = require('@rawify/interval');
const IntervalMap = require('intervalmap');
```

## API

### `new IntervalMap()`

Create an empty map.

### `set(interval: Interval, value: any): this`

Insert or **replace** the value for an *exact* interval key.
If the same `[a,b]` key is inserted again, the previous value is overwritten.

### `get(interval: Interval): any | null`

Return the value for the *exact* interval key, or `null` if not found.

### `delete(interval: Interval): boolean`

Remove the *exact* interval key. Returns `true` if a node was removed.

### `hasOverlap(q: Interval): boolean`

`true` if any stored interval overlaps `q`. Uses subtree `max` to prune.

### `getOverlapping(q: Interval): Array<{ interval: Interval, value: any }>`

Collect **all** overlaps with `q`. Results are in-order (sorted by `(start,end)`).

### `getAt(x: number, getAll = false): any | Array<{ interval, value }>`

Point query:

* `getAll === false` (default): returns **one** matching value using a fast BST walk.
  If multiple intervals contain `x`, the chosen result is **not guaranteed to be deterministic**.
  This is more optimized for speed on non-overlapping intervals.
* `getAll === true`: returns **all** intervals that contain `x` (sorted).

### `forEach(fn: (interval, value) => void): this`

In-order traversal.

### `toArray(): Array<{ interval: Interval, value: any }>`

In-order snapshot of the map.

### `clear(): this` · `getSize(): number` · `isEmpty(): boolean` · `toString(): string` · `clone(): IntervalMap`

Maintenance and utilities.

### `static fromArray(pairs, mergeSame = false): IntervalMap`

Build a **perfectly balanced** map from an array of
`{ interval: Interval, value: any }`.

* When `mergeSame` is **true**, touching/overlapping intervals with the **same value** are **coalesced** first (value-aware merge).
* When `false`, all provided intervals are kept as-is.

```js
const pairs = [
  { interval: new Interval(0, 2), value: 'X' },
  { interval: new Interval(2, 5), value: 'X' }, // touches -> coalesce when mergeSame=true
  { interval: new Interval(4, 6), value: 'Y' }
];

const map1 = IntervalMap.fromArray(pairs, false); // keeps both X intervals
const map2 = IntervalMap.fromArray(pairs, true);  // merges X -> [0,5]
```

## Performance Notes

* **Insert / Delete / Exact Get**: `O(log n)` (AVL-balanced)
* **Overlap / Point queries**: typically `O(log n + k)` where `k` is the number of results
* Pre-coalescing (`mergeSame=true`) reduces node count and improves cache locality
* `fromArray()` avoids `n log n` rebalancing by building the tree bottom-up

## Coding Style

As every library I publish, IntervalMap is also built to be as small as possible after compressing it with Google Closure Compiler in advanced mode. Thus the coding style orientates a little on maxing-out the compression rate. Please make sure you keep this style if you plan to extend the library.

## Building the library

After cloning the Git repository run:

```bash
npm install
npm run build
```

## Run tests

```bash
npm run test
```

## Copyright and Licensing

Copyright (c) 2025, [Robert Eisele](https://raw.org/)
Licensed under the MIT license.
