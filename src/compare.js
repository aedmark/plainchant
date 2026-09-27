/*
 * Comparing two texts of a script scene by scene (P4-16): what changed between a kept version and the text now, and
 * taking one scene back from the version. Pure: no DOM, no window.
 *
 *   Compare.parts(text)        -> [{ key, heading, start, end, text }]: the opening (the title page and anything before
 *                                 the first scene; key '', heading null), then one part per scene, heading to heading.
 *                                 Joined, the parts' texts are the text exactly; start / end are offsets in it.
 *   Compare.of(was, now)       -> [{ status: 'same' | 'changed' | 'removed' | 'added', heading, was, now, lines }]
 *                                 in reading order: `was` / `now` are the parts (null where the scene is missing),
 *                                 `lines` what changed in a changed part ([{ op: ' ' | '-' | '+', text }])
 *   Compare.lines(a, b)        -> [{ op, text }]: a line-by-line difference
 *   Compare.around(lines, n)   -> the same, with the unchanged lines more than n away from a change folded into
 *                                 { op: '…', count }
 *   Compare.take(now, items, i) -> the text now with item i as the version had it: a changed scene replaced, a removed
 *                                 one put back before the next scene that is still there
 *
 * Scenes are matched by heading (case and spaces aside, scene numbers ignored), in order, so a heading used several
 * times pairs up where it should; between two matched scenes, those left over pair up in order as changed (a heading
 * that was edited), and the rest were removed or added. Parts that differ only in trailing blank lines are the same.
 * Loads as window.Compare (after fountain.js) and via require() in Node.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'));
    else root.Compare = factory(root.Fountain);
})(typeof self !== 'undefined' ? self : this, function (Fountain) {
    'use strict';

    const MAX_CELLS = 250000; // a line difference bigger than this (500 lines by 500) compares ends only
    const bare = (text) => text.replace(/\s+$/, '');

    function parts(text) {
        const src = String(text || '').replace(/\r\n?/g, '\n');
        const lines = src.split('\n');
        const offsets = [0];
        lines.forEach((l, i) => offsets.push(offsets[i] + l.length + 1));
        const at = (line) => Math.min(offsets[line], src.length);
        const scenes = Fountain.parse(src).filter((t) => t.type === 'scene');
        const out = [];
        const starts = [0].concat(scenes.map((t) => t.line));
        starts.forEach((line, i) => {
            const start = at(line), end = i + 1 < starts.length ? at(starts[i + 1]) : src.length;
            const t = i ? scenes[i - 1] : null;
            const heading = t ? t.text.replace(/\s+/g, ' ').trim().toUpperCase() : null;
            out.push({ key: heading || '', heading: heading, start: start, end: end, text: src.slice(start, end) });
        });
        return out;
    }

    // Longest common subsequence of two lists, as pairs of indexes
    function common(a, b, same) {
        const n = a.length, m = b.length;
        const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
        for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
                table[i][j] = same(a[i], b[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
            }
        }
        const pairs = [];
        let i = 0, j = 0;
        while (i < n && j < m) {
            if (same(a[i], b[j])) { pairs.push([i, j]); i++; j++; }
            else if (table[i + 1][j] >= table[i][j + 1]) i++;
            else j++;
        }
        return pairs;
    }

    function lines(a, b) {
        const x = bare(a).split('\n'), y = bare(b).split('\n');
        if (x.length * y.length > MAX_CELLS) { // too long to compare line by line: keep the ends that match
            let head = 0;
            while (head < x.length && head < y.length && x[head] === y[head]) head++;
            let tail = 0;
            while (tail < x.length - head && tail < y.length - head && x[x.length - 1 - tail] === y[y.length - 1 - tail]) tail++;
            return x.slice(0, head).map((t) => ({ op: ' ', text: t }))
                .concat(x.slice(head, x.length - tail).map((t) => ({ op: '-', text: t })))
                .concat(y.slice(head, y.length - tail).map((t) => ({ op: '+', text: t })))
                .concat(x.slice(x.length - tail).map((t) => ({ op: ' ', text: t })));
        }
        const out = [];
        let i = 0, j = 0;
        common(x, y, (p, q) => p === q).concat([[x.length, y.length]]).forEach(([pi, pj]) => {
            while (i < pi) out.push({ op: '-', text: x[i++] });
            while (j < pj) out.push({ op: '+', text: y[j++] });
            if (pi < x.length) { out.push({ op: ' ', text: x[pi] }); i++; j++; }
        });
        return out;
    }

    // Only the lines near a change: runs of unchanged lines longer than `context` either side become one
    // { op: '…', count } (at the start and the end, and between changes far apart)
    function around(list, context) {
        const near = list.map(() => false);
        list.forEach((l, i) => {
            if (l.op === ' ') return;
            for (let k = Math.max(0, i - context); k <= Math.min(list.length - 1, i + context); k++) near[k] = true;
        });
        const out = [];
        list.forEach((l, i) => {
            if (near[i]) { out.push(l); return; }
            const last = out[out.length - 1];
            if (last && last.op === '…') last.count++; else out.push({ op: '…', count: 1 });
        });
        return out;
    }

    function item(was, now) {
        const status = !now ? 'removed' : !was ? 'added' : bare(was.text) === bare(now.text) ? 'same' : 'changed';
        return {
            status: status,
            heading: (now || was).heading,
            was: was,
            now: now,
            lines: status === 'changed' ? lines(was.text, now.text) : null
        };
    }

    function of(wasText, nowText) {
        const a = parts(wasText), b = parts(nowText);
        const out = [item(a[0], b[0])]; // the openings always pair up
        const pairs = common(a.slice(1), b.slice(1), (p, q) => p.key === q.key).map(([i, j]) => [i + 1, j + 1]);
        let i = 1, j = 1;
        pairs.concat([[a.length, b.length]]).forEach(([pi, pj]) => {
            while (i < pi && j < pj) out.push(item(a[i++], b[j++])); // left over in the same place: an edited heading
            while (i < pi) out.push(item(a[i++], null));
            while (j < pj) out.push(item(null, b[j++]));
            if (pi < a.length) out.push(item(a[pi], b[pj]));
            i = pi + 1;
            j = pj + 1;
        });
        return out;
    }

    function take(nowText, items, index) {
        const text = String(nowText || '').replace(/\r\n?/g, '\n');
        const it = items[index];
        if (!it || !it.was) return text; // added since: not in the version (a scene that is the same comes back the same)
        const wanted = bare(it.was.text);
        if (it.now) { // replace the part, keeping the blank lines that follow it now
            const trail = it.now.text.slice(bare(it.now.text).length);
            const after = text.slice(it.now.end);
            const sep = wanted && after && !trail ? '\n\n' : trail;
            return text.slice(0, it.now.start) + wanted + (wanted ? sep : '') + after;
        }
        // Put back: before the next scene that is there now, or at the end
        const next = items.slice(index + 1).find((x) => x.now);
        if (next) return text.slice(0, next.now.start) + wanted + '\n\n' + text.slice(next.now.start);
        const base = bare(text);
        return base + (base ? '\n\n' : '') + wanted + '\n';
    }

    return { parts: parts, of: of, lines: lines, around: around, take: take };
});
