/*
 * Script stats (P4-04): pages, screen time, scenes, words, and who speaks how much. Pure: no DOM, no window.
 *
 *   Stats.of(text, { paper })  -> { pages, minutes, scenes, words, dialogueWords,
 *                                   characters: [{ name, speeches, words, share }],
 *                                   sceneList: [{ text, number?, line, page, eighths, characters: [name] }] }
 *   Stats.duration(minutes)    -> "about 1 h 52 min"
 *   Stats.eighths(n)           -> "1 3/8"  (a length in eighths of a page, the way schedules write it)
 *
 * Pages are the printed pages (src/paginate.js, so they always agree with what prints; the title page is not
 * counted). A page is about a minute of screen time; the last page counts for how full it is. Words are counted the
 * way the Library counts them, so the two numbers always agree. A character's words are their spoken words only
 * (no parentheticals, no notes), and every cue for the same name counts as the same character, whatever its extension.
 * A scene's length runs from its heading to the next heading (or the end of the script) on the printed pages, in
 * eighths of a page, rounded, and never less than 1/8: the production convention (D-028). Its characters are the ones
 * who speak in it, in the order they first do.
 * Loads as window.Stats (after fountain.js and paginate.js) and via require() in Node.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'), require('./paginate.js'));
    else root.Stats = factory(root.Fountain, root.Paginate);
})(typeof self !== 'undefined' ? self : this, function (Fountain, Paginate) {
    'use strict';

    const plain = (text) => Fountain.runs(text).map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
    const countWords = (text) => (String(text || '').match(/\S+/g) || []).length;

    // "JOHN (V.O.) (CONT'D)" -> "JOHN": extensions say how a line is heard, not who says it
    const baseName = (cue) => String(cue).replace(/\s*\([^)]*\)/g, '').replace(/\s*\^\s*$/, '').trim();

    function of(text, options) {
        const tokens = Fountain.parse(String(text || ''));
        const layout = Paginate.layout(tokens, options);
        const pages = layout.pages.length;
        const L = layout.linesPerPage;
        let minutes = 0, end = 0; // end: the row just past the last printed line, counting every page's rows
        if (pages) {
            const last = layout.pages[pages - 1].lines;
            const used = last.reduce((m, l) => Math.max(m, l.row + 1), 0);
            minutes = Math.max(1, Math.round(pages - 1 + used / L));
            end = (pages - 1) * L + used;
        }
        const startOf = {}; // a scene heading's source line -> its first printed row, counted the same way
        layout.pages.forEach((p, i) => p.lines.forEach((l) => {
            if (l.source !== undefined && startOf[l.source] === undefined) startOf[l.source] = i * L + l.row;
        }));

        const byKey = {};
        const order = [];
        let dialogueWords = 0;
        const sceneList = [];
        let scene = null, inScene = null;
        tokens.forEach((t) => {
            if (t.type === 'scene') {
                scene = { text: plain(t.text).toUpperCase(), line: t.line, start: startOf[t.line], characters: [] };
                if (t.number) scene.number = t.number;
                sceneList.push(scene);
                inScene = {};
                return;
            }
            if (t.type !== 'dialogue') return;
            const name = baseName(t.character);
            const key = name.toUpperCase();
            if (!byKey[key]) { byKey[key] = { name: name, speeches: 0, words: 0 }; order.push(key); }
            const c = byKey[key];
            if (scene && !inScene[key]) { inScene[key] = true; scene.characters.push(key); }
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

        sceneList.forEach((sc, i) => {
            const next = i + 1 < sceneList.length ? sceneList[i + 1].start : end;
            sc.page = Math.floor(sc.start / L) + 1;
            sc.eighths = Math.max(1, Math.round((next - sc.start) / L * 8));
            sc.characters = sc.characters.map((k) => byKey[k].name); // the first spelling seen, as in the table
            delete sc.start;
        });

        return {
            pages: pages,
            minutes: minutes,
            scenes: tokens.filter((t) => t.type === 'scene').length,
            words: countWords(text),
            dialogueWords: dialogueWords,
            characters: characters,
            sceneList: sceneList
        };
    }

    function duration(minutes) {
        if (!minutes) return 'no screen time yet';
        const h = Math.floor(minutes / 60), m = minutes % 60;
        return 'about ' + (h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min');
    }

    function eighths(n) {
        const whole = Math.floor(n / 8), rest = n % 8;
        return whole && rest ? whole + ' ' + rest + '/8' : whole ? String(whole) : rest + '/8';
    }

    return { of: of, duration: duration, eighths: eighths };
});
