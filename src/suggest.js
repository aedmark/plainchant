(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'), require('./editing.js'));
    else root.Suggest = factory(root.Fountain, root.Editing);
})(typeof self !== 'undefined' ? self : this, function (Fountain, Editing) {
    'use strict';

    const MAX_OPTIONS = 4;
    const SCENE_PREFIX_RE = /^(?:INT\.?\/EXT|EXT\.?\/INT|I\/E|INT|EXT|EST)(?:\.|\s)\s*/i;
    const TIME_SPLIT_RE = /\s+[-–—]\s+/;
    const TIME_TYPED_RE = /^(.*\S)\s+[-–—]+\s+([^-–—#(]*)$/;
    const USUAL_TIMES = ['DAY', 'NIGHT'];

    function locationOf(heading) {
        return heading.replace(SCENE_PREFIX_RE, '').split(TIME_SPLIT_RE)[0].trim();
    }

    function timeOf(heading) {
        const parts = heading.split(TIME_SPLIT_RE);
        return parts.length < 2 ? '' : parts[parts.length - 1].replace(/\s*\(.*$/, '').trim().toUpperCase();
    }

    function nameOf(cue) {
        let name = cue.trim();
        while (/\([^)]*\)\s*$/.test(name)) name = name.replace(/\s*\([^)]*\)\s*$/, '');
        return name.trim();
    }

    function collect(text, type, pick, skipLine) {
        const seen = new Map();
        Fountain.parse(text).forEach(function (t, order) {
            if (t.type !== type || t.line === skipLine) return;
            const word = pick(t);
            if (!word) return;
            const key = word.toUpperCase();
            const entry = seen.get(key) || { key: key, word: word, count: 0, last: 0 };
            entry.count++;
            entry.word = word;
            entry.last = order;
            seen.set(key, entry);
        });
        return Array.from(seen.values()).sort(function (a, b) {
            return b.count - a.count || b.last - a.last || (a.key < b.key ? -1 : 1);
        });
    }

    const castOf = function (text, skipLine) { return collect(text, 'dialogue', function (t) { return nameOf(t.character); }, skipLine); };
    const placesOf = function (text, skipLine) { return collect(text, 'scene', function (t) { return locationOf(t.text); }, skipLine); };
    const timesOf = function (text, skipLine) { return collect(text, 'scene', function (t) { return timeOf(t.text); }, skipLine); };
    const words = function (entries) { return entries.map(function (e) { return e.word; }); };

    function matching(entries, typed, asWritten) {
        const want = typed.toUpperCase();
        if (entries.some(function (e) { return e.key === want; })) return null;
        const found = entries.filter(function (e) { return e.key.length > want.length && e.key.indexOf(want) === 0; });
        if (found.length === 0) return null;
        return found.slice(0, MAX_OPTIONS).map(function (e) { return asWritten ? e.word : e.key; });
    }

    function timeOptions(text, skipLine, partial) {
        const entries = timesOf(text, skipLine);
        USUAL_TIMES.forEach(function (t) { if (!entries.some(function (e) { return e.key === t; })) entries.push({ key: t }); });
        const want = partial.trim().toUpperCase();
        if (entries.some(function (e) { return e.key === want; })) return null;
        const found = entries.filter(function (e) { return e.key.indexOf(want) === 0; }).slice(0, MAX_OPTIONS);
        return found.length ? found.map(function (e) { return e.key; }) : null;
    }

    function at(text, caret, mode) {
        const info = Editing.lineInfo(text, caret);
        if (caret !== info.end) return null;
        const line = info.lines[info.idx];
        if (line.trim() === '') {
            if (mode !== 'character' || (info.idx > 0 && info.lines[info.idx - 1].trim() !== '')) return null;
            const cast = castOf(text, info.idx).slice(0, MAX_OPTIONS).map(function (e) { return e.key; });
            return cast.length ? { kind: 'character', from: caret, to: caret, options: cast, tab: false } : null;
        }
        const kind = Editing.kindAt(text, info.idx);
        if (kind !== 'character' && kind !== 'scene') return null;

        const lead = line.length - line.replace(/^\s+/, '').length;
        const body = line.slice(lead);
        let skip;
        let forced = false;
        if (kind === 'character') {
            const m = body.match(/^@\s*/);
            forced = !!m;
            skip = m ? m[0].length : 0;
        } else {
            const m = body.match(SCENE_PREFIX_RE);
            if (m) skip = m[0].length;
            else if (body[0] === '.' && body[1] !== '.') skip = body.slice(1).match(/^\s*/)[0].length + 1;
            else return null;
        }
        const typed = body.slice(skip);
        if (typed.trim() === '') return null;
        const time = kind === 'scene' ? typed.match(TIME_TYPED_RE) : null;
        if (time) {
            const found = timeOptions(text, info.idx, time[2]);
            return found ? { kind: 'time', from: caret - time[2].length, to: caret, options: found } : null;
        }
        if (kind === 'scene' && (TIME_SPLIT_RE.test(typed) || /[#]/.test(typed))) return null;
        if (kind === 'character' && /[(^]/.test(typed)) return null;

        const found = matching(kind === 'character' ? castOf(text, info.idx) : placesOf(text, info.idx), typed, kind === 'scene' || forced);
        if (!found) return null;
        const from = info.start + lead + skip;
        return { kind: kind === 'character' ? 'character' : 'location', from: from, to: caret, options: found };
    }

    function edit(hit, option) {
        const end = hit.from + option.length;
        return { from: hit.from, to: hit.to, insert: option, selStart: end, selEnd: end };
    }

    return {
        names: function (text) { return words(castOf(text, -1)); },
        locations: function (text) { return words(placesOf(text, -1)); },
        at: at,
        edit: edit
    };
});
