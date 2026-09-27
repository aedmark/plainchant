/*
 * Narration (P4-18, P3-13): how long a script takes to read aloud, and YouTube chapters from its sections. Pure: no
 * DOM, no window.
 *
 *   Narration.of(text, { pace, aloud }) -> { words, seconds, chapters: [{ title, line, start, seconds }],
 *                                            short: [index], few }
 *   Narration.clock(seconds)            -> "0:00", "4:05", "1:02:03"  (the way YouTube writes a timestamp)
 *   Narration.chapterList(chapters)     -> "0:00 Intro\n4:05 Act One\n..."  (to paste into a video's description)
 *
 * The time is the words read aloud at `pace` words a minute (default 150, a steady narrator; D-038). What is read
 * aloud: dialogue and lyrics, and with `aloud: 'all'` the action and centred text too. Never scene headings, cues,
 * parentheticals, transitions, sections, synopses, notes or the boneyard: those are for the reader, not the listener.
 * Words are counted the way Stats counts a speech (Fountain.runs, so notes and emphasis marks are not words). Dual
 * dialogue counts both sides, as if one followed the other.
 * Chapters are the script's top-level sections: the # depth nearest the top that the script uses (#, or ## if it has
 * no #), so ## parts inside # chapters stay inside them. A chapter starts at the words read before its section line.
 * YouTube wants the first at 0:00: words read before the first section become an "Intro" chapter, and otherwise the
 * first section is at 0:00 anyway. YouTube also wants at least three chapters, each at least ten seconds long:
 * `few` is true when there are fewer than three, and `short` lists the chapters under ten seconds, so the writer can
 * fix the script; nothing is merged or dropped behind their back.
 * Loads as window.Narration (after fountain.js) and via require() in Node.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'));
    else root.Narration = factory(root.Fountain);
})(typeof self !== 'undefined' ? self : this, function (Fountain) {
    'use strict';

    const PACE = 150;
    const MIN_CHAPTERS = 3;  // YouTube's rules for chapters in a description
    const MIN_SECONDS = 10;

    const plain = (text) => Fountain.runs(text).map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
    const countWords = (text) => (plain(text).match(/\S+/g) || []).length;

    // The words read aloud in one token
    function spoken(t, all) {
        if (t.type === 'dialogue') {
            return t.lines.reduce((n, l) => n + (l.type === 'dialogue' ? countWords(l.text) : 0), 0);
        }
        if (t.type === 'lyrics') return countWords(t.text);
        if (all && (t.type === 'action' || t.type === 'centered')) return countWords(t.text);
        return 0;
    }

    function of(text, options) {
        const opts = options || {};
        const pace = opts.pace > 0 ? opts.pace : PACE;
        const all = opts.aloud === 'all';
        const tokens = Fountain.parse(String(text || ''));
        const secondsAt = (words) => Math.round(words * 60 / pace);

        const depths = tokens.filter((t) => t.type === 'section').map((t) => t.depth);
        const top = depths.length ? Math.min.apply(null, depths) : 0;
        const chapters = [];
        let words = 0;
        tokens.forEach((t) => {
            if (t.type === 'section' && t.depth === top) {
                if (!chapters.length && words) chapters.push({ title: 'Intro', line: 0, start: 0 });
                chapters.push({ title: plain(t.text) || 'Chapter ' + (chapters.length + 1), line: t.line, start: secondsAt(words) });
                return;
            }
            words += spoken(t, all);
        });

        const seconds = secondsAt(words);
        const short = [];
        chapters.forEach((c, i) => {
            c.seconds = (i + 1 < chapters.length ? chapters[i + 1].start : seconds) - c.start;
            if (c.seconds < MIN_SECONDS) short.push(i);
        });
        return { words: words, seconds: seconds, chapters: chapters, short: short, few: chapters.length < MIN_CHAPTERS };
    }

    const two = (n) => (n < 10 ? '0' : '') + n;

    function clock(seconds) {
        const s = Math.max(0, Math.round(seconds));
        const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
        return (h ? h + ':' + two(m) : String(m)) + ':' + two(s % 60);
    }

    function chapterList(chapters) {
        return chapters.map((c) => clock(c.start) + ' ' + c.title).join('\n');
    }

    return { of: of, clock: clock, chapterList: chapterList, PACE: PACE };
});
