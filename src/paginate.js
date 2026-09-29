(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'));
    else root.Paginate = factory(root.Fountain);
})(typeof self !== 'undefined' ? self : this, function (Fountain) {
    'use strict';

    const COLUMNS = 60;
    const PAPER = { letter: 54, a4: 58 };

    const GEO = {
        scene: { col: 0, width: 60 },
        action: { col: 0, width: 60 },
        character: { col: 22, width: 38 },
        parenthetical: { col: 15, width: 25 },
        dialogue: { col: 10, width: 35 },
        more: { col: 22, width: 38 },
        transition: { col: 0, width: 60, align: 'right' },
        centered: { col: 0, width: 60, align: 'center' },
        lyrics: { col: 0, width: 60 }
    };
    const DUAL = {
        left: 0, right: 32,
        character: { col: 6, width: 22 }, parenthetical: { col: 3, width: 22 }, dialogue: { col: 0, width: 28 }
    };
    const SENTENCE_END = /[.!?…]["'”’)\]]*(?=\s+\S)/g;

    const textOf = (runs) => runs.map((r) => r.text).join('');
    const visible = (runs) => /\S/.test(textOf(runs));
    const restyle = (runs, change) => runs.map((r) => Object.assign({}, r, change(r)));
    const upper = (runs) => restyle(runs, (r) => ({ text: r.text.toUpperCase() }));
    const italic = (runs) => restyle(runs, () => ({ italic: true }));

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

    const sameStyle = (a, b) => a.bold === b.bold && a.italic === b.italic && a.underline === b.underline;

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
            if (start === i) push(start, i);
            while (start < i) {
                if (i - start <= width) { push(start, i); break; }
                let cut = -1;
                for (let j = start + width; j > start; j--) {
                    if (chars[j].ch === ' ') { cut = j; break; }
                    if (chars[j - 1].ch === '-' && j - 1 > start && chars[j - 2].ch !== ' ') { cut = j; break; }
                }
                let blank = cut !== -1;
                for (let j = start; blank && j < cut; j++) if (chars[j].ch !== ' ') blank = false;
                if (cut === -1 || blank) cut = start + width;
                push(start, cut);
                start = cut;
                while (start < i && chars[start].ch === ' ') start++;
            }
            para = i + 1;
        }
        return out;
    }

    function para(kind, runs, geo, extra) { return { kind: kind, runs: runs, geo: geo, extra: extra || null }; }

    function linesOf(paras) {
        const out = [];
        paras.forEach((p) => wrap(p.runs, p.geo.width).forEach((l) => {
            out.push(Object.assign({ kind: p.kind, col: p.geo.col, width: p.geo.width, align: p.geo.align || 'left', runs: l.runs }, p.extra || {}));
        }));
        return out;
    }

    function parasOf(kind, runs, geo, extra, at) {
        return paragraphsOf(runs).map((r, i) => para(kind, r, geo, at === undefined ? extra : Object.assign({}, extra, { at: at + i })));
    }

    function speechParas(entries, geoFor, extra) {
        const out = [];
        entries.forEach((e) => {
            const runs = Fountain.runs(e.text);
            if (visible(runs)) out.push.apply(out, parasOf(e.type, runs, geoFor(e.type), extra, e.line));
        });
        return out;
    }

    function dialogueBlock(character, speech, printedCue, at) {
        const head = linesOf(parasOf('character', Fountain.runs(printedCue || character), GEO.character, null, at));
        return { type: 'dialogue', character: character, at: at, head: head, paras: speech, lines: head.concat(linesOf(speech)) };
    }

    function dualBlock(left, right) {
        const side = (t, name) => {
            const shift = (g) => ({ col: g.col + DUAL[name], width: g.width });
            return linesOf(parasOf('character', Fountain.runs(t.character), shift(DUAL.character), { side: name }, t.line))
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
                    const ls = linesOf(parasOf('scene', upper(Fountain.runs(t.text)), GEO.scene, null, t.line));
                    if (t.number) ls[0].number = t.number;
                    ls[0].source = t.line;
                    blocks.push({ type: 'scene', lines: ls });
                    break;
                }
                case 'dialogue':
                    if (t.dual === 'left' && tokens[i + 1] && tokens[i + 1].type === 'dialogue' && tokens[i + 1].dual === 'right') {
                        blocks.push(dualBlock(t, tokens[i + 1]));
                        i++;
                    } else blocks.push(dialogueBlock(t.character, speechParas(t.lines, (k) => GEO[k]), undefined, t.line));
                    break;
                case 'action': case 'transition': case 'centered': case 'lyrics': {
                    let runs = Fountain.runs(t.text);
                    if (!visible(runs)) break;
                    if (t.type === 'transition') runs = upper(runs);
                    if (t.type === 'lyrics') runs = italic(runs);
                    const paras = parasOf(t.type, runs, GEO[t.type], null, t.line);
                    blocks.push({ type: t.type, paras: paras, lines: linesOf(paras) });
                    break;
                }
                case 'page_break': blocks.push({ type: 'break', lines: [] }); break;
                default: break;
            }
        }
        return blocks;
    }

    const height = (b) => (b.type === 'dual' ? b.height : b.lines.length);
    const splittable = (b) => ['action', 'lyrics', 'centered', 'dialogue'].indexOf(b.type) !== -1;

    function cut(paras, p, o) {
        if (o === null) return [paras.slice(0, p + 1), paras.slice(p + 1)];
        const text = textOf(paras[p].runs);
        let from = o;
        while (from < text.length && /\s/.test(text[from])) from++;
        const head = Object.assign({}, paras[p], { runs: sliceRuns(paras[p].runs, 0, o) });
        const tail = Object.assign({}, paras[p], { runs: sliceRuns(paras[p].runs, from, text.length) });
        return [paras.slice(0, p).concat([head]), [tail].concat(paras.slice(p + 1))];
    }

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

    function leadOf(b) {
        return b.type === 'scene' ? 2 : 1;
    }

    function minRows(blocks, j) {
        const b = blocks[j];
        if (!b || b.type === 'break') return 0;
        if (b.type === 'scene') {
            const next = blocks[j + 1];
            return b.lines.length + (next && next.type !== 'break' ? leadOf(next) + minRows(blocks, j + 1) : 0);
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
        let row = 0;

        const newPage = () => { if (page.length) pages.push(page); page = []; row = 0; };
        const emit = (tpl, r) => {
            const line = { row: r, col: tpl.col, width: tpl.width, align: tpl.align, runs: tpl.runs, kind: tpl.kind };
            if (tpl.side) line.side = tpl.side;
            if (tpl.number) line.number = tpl.number;
            if (tpl.source !== undefined) line.source = tpl.source;
            if (tpl.at !== undefined) line.at = tpl.at;
            page.push(line);
        };
        let lead = 1;
        const gap = () => (row === 0 ? 0 : lead);
        const free = () => N - row - gap();
        const place = (lines, rows) => {
            const top = row + gap();
            if (rows !== undefined) {
                let l = 0, r = 0;
                lines.forEach((x) => emit(x, top + (x.side === 'left' ? l++ : r++)));
            } else lines.forEach((x, i) => emit(x, top + i));
            row = top + (rows !== undefined ? rows : lines.length);
        };

        for (let i = 0; i < blocks.length; i++) {
            let b = blocks[i];
            if (b.type === 'break') { newPage(); continue; }
            if (b.type === 'dual' && b.height > N) {
                const l = b.parts[0], r = b.parts[1];
                blocks.splice(i, 1, dialogueBlock(l.character, speechParas(l.lines, (k) => GEO[k])),
                    dialogueBlock(r.character, speechParas(r.lines, (k) => GEO[k])));
                b = blocks[i];
            }
            lead = leadOf(b);

            if (b.type === 'scene') {
                if (row > 0 && minRows(blocks, i) > free()) newPage();
                place(b.lines);
                continue;
            }

            while (true) {
                const h = height(b);
                if (h <= free()) {
                    const next = blocks[i + 1];
                    if (row > 0 && next && next.type === 'transition' && h + 1 + height(next) > free() && h + 1 + height(next) <= N) newPage();
                    place(b.lines, b.type === 'dual' ? b.height : undefined);
                    break;
                }
                if (!splittable(b)) {
                    if (row > 0) { newPage(); continue; }
                    place(b.lines, b.type === 'dual' ? b.height : undefined);
                    break;
                }
                const isDialogue = b.type === 'dialogue';
                const extra = isDialogue ? b.head.length + 1 : 0;
                let option = splits(b).filter((s) => s.k + extra <= free()).pop();
                if (!option && row > 0) { newPage(); continue; }
                if (!option) option = forcedSplit(b, Math.max(1, free() - extra));
                place((isDialogue ? b.head : []).concat(linesOf(option.first)));
                if (isDialogue) emit(Object.assign({ runs: [{ text: '(MORE)', bold: false, italic: false, underline: false }], kind: 'more', align: 'left' }, GEO.more), row);
                newPage();
                b = isDialogue
                    ? dialogueBlock(b.character, option.rest, contd(b.character), b.at)
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
