/*
 * Pagination for print (P3-04, D-021): parser tokens in, pages of positioned lines out. Pure: no DOM, no window.
 *
 * A screenplay page is a grid. Courier 12pt is 10 characters per inch and a line is 1/6 inch, so a page is 60 columns
 * by 54 rows on US Letter (58 on A4) inside standard margins, and counting lines here gives exactly what prints. See
 * docs/SPEC-PRINT.md for the page, the element positions (§4) and the rules for where a page may break (§5).
 *
 *   Paginate.layout(tokens, { paper })  -> { paper, linesPerPage, columns, titlePage: [line] | null,
 *                                            pages: [{ number, lines: [line] }] }   number is null on page 1
 *   Paginate.wrap(runs, width)          -> [{ runs, breakAfter }]  word-wrapped visual lines
 *
 *   line = { row, col, width, align: 'left' | 'center' | 'right', runs: [{ text, bold, italic, underline }], kind,
 *            side?: 'left' | 'right' (dual dialogue), number?: scene number }
 *
 * Lines come in reading order (dual dialogue: the whole left speech, then the right). Rows count from 0 at the top
 * margin; columns from 0 at the left margin. Loads as window.Paginate (after fountain.js) and via require() in Node.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'));
    else root.Paginate = factory(root.Fountain);
})(typeof self !== 'undefined' ? self : this, function (Fountain) {
    'use strict';

    const COLUMNS = 60;
    const PAPER = { letter: 54, a4: 58 };

    // Where each element sits: first column and width, in characters from the left margin (spec §4)
    const GEO = {
        scene: { col: 0, width: 60 },
        action: { col: 0, width: 60 },
        character: { col: 22, width: 38 },
        parenthetical: { col: 16, width: 20 },
        dialogue: { col: 10, width: 35 },
        more: { col: 22, width: 38 },
        transition: { col: 0, width: 60, align: 'right' },
        centered: { col: 0, width: 60, align: 'center' },
        lyrics: { col: 0, width: 60 }
    };
    // Dual dialogue: two 28-column speeches, 4 columns apart
    const DUAL = {
        left: 0, right: 32,
        character: { col: 6, width: 22 }, parenthetical: { col: 3, width: 22 }, dialogue: { col: 0, width: 28 }
    };
    const SENTENCE_END = /[.!?…]["'”’)\]]*$/;

    // ---------- wrapping ----------

    const sameStyle = (a, b) => a.bold === b.bold && a.italic === b.italic && a.underline === b.underline;

    function toRuns(chars) {
        const out = [];
        chars.forEach((c) => {
            const last = out[out.length - 1];
            if (last && sameStyle(last, c.s)) last.text += c.ch;
            else out.push({ text: c.ch, bold: c.s.bold, italic: c.s.italic, underline: c.s.underline });
        });
        return out;
    }

    function trimEnd(chars) {
        let end = chars.length;
        while (end > 0 && chars[end - 1].ch === ' ') end--;
        return chars.slice(0, end);
    }

    /** Word-wraps styled text to `width` columns. Each line says whether a page may break after it. */
    function wrap(runs, width) {
        const paragraphs = [[]];
        (runs || []).forEach((r) => {
            for (const ch of String(r.text).replace(/\t/g, '    ')) {
                if (ch === '\n') paragraphs.push([]);
                else paragraphs[paragraphs.length - 1].push({ ch: ch, s: r });
            }
        });
        const out = [];
        paragraphs.forEach((p) => {
            const lines = [];
            let start = 0;
            while (start < p.length) {
                if (p.length - start <= width) { lines.push(p.slice(start)); break; }
                let cut = -1;
                for (let i = start + width; i > start; i--) {
                    if (p[i].ch === ' ') { cut = i; break; }                                   // at a space
                    if (p[i - 1].ch === '-' && i - 1 > start && p[i - 2].ch !== ' ') { cut = i; break; } // after a hyphen
                }
                if (cut === -1 || !trimEnd(p.slice(start, cut)).length) cut = start + width;     // one long word: cut it
                lines.push(p.slice(start, cut));
                start = cut;
                while (start < p.length && p[start].ch === ' ') start++;                        // the spaces broken at
            }
            if (!lines.length) lines.push([]);
            lines.forEach((chars, i) => {
                const kept = trimEnd(chars);
                const text = kept.map((c) => c.ch).join('');
                out.push({ runs: toRuns(kept), breakAfter: i === lines.length - 1 || SENTENCE_END.test(text) });
            });
        });
        return out;
    }

    // ---------- elements to blocks ----------

    const upper = (runs) => runs.map((r) => Object.assign({}, r, { text: r.text.toUpperCase() }));
    const italic = (runs) => runs.map((r) => Object.assign({}, r, { italic: true }));
    const visible = (runs) => runs.some((r) => r.text.trim());

    function lines(kind, runs, geo, extra) {
        return wrap(runs, geo.width).map((l) => Object.assign({
            kind: kind, col: geo.col, width: geo.width, align: geo.align || 'left', runs: l.runs, breakAfter: l.breakAfter
        }, extra || {}));
    }

    function cueLines(text, geo, extra) {
        return lines('character', Fountain.runs(text), geo, extra);
    }

    function speechLines(entries, geoFor, extra) {
        const out = [];
        entries.forEach((e) => {
            const runs = Fountain.runs(e.text);
            if (visible(runs)) out.push.apply(out, lines(e.type, runs, geoFor(e.type), extra));
        });
        return out;
    }

    function dialogueBlock(t) {
        const head = cueLines(t.character, GEO.character);
        return { type: 'dialogue', character: t.character, head: head.length,
            lines: head.concat(speechLines(t.lines, (k) => GEO[k])) };
    }

    function dualBlock(left, right) {
        const side = (t, name) => {
            const x = DUAL[name];
            const shift = (g) => ({ col: g.col + x, width: g.width });
            return cueLines(t.character, shift(DUAL.character), { side: name })
                .concat(speechLines(t.lines, (k) => shift(DUAL[k]), { side: name }));
        };
        const l = side(left, 'left'), r = side(right, 'right');
        return { type: 'dual', lines: l.concat(r), height: Math.max(l.length, r.length), parts: [left, right] };
    }

    function blocksFrom(tokens) {
        const blocks = [];
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            switch (t.type) {
                case 'scene': {
                    const ls = lines('scene', upper(Fountain.runs(t.text)), GEO.scene);
                    if (t.number) ls[0].number = t.number;
                    blocks.push({ type: 'scene', lines: ls });
                    break;
                }
                case 'dialogue':
                    if (t.dual === 'left' && tokens[i + 1] && tokens[i + 1].type === 'dialogue' && tokens[i + 1].dual === 'right') {
                        blocks.push(dualBlock(t, tokens[i + 1]));
                        i++;
                    } else blocks.push(dialogueBlock(t));
                    break;
                case 'action': case 'transition': case 'centered': case 'lyrics': {
                    let runs = Fountain.runs(t.text);
                    if (!visible(runs)) break; // a note on its own prints nothing, and leaves no gap
                    if (t.type === 'transition') runs = upper(runs);
                    if (t.type === 'lyrics') runs = italic(runs);
                    blocks.push({ type: t.type, lines: lines(t.type, runs, GEO[t.type]) });
                    break;
                }
                case 'page_break': blocks.push({ type: 'break', lines: [] }); break;
                default: break; // title page (its own sheet), sections and synopses are not printed in the body
            }
        }
        return blocks;
    }

    // ---------- where a page may break (spec §5) ----------

    const height = (b) => (b.type === 'dual' ? b.height : b.lines.length);

    /** Action-like: the ways to keep k lines here and the rest on the next page, two lines each side at least. */
    function actionSplits(b) {
        const ks = [];
        for (let k = 2; k <= b.lines.length - 2; k++) if (b.lines[k - 1].breakAfter) ks.push(k);
        return ks;
    }

    /** Dialogue: k speech lines here (after the cue), ending on a sentence of speech, two lines each side at least. */
    function dialogueSplits(b) {
        const speech = b.lines.slice(b.head);
        const ks = [];
        for (let k = 2; k <= speech.length - 2; k++) {
            if (speech[k - 1].kind === 'dialogue' && speech[k - 1].breakAfter) ks.push(k);
        }
        return ks;
    }

    // The fewest rows the block can leave at the foot of a page (its whole height if it cannot split)
    function minRows(blocks, j) {
        const b = blocks[j];
        if (!b || b.type === 'break') return 0;
        if (b.type === 'scene') {
            const next = blocks[j + 1];
            return b.lines.length + (next && next.type !== 'break' ? 1 + minRows(blocks, j + 1) : 0);
        }
        if (b.type === 'action' || b.type === 'lyrics' || b.type === 'centered') {
            const ks = actionSplits(b);
            return ks.length ? ks[0] : b.lines.length;
        }
        if (b.type === 'dialogue') {
            const ks = dialogueSplits(b);
            return ks.length ? b.head + ks[0] + 1 : b.lines.length;
        }
        return height(b);
    }

    function contd(b) {
        return b.character.replace(/\s*\(CONT['’]D\)\s*$/i, '') + ' (CONT\'D)';
    }

    function layout(tokens, options) {
        const paper = options && options.paper === 'a4' ? 'a4' : 'letter';
        const N = PAPER[paper];
        const blocks = blocksFrom(tokens || []);
        const pages = [];
        let page = [];
        let row = 0; // rows used on this page

        const newPage = () => { if (page.length) pages.push(page); page = []; row = 0; };
        const emit = (tpl, r) => {
            const line = { row: r, col: tpl.col, width: tpl.width, align: tpl.align, runs: tpl.runs, kind: tpl.kind };
            if (tpl.side) line.side = tpl.side;
            if (tpl.number) line.number = tpl.number;
            page.push(line);
        };
        const gap = () => (row === 0 ? 0 : 1);
        const placeAll = (b) => {
            const top = row + gap();
            if (b.type === 'dual') {
                let l = 0, r = 0;
                b.lines.forEach((x) => emit(x, top + (x.side === 'left' ? l++ : r++)));
            } else b.lines.forEach((x, i) => emit(x, top + i));
            row = top + height(b);
        };
        const placeFirst = (b, k) => { // the first k lines of b, which fit here
            const top = row + gap();
            b.lines.slice(0, k).forEach((x, i) => emit(x, top + i));
            row = top + k;
        };

        for (let i = 0; i < blocks.length; i++) {
            let b = blocks[i];
            if (b.type === 'break') { newPage(); continue; }
            if (b.type === 'dual' && b.height > N) { // taller than a page: print the two speeches one after the other
                blocks.splice(i, 1, dialogueBlock(b.parts[0]), dialogueBlock(b.parts[1]));
                b = blocks[i];
            }
            const free = () => N - row - gap();

            if (b.type === 'scene') { // never the last thing on a page: it needs some of what follows under it
                if (row > 0 && minRows(blocks, i) > free()) newPage();
                placeAll(b);
                continue;
            }

            while (true) {
                const h = height(b);
                if (h <= free()) {
                    // A transition should not start a page: if this block fits but the transition after it would not,
                    // both go over (when they fit together on a page).
                    const next = blocks[i + 1];
                    if (row > 0 && next && next.type === 'transition' && h + 1 + height(next) > free() && h + 1 + height(next) <= N) newPage();
                    placeAll(b);
                    break;
                }
                if (b.type === 'action' || b.type === 'lyrics' || b.type === 'centered') {
                    let k = actionSplits(b).filter((x) => x <= free()).pop() || 0;
                    if (!k && row > 0) { newPage(); continue; }
                    if (!k) k = free(); // taller than a page with nowhere proper to break: break where the page ends
                    placeFirst(b, k);
                    newPage();
                    b = { type: b.type, lines: b.lines.slice(k) };
                    continue;
                }
                if (b.type === 'dialogue') {
                    let k = dialogueSplits(b).filter((x) => b.head + x + 1 <= free()).pop() || 0;
                    if (!k && row > 0) { newPage(); continue; }
                    if (!k) k = Math.max(1, free() - b.head - 1);
                    placeFirst(b, b.head + k);
                    emit(Object.assign({ runs: [{ text: '(MORE)', bold: false, italic: false, underline: false }], kind: 'more', align: 'left' }, GEO.more), row);
                    newPage();
                    const head = cueLines(contd(b), GEO.character);
                    b = { type: 'dialogue', character: b.character, head: head.length, lines: head.concat(b.lines.slice(b.head + k)) };
                    continue;
                }
                // Scene numbers aside, everything else (transitions, dual dialogue) moves whole
                if (row > 0) { newPage(); continue; }
                placeAll(b);
                break;
            }
        }
        newPage();

        return {
            paper: paper, linesPerPage: N, columns: COLUMNS,
            titlePage: titlePage(tokens || [], N),
            pages: pages.map((lines, i) => ({ number: i === 0 ? null : i + 1, lines: lines }))
        };
    }

    // ---------- the title page (spec §6) ----------

    function titlePage(tokens, N) {
        const t = tokens.find((x) => x.type === 'title_page');
        if (!t) return null;
        const get = (key) => {
            const f = t.fields.find((x) => x.key.toLowerCase() === key);
            return f ? f.value.split('\n').map((s) => s.trim()).filter(Boolean).join('\n') : '';
        };
        const out = [];
        const put = (ls, first) => ls.forEach((l, i) => out.push({ row: first + i, col: l.col, width: l.width, align: l.align, runs: l.runs, kind: l.kind }));

        let row = Math.floor(N / 3) - 1;
        [['title', 'title'], ['credit', 'credit'], ['author', 'author'], ['authors', 'author'], ['source', 'source']].forEach(([key, kind]) => {
            const v = get(key);
            if (!v || (key === 'authors' && get('author'))) return;
            let runs = Fountain.runs(v);
            if (key === 'title') runs = upper(runs);
            const ls = lines(kind, runs, { col: 0, width: COLUMNS, align: 'center' });
            put(ls, row);
            row += ls.length + 1;
        });

        const bottom = (keys, geo) => {
            let ls = [];
            keys.forEach(([key, kind]) => { const v = get(key); if (v) ls = ls.concat(lines(kind, Fountain.runs(v), geo)); });
            put(ls, N - ls.length);
        };
        bottom([['notes', 'notes'], ['contact', 'contact']], { col: 0, width: 30 });
        bottom([['draft date', 'date'], ['date', 'date'], ['copyright', 'copyright']], { col: 30, width: 30, align: 'right' });
        return out;
    }

    return { layout: layout, wrap: wrap, PAPER: PAPER, COLUMNS: COLUMNS };
});
