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
    const SETTING = /^(INT\.?\/EXT|EXT\.?\/INT|I\/E|INT|EXT|EST)(?:\.|\s)\s*/;

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

    const baseName = (cue) => String(cue).replace(/\s*\([^)]*\)/g, '').replace(/\s*\^\s*$/, '').trim();

    function of(text, options) {
        const tokens = Fountain.parse(String(text || ''));
        const layout = Paginate.layout(tokens, options);
        const pages = layout.pages.length;
        const L = layout.linesPerPage;
        let minutes = 0, end = 0;
        if (pages) {
            const last = layout.pages[pages - 1].lines;
            const used = last.reduce((m, l) => Math.max(m, l.row + 1), 0);
            minutes = Math.max(1, Math.round(pages - 1 + used / L));
            end = (pages - 1) * L + used;
        }
        const startOf = {};
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
            sc.characters = sc.characters.map((k) => byKey[k].name);
            delete sc.start;
        });

        const settings = { int: 0, ext: 0, both: 0, other: 0 };
        const timeBy = {}, placeBy = {};
        let untimed = 0;
        sceneList.forEach((sc) => {
            settings[sc.setting]++;
            if (sc.time) timeBy[sc.time] = (timeBy[sc.time] || 0) + 1; else untimed++;
            if (!sc.location || (sc.setting === 'other' && !sc.time)) return;
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
