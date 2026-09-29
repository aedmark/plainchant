(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'), require('./paginate.js'));
    else root.Outline = factory(root.Fountain, root.Paginate);
})(typeof self !== 'undefined' ? self : this, function (Fountain, Paginate) {
    'use strict';

    const plain = (text) => Fountain.runs(text).map((r) => r.text).join('').replace(/\s+/g, ' ').trim();

    function of(text, options) {
        const tokens = Fountain.parse(String(text || ''));
        const pageOf = {};
        Paginate.layout(tokens, options).pages.forEach((p, i) => p.lines.forEach((l) => {
            if (l.source !== undefined && pageOf[l.source] === undefined) pageOf[l.source] = i + 1;
        }));

        const items = [];
        let depth = 0;
        tokens.forEach((t) => {
            if (t.type === 'section') {
                depth = t.depth;
                items.push({ kind: 'section', text: plain(t.text), level: t.depth - 1, line: t.line, page: null });
            } else if (t.type === 'scene') {
                const item = { kind: 'scene', text: plain(t.text).toUpperCase(), level: depth, line: t.line, page: pageOf[t.line] || null };
                if (t.number) item.number = t.number;
                items.push(item);
            } else if (t.type === 'synopsis') {
                const last = items[items.length - 1];
                if (last && last.kind !== 'synopsis' && !last.synopsis) last.synopsis = plain(t.text);
                else items.push({ kind: 'synopsis', text: plain(t.text), level: last ? last.level + 1 : 0, line: t.line, page: null });
            }
        });
        return { items: items };
    }

    function current(items, line) {
        let at = -1;
        items.forEach((item, i) => { if (item.kind !== 'synopsis' && item.line <= line) at = i; });
        return at;
    }

    return { of: of, current: current };
});
