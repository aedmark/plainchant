/*
 * The outline (P4-03): sections, scenes and synopses, in order, for the Outline window. Pure: no DOM, no window.
 *
 *   Outline.of(text, { paper })   -> { items: [{ kind: 'section' | 'scene' | 'synopsis', text, level, line,
 *                                                number?, page, synopsis? }] }
 *   Outline.current(items, line)  -> index of the last item at or above that source line, or -1
 *
 * Sections nest by their # depth (level 0 for #, 1 for ##); a scene sits one level under the section above it. A
 * synopsis (= ...) belongs to the item above it and becomes its `synopsis`; one above everything stands alone. Scene
 * headings read as they print (capitals, no #12# marks, notes and emphasis marks gone). `page` is the printed page a
 * scene starts on (src/paginate.js, on the chosen paper); sections and synopses do not print, so theirs is null.
 * Loads as window.Outline (after fountain.js and paginate.js) and via require() in Node.
 */
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
        let depth = 0; // of the section we are in
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
