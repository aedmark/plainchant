/*
 * Script stats (P4-04): pages, screen time, scenes, words, and who speaks how much. Pure: no DOM, no window.
 *
 *   Stats.of(text, { paper })  -> { pages, minutes, scenes, words, dialogueWords,
 *                                   characters: [{ name, speeches, words, share }],
 *                                   sceneList: [{ text, number?, line, page, eighths, characters: [name],
 *                                                 setting, location, time }],
 *                                   settings: { int, ext, both, other }, times: [{ name, scenes }], untimed,
 *                                   locations: [{ name, scenes, eighths }] }
 *   Stats.duration(minutes)    -> "about 1 h 52 min"
 *   Stats.eighths(n)           -> "1 3/8"  (a length in eighths of a page, the way schedules write it)
 *   Stats.heading(text)        -> { setting: 'int' | 'ext' | 'both' | 'other', location, time }  (time: null if none)
 *
 * Pages are the printed pages (src/paginate.js, so they always agree with what prints; the title page is not
 * counted). A page is about a minute of screen time; the last page counts for how full it is. Words are counted the
 * way the Library counts them, so the two numbers always agree. A character's words are their spoken words only
 * (no parentheticals, no notes), and every cue for the same name counts as the same character, whatever its extension.
 * A scene's length runs from its heading to the next heading (or the end of the script) on the printed pages, in
 * eighths of a page, rounded, and never less than 1/8: the production convention (D-028). Its characters are the ones
 * who speak in it, in the order they first do.
 * A heading reads as setting, location and time of day (D-029): INT. / EXT. / INT./EXT. or I/E (EST. is exterior;
 * a forced heading such as .MONTAGE is "other"), then the location, then the last " - " part that names a time of day
 * (DAY, NIGHT, DUSK, LATER, CONTINUOUS, ...); anything after the time is dropped, and a part that is not a time stays
 * in the location ("HOUSE - KITCHEN"). A heading that is only a time (.LATER) has no location. A forced heading only
 * counts as a location if it gives a time of day.
 * Loads as window.Stats (after fountain.js and paginate.js) and via require() in Node.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'), require('./paginate.js'));
    else root.Stats = factory(root.Fountain, root.Paginate);
})(typeof self !== 'undefined' ? self : this, function (Fountain, Paginate) {
    'use strict';

    const plain = (text) => Fountain.runs(text).map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
    const TIME_OF_DAY = new RegExp('^(?:(?:(?:EARLY|LATE)\\s+)?(?:DAY|NIGHT|MORNING|AFTERNOON|EVENING|DAWN|DUSK|SUNRISE|SUNSET|' +
        'NOON|MIDDAY|MIDNIGHT|TWILIGHT|DAYBREAK|NIGHTFALL|MAGIC HOUR|GOLDEN HOUR)|DAYTIME|NIGHTTIME|' +
        '(?:(?:MOMENTS|SECONDS|MINUTES|HOURS|DAYS|WEEKS|YEARS|A (?:FEW )?MOMENTS?|A LITTLE|MUCH|SOON)\\s+)?LATER|' +
        'CONTINUOUS|SAME(?: TIME)?|SIMULTANEOUS)$');
    const SETTING = /^(INT\.?\/EXT|EXT\.?\/INT|I\/E|INT|EXT|EST)(?:\.|\s)\s*/; // as the parser reads a heading

    function heading(text) {
        const up = plain(text).toUpperCase();
        const m = up.match(SETTING);
        const setting = !m ? 'other' : m[1].indexOf('/') !== -1 ? 'both' : m[1] === 'INT' ? 'int' : 'ext';
        const parts = (m ? up.slice(m[0].length) : up).split(/(?:^|\s+)(?:-+|–|—)\s+/);
        let at = -1;
        parts.forEach((part, i) => { if (TIME_OF_DAY.test(part.replace(/\s*\([^)]*\)/g, '').trim())) at = i; });
        return {
            setting: setting,
            location: (at === -1 ? parts : parts.slice(0, at)).join(' - ').replace(/^[\s.\-–—]+|[\s\-–—]+$/g, ''),
            time: at === -1 ? null : parts[at].replace(/\s*\([^)]*\)/g, '').trim()
        };
    }

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
                scene = Object.assign({ text: plain(t.text).toUpperCase(), line: t.line, start: startOf[t.line], characters: [] }, heading(t.text));
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

        // The scene mix (P4-14) and the locations (P4-15)
        const settings = { int: 0, ext: 0, both: 0, other: 0 };
        const timeBy = {}, placeBy = {};
        let untimed = 0;
        sceneList.forEach((sc) => {
            settings[sc.setting]++;
            if (sc.time) timeBy[sc.time] = (timeBy[sc.time] || 0) + 1; else untimed++;
            if (!sc.location || (sc.setting === 'other' && !sc.time)) return; // .MONTAGE, BACK TO SCENE: not places
            const place = placeBy[sc.location] || (placeBy[sc.location] = { name: sc.location, scenes: 0, eighths: 0 });
            place.scenes++;
            place.eighths += sc.eighths;
        });
        const times = Object.keys(timeBy).map((k) => ({ name: k, scenes: timeBy[k] }))
            .sort((a, b) => b.scenes - a.scenes || a.name.localeCompare(b.name));
        const locations = Object.keys(placeBy).map((k) => placeBy[k])
            .sort((a, b) => b.eighths - a.eighths || b.scenes - a.scenes || a.name.localeCompare(b.name));

        return {
            pages: pages,
            minutes: minutes,
            scenes: tokens.filter((t) => t.type === 'scene').length,
            words: countWords(text),
            dialogueWords: dialogueWords,
            characters: characters,
            sceneList: sceneList,
            settings: settings,
            times: times,
            untimed: untimed,
            locations: locations
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

    return { of: of, duration: duration, eighths: eighths, heading: heading };
});
