/*
 * Autocomplete (P2-04): pure rules for suggesting a character name or a scene location while the writer types it.
 *
 * Nothing here touches the DOM. The names and locations come from the script itself (character cues and scene
 * headings), so there is nothing to set up and nothing to keep in sync. Loads as window.Suggest (after fountain.js and
 * editing.js) in the browser and via require() in Node.
 *
 *   Suggest.names(text)       every character name in the script, most used first, then most recent
 *   Suggest.locations(text)   every scene location (no INT./EXT., scene number or time of day), same order
 *   Suggest.at(text, caret, mode)
 *                             { kind: 'character' | 'location' | 'time', from, to, options, tab? } for the word being
 *                             typed, or null. `mode` is the element chosen with Tab or the bar ('character' offers
 *                             names on an empty line). `tab: false`: Tab must not take it (it keeps cycling)
 *   Suggest.edit(hit, option) the edit that replaces the typed word with `option` (same shape as src/editing.js edits)
 *
 * A suggestion is only made when the caret is at the end of a line that is clearly a cue or a scene heading, at least
 * one letter has been typed, the typed text is a strict prefix of a known name, and it is not already a whole name.
 * That last rule is what keeps Enter and Tab honest: typing JOHN when the script also has JOHNNY must stay JOHN.
 * P2-21 (D-037) adds two: after a scene heading's location and a spaced dash, the times of day the script uses (most
 * used first) and then DAY and NIGHT, narrowed by what is typed; and with Character chosen on an empty line after a
 * blank one, the most used names, which Tab does not take (on that line Tab is still choosing the element).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'), require('./editing.js'));
    else root.Suggest = factory(root.Fountain, root.Editing);
})(typeof self !== 'undefined' ? self : this, function (Fountain, Editing) {
    'use strict';

    const MAX_OPTIONS = 4;
    // Longest alternatives first, so "INT./EXT. HOUSE" loses all of its prefix
    const SCENE_PREFIX_RE = /^(?:INT\.?\/EXT|EXT\.?\/INT|I\/E|INT|EXT|EST)(?:\.|\s)\s*/i;
    const TIME_SPLIT_RE = /\s+[-–—]\s+/; // "COFFEE SHOP - DAY": the location ends at the first spaced dash
    // A location, then the last spaced dash and whatever of the time of day is typed (no more dashes, no #, no notes)
    const TIME_TYPED_RE = /^(.*\S)\s+[-–—]+\s+([^-–—#(]*)$/;
    const USUAL_TIMES = ['DAY', 'NIGHT'];

    // ---------- collecting ----------

    /** The words after a scene heading's INT./EXT. and before its time of day. */
    function locationOf(heading) {
        return heading.replace(SCENE_PREFIX_RE, '').split(TIME_SPLIT_RE)[0].trim();
    }

    /** The time of day of a heading: after its last spaced dash, without a note in brackets (the parser has already
     *  taken off a scene number). */
    function timeOf(heading) {
        const parts = heading.split(TIME_SPLIT_RE);
        return parts.length < 2 ? '' : parts[parts.length - 1].replace(/\s*\(.*$/, '').trim().toUpperCase();
    }

    /** A cue's name without its extensions: "MARY (V.O.)" and "MARY (CONT'D)" are MARY. */
    function nameOf(cue) {
        let name = cue.trim();
        while (/\([^)]*\)\s*$/.test(name)) name = name.replace(/\s*\([^)]*\)\s*$/, '');
        return name.trim();
    }

    /**
     * Ordered spellings for one kind of token. Words that differ only in case are one entry, spelled the way they
     * were written last. `skipLine` leaves out the line being typed, which must not suggest itself.
     */
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

    // ---------- what is being typed ----------

    /** Known words that the typed text begins, or null when there is nothing worth offering. */
    function matching(entries, typed, asWritten) {
        const want = typed.toUpperCase();
        if (entries.some(function (e) { return e.key === want; })) return null; // already a whole name: leave it be
        const found = entries.filter(function (e) { return e.key.length > want.length && e.key.indexOf(want) === 0; });
        if (found.length === 0) return null;
        // Without an @ the line can only be a cue if it is capitals, so that is how it is offered
        return found.slice(0, MAX_OPTIONS).map(function (e) { return asWritten ? e.word : e.key; });
    }

    // The times of day to offer for `partial`: the script's own, then the usual ones; none if it is already whole
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
            // Character chosen on an empty line after a blank one: the names most used so far, for a tap
            if (mode !== 'character' || (info.idx > 0 && info.lines[info.idx - 1].trim() !== '')) return null;
            const cast = castOf(text, info.idx).slice(0, MAX_OPTIONS).map(function (e) { return e.key; });
            return cast.length ? { kind: 'character', from: caret, to: caret, options: cast, tab: false } : null;
        }
        const kind = Editing.kindAt(text, info.idx);
        if (kind !== 'character' && kind !== 'scene') return null;

        const lead = line.length - line.replace(/^\s+/, '').length;
        const body = line.slice(lead);
        let skip;   // characters of the line before the typed word
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
        if (typed.trim() === '') return null;                        // nothing typed yet: Tab has to keep cycling
        const time = kind === 'scene' ? typed.match(TIME_TYPED_RE) : null;
        if (time) {
            const found = timeOptions(text, info.idx, time[2]);
            return found ? { kind: 'time', from: caret - time[2].length, to: caret, options: found } : null;
        }
        if (kind === 'scene' && (TIME_SPLIT_RE.test(typed) || /[#]/.test(typed))) return null; // past the location
        if (kind === 'character' && /[(^]/.test(typed)) return null; // typing an extension

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
