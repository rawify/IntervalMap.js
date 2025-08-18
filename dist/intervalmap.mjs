'use strict';
import Interval from '@rawify/interval';



/**
 * @constructor
 *
 * @param {Interval} i
 * @param {*} v
 */
function IntervalMapNode(i, v) {
    this['i'] = i;          // Interval
    this['v'] = v;          // Value
    this['m'] = i['b'];     // Max endpoint in subtree
    this['h'] = 1;          // Height
    this['l'] = null;       // Left
    this['r'] = null;       // Right
}

function height(n) {
    return n ? n['h'] : 0;
}

function update(n) {
    // update height + max
    const hl = height(n['l']), hr = height(n['r']);
    n['h'] = (hl > hr ? hl : hr) + 1;
    let m = n['i']['b'];
    if (n['l'] && n['l']['m'] > m)
        m = n['l']['m'];
    if (n['r'] && n['r']['m'] > m)
        m = n['r']['m'];
    n['m'] = m;
    return n;
}

function bf(n) {
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

function rebalance(n) {
    const b = bf(n);
    if (b > 1) { // Left heavy
        if (bf(n['l']) < 0)
            n['l'] = rotL(n['l']);
        return rotR(n);
    }
    if (b < -1) { // Right heavy
        if (bf(n['r']) > 0)
            n['r'] = rotR(n['r']);
        return rotL(n);
    }
    return n;
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
     * @param {Interval} it
     * @param {*} val
     * @return {IntervalMap}
     */
    'set': function (it, val) {

        if (!(it instanceof Interval))
            throw new Error('IntervalMap.set expects Interval');

        const self = this;
        function ins(n) {
            if (!n) {
                self['size']++;
                return new IntervalMapNode(it, val);
            }
            const c = it['compareTo'](n['i']);
            if (c < 0) {
                n['l'] = ins(n['l']);
            } else if (c > 0) {
                n['r'] = ins(n['r']);
            } else {
                n['v'] = val;
                return n;
            }
            return rebalance(update(n));
        }
        this['root'] = ins(this['root']);
        return this;
    },

    /**
     * Exact lookup by interval equality.
     * @param {Interval} it
     * @return {*|null}
     */
    'get': function (it) {

        if (!(it instanceof Interval))
            throw new Error('IntervalMap.get expects Interval');

        let n = this['root'];
        const a = it['a'], b = it['b'];
        while (n) {
            const ni = n['i'];
            if (a < ni['a']) {
                n = n['l'];
            } else if (a > ni['a']) {
                n = n['r'];
            } else {
                if (b === ni['b'])
                    return n['v'];
                n = (b < ni['b']) ? n['l'] : n['r'];
            }
        }
        return null;
    },

    /**
     * Remove an interval (exact match). Returns true if removed.
     * @param {Interval} it
     * @return {boolean}
     */
    'delete': function (it) {

        if (!(it instanceof Interval))
            throw new Error('IntervalMap.delete expects Interval');

        let removed = false;

        function minNode(n) {
            while (n['l'])
                n = n['l'];
            return n;
        }

        function del(n) {
            if (!n)
                return null;
            const c = it['compareTo'](n['i']);

            if (c < 0) {
                n['l'] = del(n['l']);
            } else if (c > 0) {
                n['r'] = del(n['r']);
            } else {
                removed = true;
                // node with 0 or 1 child
                if (!n['l'] || !n['r']) {
                    const tmp = n['l'] ? n['l'] : n['r'];
                    n = tmp ? tmp : null;
                } else {
                    // two children: inorder successor
                    const s = minNode(n['r']);
                    n['i'] = s['i']; n['v'] = s['v'];
                    n['r'] = (function delMin(n2, key) {
                        if (!n2) return null;
                        if (n2 === s) return n2['r'];
                        n2['l'] = delMin(n2['l'], key);
                        return rebalance(update(n2));
                    })(n['r'], s);
                }
            }
            return n ? rebalance(update(n)) : null;
        }

        this['root'] = del(this['root']);
        if (removed)
            this['size']--;
        return removed;
    },

    /**
     * Checks if any stored interval overlaps the query interval.
     * @param {Interval} q
     * @return {boolean}
     */
    'hasOverlap': function (q) {

        if (!(q instanceof Interval))
            throw new Error('IntervalMap.hasOverlap expects Interval');

        let n = this['root'];
        const qa = q['a'], qb = q['b'];
        while (n) {
            const ni = n['i'];
            if (ni['a'] <= qb && qa <= ni['b']) return true; // hit
            // prune left if its max < qa
            if (n['l'] && n['l']['m'] >= qa) {
                n = n['l'];
                continue;
            }
            n = n['r'];
        }
        return false;
    },

    /**
     * Collect all entries overlapping the query interval.
     * @param {Interval} q
     * @return {!Array<{interval:Interval,value:*}>}
     */
    'getOverlapping': function (q) {

        if (!(q instanceof Interval))
            throw new Error('IntervalMap.getOverlapping expects Interval');

        const out = [], qa = q['a'], qb = q['b'];
        function dfs(n) {

            if (!n)
                return;

            if (n['l'] && n['l']['m'] >= qa)
                dfs(n['l']);

            const ni = n['i'];
            if (ni['a'] <= qb && qa <= ni['b'])
                out.push({ interval: ni, value: n['v'] });

            if (n['r'] && n['i']['a'] <= qb)
                dfs(n['r']);
        }
        dfs(this['root']);
        return out;
    },

    /**
     * Collect all entries whose interval contains a point x.
     * @param {number} x
     * @return {!Array<{interval:Interval,value:*}>|null}
     */
    'getAt': function (x, getAll = false) {

        if (getAll) {
            const out = [];
            function dfs(n) {

                if (!n)
                    return;

                if (n['l'] && n['l']['m'] >= x)
                    dfs(n['l']);

                const ni = n['i'];
                if (ni['a'] <= x && x <= ni['b'])
                    out.push({ interval: ni, value: n['v'] });

                if (n['r'] && ni['a'] <= x)
                    dfs(n['r']);
            }
            dfs(this['root']);
            return out;
        }

        let n = this['root'];
        while (n) {
            const ia = n['i']['a'], ib = n['i']['b'];
            if (x < ia) {
                n = n['l'];
            } else if (x > ib) {
                n = n['r'];
            } else {
                return n['v']; // ia <= x <= ib
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
        let st = [], n = this['root'];
        while (st.length || n) {
            while (n) {
                st.push(n);
                n = n['l'];
            }
            n = st.pop();
            fn(n['i'], n['v']);
            n = n['r'];
        }
        return this;
    },

    /**
     * @return {!Array<{interval:Interval,value:*}>}
     */
    'toArray': function () {
        const res = [];
        this['forEach'](function (i, v) {
            res.push({ interval: i, value: v });
        });
        return res;
    },

    /** @return {string} */
    'toString': function () {
        const s = [];
        this['forEach'](function (i, v) {
            s.push('[' + i['a'] + ', ' + i['b'] + '] -> ' + v);
        });
        return s.join(', ');
    },

    /**
     * Deep clone (nodes + intervals, value references copied).
     * @return {IntervalMap}
     */
    'clone': function () {
        const out = new IntervalMap();
        function cpy(n) {
            if (!n) return null;
            const nn = new IntervalMapNode(new Interval(n['i']['a'], n['i']['b']), n['v']);
            nn['l'] = cpy(n['l']); nn['r'] = cpy(n['r']);
            nn['h'] = n['h']; nn['m'] = n['m'];
            return nn;
        }
        out['root'] = cpy(this['root']);
        out['size'] = this['size'];
        return out;
    }
};

IntervalMap['fromArray'] = function (pairs, mergeSame) {

    const map = new IntervalMap();

    if (!pairs || pairs.length === 0)
        return map;

    // 1) sort by (a,b) and stable by value if mergeSame
    let arr = pairs.slice();
    arr.sort(function (x, y) {
        const ix = x['interval'], iy = y['interval'];
        if (ix['a'] !== iy['a']) return ix['a'] - iy['a'];
        if (ix['b'] !== iy['b']) return ix['b'] - iy['b'];
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
        if (lo > hi) return null;
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
