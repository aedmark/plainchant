(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Finding = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function matcher(query, caseSensitive) {
        return new RegExp(String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
    }

    function findAll(text, query, options) {
        const found = [];
        if (!query) return found;
        const re = matcher(query, options && options.caseSensitive);
        const source = String(text == null ? '' : text);
        let m;
        while ((m = re.exec(source)) !== null) {
            found.push({ start: m.index, end: m.index + m[0].length });
        }
        return found;
    }

    function nearest(matches, offset) {
        if (!matches.length) return -1;
        const at = matches.findIndex((m) => m.start >= offset);
        return at === -1 ? 0 : at;
    }

    function step(matches, current, direction) {
        const n = matches.length;
        if (!n) return -1;
        if (current < 0 || current >= n) return direction > 0 ? 0 : n - 1;
        return (current + (direction > 0 ? 1 : -1) + n) % n;
    }

    function replaceAt(text, match, replacement) {
        const rep = String(replacement == null ? '' : replacement);
        return {
            text: text.slice(0, match.start) + rep + text.slice(match.end),
            caret: match.start + rep.length
        };
    }

    function replaceAll(text, query, replacement, options) {
        const matches = findAll(text, query, options);
        const rep = String(replacement == null ? '' : replacement);
        let out = '';
        let last = 0;
        matches.forEach((m) => {
            out += text.slice(last, m.start) + rep;
            last = m.end;
        });
        return { text: out + text.slice(last), count: matches.length };
    }

    return {
        findAll: findAll,
        nearest: nearest,
        step: step,
        replaceAt: replaceAt,
        replaceAll: replaceAll
    };
});
