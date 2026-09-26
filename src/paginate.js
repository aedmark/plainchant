/*
 * Pagination for print (P3-04, D-021): parser tokens in, pages of positioned lines out. Pure: no DOM, no window.
 *
 * A screenplay page is a grid. Courier 12pt is 10 characters per inch and a line is 1/6 inch, so a page is 60 columns
 * by 54 rows on US Letter (58 on A4) inside standard margins, and counting lines here gives exactly what prints. See
 * docs/SPEC-PRINT.md for the page, the element positions (§4) and the rules for where a page may break (§5).
 *
 *   Paginate.layout(tokens, { paper })  -> { paper, linesPerPage, columns, titlePage: [line] | null,
 *                                            pages: [{ number, lines: [line] }] }   number is null on page 1
 *   Paginate.wrap(runs, width)          -> [{ runs, start, end }]  word-wrapped lines, with where each sits in the text
 *
 *   line = { row, col, width, align: 'left' | 'center' | 'right', runs: [{ text, bold, italic, underline }], kind,
 *            side?: 'left' | 'right' (dual dialogue), number?: scene number, source?: a scene heading's source line }
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
    // A sentence ends at . ! ? or … (and any closing quotes or brackets) followed by more text
    const SENTENCE_END = /[.!?…]["'”’)\]]*(?=\s+\S)/g;

    // ---------- styled text ----------

    const textOf = (runs) => runs.map((r) => r.text).join('');
    const visible = (runs) => /\S/.test(textOf(runs));
    const restyle = (runs, change) => runs.map((r) => Object.assign({}, r, change(r)));
    const upper = (runs) => restyle(runs, (r) => ({ text: r.text.toUpperCase() }));
    const italic = (runs) => restyle(runs, () => ({ italic: true }));

    /** The runs covering characters [from, to) of their text. */
    function sliceRuns(runs, from, to) {
        const out = [];
        let at = 0;
        runs.forEach((r) => {
            const a = Math.max(from, at), b = Math.min(to, at + r.text.length);
            if (a < b) out.push(Object.assign({}, r, { text: r.text.slice(a - at, b - at) }));
            at += r.text.length;
        });
        return out;
    }

    /** Splits styled text at its newlines: one entry per paragraph. Tabs become four spaces. */
    function paragraphsOf(runs) {
        const out = [[]];
        runs.forEach((r) => {
            r.text.replace(/\t/g, '    ').split('\n').forEach((piece, i) => {
                if (i) out.push([]);
                if (piece) out[out.length - 1].push(Object.assign({}, r, { text: piece }));
            });
        });
        return out;
    }

    // ---------- wrapping ----------

    const sameStyle = (a, b) => a.bold === b.bold && a.italic === b.italic && a.underline === b.underline;

    /** Word-wraps styled text to `width` columns: at spaces, after a hyphen, or (one long word) anywhere. */
    function wrap(runs, width) {
        const chars = [];
        (runs || []).forEach((r) => { for (const ch of String(r.text).replace(/\t/g, '    ')) chars.push({ ch: ch, s: r }); });
        const out = [];
        const push = (from, to) => {
            let end = to;
            while (end > from && chars[end - 1].ch === ' ') end--;
            const kept = [];
            chars.slice(from, end).forEach((c) => {
                const last = kept[kept.length - 1];
                if (last && sameStyle(last, c.s)) last.text += c.ch;
                else kept.push({ text: c.ch, bold: !!c.s.bold, italic: !!c.s.italic, underline: !!c.s.underline });
            });
            out.push({ runs: kept, start: from, end: end });
        };
        let para = 0;
        for (let i = 0; i <= chars.length; i++) {
            if (i < chars.length && chars[i].ch !== '\n') continue;
            let start = para;
            if (start === i) push(start, i); // an empty paragraph is one empty line
            while (start < i) {
                if (i - start <= width) { push(start, i); break; }
                let cut = -1;
                for (let j = start + width; j > start; j--) {
                    if (chars[j].ch === ' ') { cut = j; break; }                                          // at a space
                    if (chars[j - 1].ch === '-' && j - 1 > start && chars[j - 2].ch !== ' ') { cut = j; break; } // after a hyphen
                }
                let blank = cut !== -1;
                for (let j = start; blank && j < cut; j++) if (chars[j].ch !== ' ') blank = false;
                if (cut === -1 || blank) cut = start + width;                                            // one long word: cut it
                push(start, cut);
                start = cut;
                while (start < i && chars[start].ch === ' ') start++;                                     // the spaces broken at
            }
            para = i + 1;
        }
        return out;
    }

    // ---------- elements to blocks ----------

    // A paragraph: styled text with no newline, in one position. A block is made of paragraphs (and, for dialogue,
    // a cue above them), so a page can break inside one and re-wrap the rest.
    function para(kind, runs, geo, extra) { return { kind: kind, runs: runs, geo: geo, extra: extra || null }; }

    function linesOf(paras) {
        const out = [];
        paras.forEach((p) => wrap(p.runs, p.geo.width).forEach((l) => {
            out.push(Object.assign({ kind: p.kind, col: p.geo.col, width: p.geo.width, align: p.geo.align || 'left', runs: l.runs }, p.extra || {}));
        }));
        return out;
    }

    function parasOf(kind, runs, geo, extra) {
        return paragraphsOf(runs).map((r) => para(kind, r, geo, extra));
    }

    function speechParas(entries, geoFor, extra) {
        const out = [];
        entries.forEach((e) => {
            const runs = Fountain.runs(e.text);
            if (visible(runs)) out.push.apply(out, parasOf(e.type, runs, geoFor(e.type), extra));
        });
        return out;
    }

    function dialogueBlock(character, speech, printedCue) {
        const head = linesOf(parasOf('character', Fountain.runs(printedCue || character), GEO.character));
        return { type: 'dialogue', character: character, head: head, paras: speech, lines: head.concat(linesOf(speech)) };
    }

    function dualBlock(left, right) {
        const side = (t, name) => {
            const shift = (g) => ({ col: g.col + DUAL[name], width: g.width });
            return linesOf(parasOf('character', Fountain.runs(t.character), shift(DUAL.character), { side: name }))
                .concat(linesOf(speechParas(t.lines, (k) => shift(DUAL[k]), { side: name })));
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
                    const ls = linesOf(parasOf('scene', upper(Fountain.runs(t.text)), GEO.scene));
                    if (t.number) ls[0].number = t.number;
                    ls[0].source = t.line; // so the outline can say which page a scene starts on
                    blocks.push({ type: 'scene', lines: ls });
                    break;
                }
                case 'dialogue':
                    if (t.dual === 'left' && tokens[i + 1] && tokens[i + 1].type === 'dialogue' && tokens[i + 1].dual === 'right') {
                        blocks.push(dualBlock(t, tokens[i + 1]));
                        i++;
                    } else blocks.push(dialogueBlock(t.character, speechParas(t.lines, (k) => GEO[k])));
                    break;
                case 'action': case 'transition': case 'centered': case 'lyrics': {
                    let runs = Fountain.runs(t.text);
                    if (!visible(runs)) break; // a note on its own prints nothing, and leaves no gap
                    if (t.type === 'transition') runs = upper(runs);
                    if (t.type === 'lyrics') runs = italic(runs);
                    const paras = parasOf(t.type, runs, GEO[t.type]);
                    blocks.push({ type: t.type, paras: paras, lines: linesOf(paras) });
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
    const splittable = (b) => ['action', 'lyrics', 'centered', 'dialogue'].indexOf(b.type) !== -1;

    /** Cuts paragraphs at character `o` of paragraph `p` (o null: after the whole paragraph) into [first, rest]. */
    function cut(paras, p, o) {
        if (o === null) return [paras.slice(0, p + 1), paras.slice(p + 1)];
        const text = textOf(paras[p].runs);
        let from = o;
        while (from < text.length && /\s/.test(text[from])) from++;
        const head = Object.assign({}, paras[p], { runs: sliceRuns(paras[p].runs, 0, o) });
        const tail = Object.assign({}, paras[p], { runs: sliceRuns(paras[p].runs, from, text.length) });
        return [paras.slice(0, p).concat([head]), [tail].concat(paras.slice(p + 1))];
    }

    /**
     * The proper ways to break a splittable block, in reading order: after a sentence or a paragraph, keeping at
     * least two lines on each side. Dialogue may not end a page on a parenthetical. Each option: { k, first, rest },
     * k being the lines (after the cue) that stay on this page.
     */
    function splits(b) {
        if (b.options) return b.options;
        const out = [];
        b.paras.forEach((pa, p) => {
            if (b.type === 'dialogue' && pa.kind !== 'dialogue') return;
            const text = textOf(pa.runs);
            const points = [];
            let m;
            SENTENCE_END.lastIndex = 0;
            while ((m = SENTENCE_END.exec(text))) points.push(m.index + m[0].length);
            if (p < b.paras.length - 1) points.push(null);
            points.forEach((o) => {
                const parts = cut(b.paras, p, o);
                const k = linesOf(parts[0]).length, rest = linesOf(parts[1]).length;
                if (k >= 2 && rest >= 2) out.push({ k: k, first: parts[0], rest: parts[1] });
            });
        });
        b.options = out;
        return out;
    }

    /** A break where the page ends, for a block taller than a page with no proper place to break. */
    function forcedSplit(b, k) {
        let seen = 0;
        for (let p = 0; p < b.paras.length; p++) {
            const lines = wrap(b.paras[p].runs, b.paras[p].geo.width);
            if (seen + lines.length >= k) {
                const at = lines[k - seen - 1].end;
                const parts = at >= textOf(b.paras[p].runs).length ? cut(b.paras, p, null) : cut(b.paras, p, at);
                return { k: k, first: parts[0], rest: parts[1] };
            }
            seen += lines.length;
        }
        return { k: seen, first: b.paras, rest: [] };
    }

    // The fewest rows the block can leave at the foot of a page (its whole height if it cannot split)
    function minRows(blocks, j) {
        const b = blocks[j];
        if (!b || b.type === 'break') return 0;
        if (b.type === 'scene') {
            const next = blocks[j + 1];
            return b.lines.length + (next && next.type !== 'break' ? 1 + minRows(blocks, j + 1) : 0);
        }
        if (!splittable(b) || !splits(b).length) return height(b);
        return b.type === 'dialogue' ? b.head.length + splits(b)[0].k + 1 : splits(b)[0].k;
    }

    function contd(character) {
        return character.replace(/\s*\(CONT['’]D\)\s*$/i, '') + ' (CONT\'D)';
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
            if (tpl.source !== undefined) line.source = tpl.source;
            page.push(line);
        };
        const gap = () => (row === 0 ? 0 : 1);
        const free = () => N - row - gap();
        const place = (lines, rows) => {
            const top = row + gap();
            if (rows !== undefined) { // dual dialogue: each side from the same top row
                let l = 0, r = 0;
                lines.forEach((x) => emit(x, top + (x.side === 'left' ? l++ : r++)));
            } else lines.forEach((x, i) => emit(x, top + i));
            row = top + (rows !== undefined ? rows : lines.length);
        };

        for (let i = 0; i < blocks.length; i++) {
            let b = blocks[i];
            if (b.type === 'break') { newPage(); continue; }
            if (b.type === 'dual' && b.height > N) { // taller than a page: print the two speeches one after the other
                const l = b.parts[0], r = b.parts[1];
                blocks.splice(i, 1, dialogueBlock(l.character, speechParas(l.lines, (k) => GEO[k])),
                    dialogueBlock(r.character, speechParas(r.lines, (k) => GEO[k])));
                b = blocks[i];
            }

            if (b.type === 'scene') { // never the last thing on a page: it needs some of what follows under it
                if (row > 0 && minRows(blocks, i) > free()) newPage();
                place(b.lines);
                continue;
            }

            while (true) {
                const h = height(b);
                if (h <= free()) {
                    // A transition should not start a page: if this block fits but the transition after it would not,
                    // both go over (when they fit together on a page).
                    const next = blocks[i + 1];
                    if (row > 0 && next && next.type === 'transition' && h + 1 + height(next) > free() && h + 1 + height(next) <= N) newPage();
                    place(b.lines, b.type === 'dual' ? b.height : undefined);
                    break;
                }
                if (!splittable(b)) { // transitions and dual dialogue move whole
                    if (row > 0) { newPage(); continue; }
                    place(b.lines, b.type === 'dual' ? b.height : undefined);
                    break;
                }
                const isDialogue = b.type === 'dialogue';
                const extra = isDialogue ? b.head.length + 1 : 0; // the cue above, (MORE) below
                let option = splits(b).filter((s) => s.k + extra <= free()).pop();
                if (!option && row > 0) { newPage(); continue; }
                if (!option) option = forcedSplit(b, Math.max(1, free() - extra)); // taller than a page, nowhere proper to break
                place((isDialogue ? b.head : []).concat(linesOf(option.first)));
                if (isDialogue) emit(Object.assign({ runs: [{ text: '(MORE)', bold: false, italic: false, underline: false }], kind: 'more', align: 'left' }, GEO.more), row);
                newPage();
                b = isDialogue
                    ? dialogueBlock(b.character, option.rest, contd(b.character))
                    : { type: b.type, paras: option.rest, lines: linesOf(option.rest) };
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
            const ls = linesOf(parasOf(kind, runs, { col: 0, width: COLUMNS, align: 'center' }));
            put(ls, row);
            row += ls.length + 1;
        });

        const bottom = (keys, geo) => {
            let ls = [];
            keys.forEach(([key, kind]) => { const v = get(key); if (v) ls = ls.concat(linesOf(parasOf(kind, Fountain.runs(v), geo))); });
            put(ls, N - ls.length);
        };
        bottom([['notes', 'notes'], ['contact', 'contact']], { col: 0, width: 30 });
        bottom([['draft date', 'date'], ['date', 'date'], ['copyright', 'copyright']], { col: 30, width: 30, align: 'right' });
        return out;
    }

    return { layout: layout, wrap: wrap, PAPER: PAPER, COLUMNS: COLUMNS };
});
