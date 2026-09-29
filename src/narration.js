(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'));
    else root.Narration = factory(root.Fountain);
})(typeof self !== 'undefined' ? self : this, function (Fountain) {
    'use strict';

    const PACE = 150;
    const MIN_CHAPTERS = 3;
    const MIN_SECONDS = 10;

    const plain = (text) => Fountain.runs(text).map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
    const countWords = (text) => (plain(text).match(/\S+/g) || []).length;

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
