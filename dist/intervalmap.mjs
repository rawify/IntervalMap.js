'use strict';
import Interval from '@rawify/interval';



/**
 * @constructor
 *
 * @param {Interval} interval
 * @param {*} value
 */
function IntervalMapNode(interval, value) {
    this['i'] = interval;
    this['v'] = value;
    this['m'] = interval['b']; // Max endpoint in subtree
    this['h'] = 1;             // Height
    this['l'] = null;          // Left
    this['r'] = null;          // Right
}

function height(node) {
    return node ? node['h'] : 0;
}

function update(node) {
    // update height + max
    const hl = height(node['l']);
    const hr = height(node['r']);
    node['h'] = (hl > hr ? hl : hr) + 1;
    let maxEnd = node['i']['b'];
    if (node['l'] && node['l']['m'] > maxEnd)
        maxEnd = node['l']['m'];
    if (node['r'] && node['r']['m'] > maxEnd)
        maxEnd = node['r']['m'];
    node['m'] = maxEnd;
    return node;
}

function balanceFactor(n) {
    return height(n['l']) - height(n['r']);
}

function rotL(x) {
    const y = x['r'], T2 = y['l'];
    y['l'] = x; x['r'] = T2;
    update(x); return update(y);
}

function rotR(y) {
    const x = y['l'], T2 = x['r'];
    x['r'] = y; y['l'] = T2;
    update(y); return update(x);
}

function rebalance(node) {
    const b = balanceFactor(node);
    if (b > 1) { // Left heavy
        if (balanceFactor(node['l']) < 0)
            node['l'] = rotL(node['l']);
        return rotR(node);
    }
    if (b < -1) { // Right heavy
        if (balanceFactor(node['r']) > 0)
            node['r'] = rotR(node['r']);
        return rotL(node);
    }
    return node;
}



/**
 * @constructor
 */
function IntervalMap() {
    this['root'] = null;
    this['size'] = 0;
}

IntervalMap.prototype = {

    constructor: IntervalMap,

    /**
     * Insert or replace a value for an interval.
     * @param {Interval} interval
     * @param {*} value
     * @return {IntervalMap}
     */
    'set': function (interval, value) {

        if (!(interval instanceof Interval))
            throw new Error('IntervalMap.set expects Interval');

        const self = this;
        function ins(node) {
            if (!node) {
                self['size']++;
                return new IntervalMapNode(interval, value);
            }
            const res = interval['compareTo'](node['i']);
            if (res < 0) {
                node['l'] = ins(node['l']);
            } else if (res > 0) {
                node['r'] = ins(node['r']);
            } else {
                node['v'] = value;
                return node;
            }
            return rebalance(update(node));
        }
        this['root'] = ins(this['root']);
        return this;
    },

    /**
     * Exact lookup by interval equality.
     * @param {Interval} interval
     * @return {*|null}
     */
    'get': function (interval) {

        if (!(interval instanceof Interval))
            throw new Error('IntervalMap.get expects Interval');

        let node = this['root'];
        const a = interval['a'];
        const b = interval['b'];
        while (node) {
            const ni = node['i'];
            if (a < ni['a']) {
                node = node['l'];
            } else if (a > ni['a']) {
                node = node['r'];
            } else {
                if (b === ni['b'])
                    return node['v'];
                node = (b < ni['b']) ? node['l'] : node['r'];
            }
        }
        return null;
    },

    /**
     * Remove an interval (exact match). Returns true if removed.
     * @param {Interval} interval
     * @return {boolean}
     */
    'delete': function (interval) {

        if (!(interval instanceof Interval))
            throw new Error('IntervalMap.delete expects Interval');

        let removed = false;

        function minNode(n) {
            while (n['l'])
                n = n['l'];
            return n;
        }

        function del(node) {
            if (!node)
                return null;
            const res = interval['compareTo'](node['i']);

            if (res < 0) {
                node['l'] = del(node['l']);
            } else if (res > 0) {
                node['r'] = del(node['r']);
            } else {
                removed = true;
                // node with 0 or 1 child
                if (!node['l'] || !node['r']) {
                    const tmp = node['l'] ? node['l'] : node['r'];
                    node = tmp ? tmp : null;
                } else {
                    // two children: inorder successor
                    const s = minNode(node['r']);
                    node['i'] = s['i']; node['v'] = s['v'];
                    node['r'] = (function delMin(n2, key) {
                        if (!n2) return null;
                        if (n2 === s) return n2['r'];
                        n2['l'] = delMin(n2['l'], key);
                        return rebalance(update(n2));
                    })(node['r'], s);
                }
            }
            return node ? rebalance(update(node)) : null;
        }

        this['root'] = del(this['root']);
        if (removed)
            this['size']--;
        return removed;
    },

    /**
     * Checks if any stored interval overlaps the query interval.
     * @param {Interval} interval
     * @return {boolean}
     */
    'hasOverlap': function (interval) {

        if (!(interval instanceof Interval))
            throw new Error('IntervalMap.hasOverlap expects Interval');

        let node = this['root'];
        const qa = interval['a'];
        const qb = interval['b'];
        while (node) {
            const ni = node['i'];
            if (ni['a'] <= qb && qa <= ni['b'])
                return true; // hit
            // prune left if its max < qa
            if (node['l'] && node['l']['m'] >= qa) {
                node = node['l'];
                continue;
            }
            node = node['r'];
        }
        return false;
    },

    /**
     * Collect all entries overlapping the query interval.
     * @param {Interval} interval
     * @return {!Array<{interval:Interval,value:*}>}
     */
    'getOverlapping': function (interval) {

        if (!(interval instanceof Interval))
            throw new Error('IntervalMap.getOverlapping expects Interval');

        const out = [], qa = interval['a'], qb = interval['b'];
        function dfs(node) {

            if (!node)
                return;

            if (node['l'] && node['l']['m'] >= qa)
                dfs(node['l']);

            const ni = node['i'];
            if (ni['a'] <= qb && qa <= ni['b'])
                out.push({ interval: ni, value: node['v'] });

            if (node['r'] && node['i']['a'] <= qb)
                dfs(node['r']);
        }
        dfs(this['root']);
        return out;
    },

    /**
     * Collect all entries whose interval contains a point x.
     * @param {number} value
     * @return {!Array<{interval:Interval,value:*}>|null}
     */
    'getAt': function (value, getAll = false) {

        if (getAll) {
            const ret = [];
            function dfs(node) {

                if (!node)
                    return;

                if (node['l'] && node['l']['m'] >= value)
                    dfs(node['l']);

                const ni = node['i'];
                if (ni['a'] <= value && value <= ni['b'])
                    ret.push({ interval: ni, value: node['v'] });

                if (node['r'] && ni['a'] <= value)
                    dfs(node['r']);
            }
            dfs(this['root']);
            return ret;
        }

        let node = this['root'];
        while (node) {
            const ia = node['i']['a'];
            const ib = node['i']['b'];
            if (value < ia) {
                node = node['l'];
            } else if (value > ib) {
                node = node['r'];
            } else {
                return node['v']; // ia <= x <= ib
            }
        }
        return null;
    },

    /** @return {number} */
    'getSize': function () {
        return this['size'];
    },

    /** @return {boolean} */
    'isEmpty': function () {
        return this['size'] === 0;
    },

    /** Clears all entries. */
    'clear': function () {
        this['root'] = null;
        this['size'] = 0;
        return this;
    },

    /**
     * In-order iteration: callback(interval, value) -> void
     * @param {function(Interval, *):void} fn
     * @return {IntervalMap}
     */
    'forEach': function (fn) {
        let stack = [], node = this['root'];
        while (stack.length || node) {
            while (node) {
                stack.push(node);
                node = node['l'];
            }
            node = stack.pop();
            fn(node['i'], node['v']);
            node = node['r'];
        }
        return this;
    },

    /**
     * @return {!Array<{interval:Interval,value:*}>}
     */
    'toArray': function () {
        const res = [];
        this['forEach'](function (i, v) {
            res.push({ 'interval': i, 'value': v });
        });
        return res;
    },

    /** @return {string} */
    'toString': function () {
        const str = [];
        this['forEach'](function (i, v) {
            str.push('[' + i['a'] + ', ' + i['b'] + '] -> ' + v);
        });
        return str.join(', ');
    },

    /**
     * Deep clone (nodes + intervals, value references copied).
     * @return {IntervalMap}
     */
    'clone': function () {
        const ret = new IntervalMap();
        function copy(node) {
            if (!node)
                return null;
            const nn = new IntervalMapNode(new Interval(node['i']['a'], node['i']['b']), node['v']);
            nn['l'] = copy(node['l']); nn['r'] = copy(node['r']);
            nn['h'] = node['h']; nn['m'] = node['m'];
            return nn;
        }
        ret['root'] = copy(this['root']);
        ret['size'] = this['size'];
        return ret;
    }
};

