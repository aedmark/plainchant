/*
 * Script stats (P4-04): pages, screen time, scenes, words, and who speaks how much. Pure: no DOM, no window.
 *
 *   Stats.of(text, { paper })  -> { pages, minutes, scenes, words, dialogueWords,
 *                                   characters: [{ name, speeches, words, share }] }
 *   Stats.duration(minutes)    -> "about 1 h 52 min"
 *
 * Pages are the printed pages (src/paginate.js, so they always agree with what prints; the title page is not
 * counted). A page is about a minute of screen time; the last page counts for how full it is. Words are counted the
 * way the Library counts them, so the two numbers always agree. A character's words are their spoken words only
 * (no parentheticals, no notes), and every cue for the same name counts as the same character, whatever its extension.
 * Loads as window.Stats (after fountain.js and paginate.js) and via require() in Node.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'), require('./paginate.js'));
    else root.Stats = factory(root.Fountain, root.Paginate);
})(typeof self !== 'undefined' ? self : this, function (Fountain, Paginate) {
    'use strict';

    const countWords = (text) => (String(text || '').match(/\S+/g) || []).length;

    // "JOHN (V.O.) (CONT'D)" -> "JOHN": extensions say how a line is heard, not who says it
    const baseName = (cue) => String(cue).replace(/\s*\([^)]*\)/g, '').replace(/\s*\^\s*$/, '').trim();

    function of(text, options) {
        const tokens = Fountain.parse(String(text || ''));
        const layout = Paginate.layout(tokens, options);
        const pages = layout.pages.length;
        let minutes = 0;
        if (pages) {
            const last = layout.pages[pages - 1].lines;
            const used = last.reduce((m, l) => Math.max(m, l.row + 1), 0);
            minutes = Math.max(1, Math.round(pages - 1 + used / layout.linesPerPage));
        }

        const byKey = {};
        const order = [];
        let dialogueWords = 0;
        tokens.forEach((t) => {
            if (t.type !== 'dialogue') return;
            const name = baseName(t.character);
            const key = name.toUpperCase();
            if (!byKey[key]) { byKey[key] = { name: name, speeches: 0, words: 0 }; order.push(key); }
            const c = byKey[key];
            c.speeches++;
            t.lines.forEach((l) => {
                if (l.type !== 'dialogue') return;
                const n = countWords(Fountain.runs(l.text).map((r) => r.text).join(''));
                c.words += n;
                dialogueWords += n;
            });
        });
        const characters = order.map((k) => byKey[k])
            .sort((a, b) => b.words - a.words || b.speeches - a.speeches || a.name.localeCompare(b.name))
            .map((c) => Object.assign(c, { share: dialogueWords ? Math.round(c.words / dialogueWords * 100) : 0 }));

        return {
            pages: pages,
            minutes: minutes,
            scenes: tokens.filter((t) => t.type === 'scene').length,
            words: countWords(text),
            dialogueWords: dialogueWords,
            characters: characters
        };
    }

    function duration(minutes) {
        if (!minutes) return 'no screen time yet';
        const h = Math.floor(minutes / 60), m = minutes % 60;
        return 'about ' + (h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min');
    }

    return { of: of, duration: duration };
});