IntervalMap['fromArray'] = function (pairs, mergeSame) {

    const map = new IntervalMap();

    if (!pairs || pairs.length === 0)
        return map;

    // 1) sort by (a,b) and stable by value if mergeSame
    let arr = pairs.slice();
    arr.sort(function (x, y) {
        const ix = x['interval'];
        const iy = y['interval'];
        if (ix['a'] !== iy['a'])
            return ix['a'] - iy['a'];
        if (ix['b'] !== iy['b'])
            return ix['b'] - iy['b'];
        return mergeSame ? (x['value'] < y['value'] ? -1 : x['value'] > y['value'] ? 1 : 0) : 0;
    });

    // 2) optional coalescing by value
    if (mergeSame) {
        const merged = [];
        for (let i = 0; i < arr.length; i++) {
            const iv = arr[i]['interval'], val = arr[i]['value'];
            if (merged.length === 0) {
                merged.push({ interval: iv['clone'](), value: val });
                continue;
            }
            const last = merged[merged.length - 1];
            const li = last['interval'];
            if (last['value'] === val && iv['a'] <= li['b']) {
                if (iv['b'] > li['b'])
                    li['b'] = iv['b']; // extend
            } else {
                merged.push({ interval: iv['clone'](), value: val });
            }
        }
        arr = merged;
    }

    // 3) build perfectly balanced AVL (bottom-up)
    function build(lo, hi) {
        if (lo > hi) 
            return null;
        const mid = (lo + hi) >> 1;
        const pair = arr[mid];
        const node = new IntervalMapNode(pair['interval'], pair['value']);
        node['l'] = build(lo, mid - 1);
        node['r'] = build(mid + 1, hi);

        const lh = node['l'] ? node['l']['h'] : 0;
        const rh = node['r'] ? node['r']['h'] : 0;
        node['h'] = (lh > rh ? lh : rh) + 1;

        let m = node['i']['b'];
        if (node['l'] && node['l']['m'] > m) m = node['l']['m'];
        if (node['r'] && node['r']['m'] > m) m = node['r']['m'];
        node['m'] = m;
        return node;
    }

    map['root'] = build(0, arr.length - 1);
    map['size'] = arr.length;
    return map;
};
export {
  IntervalMap as default, IntervalMap
};
