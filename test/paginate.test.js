// Pagination suite (src/paginate.js, P3-04). Expects globals: test, assert, Fountain, Paginate.
// A page is a grid (D-021): 60 columns, 54 rows on US Letter, 58 on A4. Fixtures use `pgFill(n)`, an action of n
// one-line paragraphs, to put the next element exactly where a rule has to decide.

const PG_ROWS = 54;
const pgText = (line) => line.runs.map((r) => r.text).join('');
const pgLayout = (src, opts) => Paginate.layout(Fountain.parse(src), opts);
const pgPage = (layout, i) => layout.pages[i].lines.map((l) => ({ row: l.row, kind: l.kind, text: pgText(l) }));
const pgFill = (n) => Array.from({ length: n }, (_, i) => 'Filler ' + i + '.').join('\n');
const pgKinds = (layout, i) => layout.pages[i].lines.map((l) => l.kind);
const pgLast = (layout, i) => { const p = pgPage(layout, i); return p[p.length - 1]; };

// ---------- wrapping ----------

const pgWrap = (text, width) => Paginate.wrap(Fountain.runs(text), width).map(pgText);

test('wrap: fills each line with whole words up to the width', () => {
    assert.deepEqual(pgWrap('one two three four', 9), ['one two', 'three', 'four']);
    assert.deepEqual(pgWrap('abc def', 7), ['abc def'], 'exactly the width fits');
    assert.deepEqual(pgWrap('', 10), [''], 'an empty element is one empty line');
});

test('wrap: breaks after a hyphen, cuts a word longer than the line, and drops the spaces it breaks at', () => {
    assert.deepEqual(pgWrap('well-known words', 8), ['well-', 'known', 'words']);
    assert.deepEqual(pgWrap('abcdefghijkl', 5), ['abcde', 'fghij', 'kl']);
    assert.deepEqual(pgWrap('a   b', 1), ['a', 'b']);
});

test('wrap: keeps leading spaces (indented action), turns tabs into spaces, and starts a new line at each newline', () => {
    assert.deepEqual(pgWrap('    indented', 20), ['    indented']);
    assert.deepEqual(pgWrap('a\tb', 20), ['a    b']);
    assert.deepEqual(pgWrap('first\nsecond', 20), ['first', 'second']);
});

test('wrap: emphasis survives across the break', () => {
    const lines = Paginate.wrap(Fountain.runs('plain **bold words here** end'), 12);
    assert.deepEqual(lines.map(pgText), ['plain bold', 'words here', 'end']);
    assert.deepEqual(lines[0].runs.map((r) => [r.text, r.bold]), [['plain ', false], ['bold', true]]);
    assert.ok(lines[1].runs.every((r) => r.bold), 'the whole second line is bold');
    assert.equal(lines[2].runs[0].bold, false);
});

test('wrap: marks where a sentence or a paragraph ends (the only places a page may break inside an element)', () => {
    const lines = Paginate.wrap(Fountain.runs('He runs. She\nwaits "Why?"\nand then'), 9);
    assert.deepEqual(lines.map(pgText), ['He runs.', 'She', 'waits', '"Why?"', 'and then']);
    assert.deepEqual(lines.map((l) => l.breakAfter), [true, true, false, true, true]);
});

// ---------- the grid ----------

test('page: 54 rows on US Letter (the default), 58 on A4, always 60 columns', () => {
    assert.equal(pgLayout('Hi.').linesPerPage, 54);
    assert.equal(pgLayout('Hi.', { paper: 'a4' }).linesPerPage, 58);
    assert.equal(pgLayout('Hi.').paper, 'letter');
    assert.equal(pgLayout('Hi.').columns, 60);
});

test('geometry: each element sits at its screenplay position and width', () => {
    const l = pgLayout('int. house - day #4#\n\nHe waits.\n\nJOHN (V.O.)\n(quietly)\nHello there.\n\n> CUT TO:\n\n> THE END <\n\n~Row row row');
    const at = (kind) => l.pages[0].lines.find((x) => x.kind === kind);
    assert.deepEqual([at('scene').col, at('scene').width, pgText(at('scene')), at('scene').number], [0, 60, 'INT. HOUSE - DAY', '4']);
    assert.ok(at('scene').runs.every((r) => !r.bold), 'scene headings are plain on paper (D-021)');
    assert.deepEqual([at('action').col, at('action').width], [0, 60]);
    assert.deepEqual([at('character').col, at('character').width, pgText(at('character'))], [22, 38, 'JOHN (V.O.)']);
    assert.deepEqual([at('parenthetical').col, at('parenthetical').width], [16, 20]);
    assert.deepEqual([at('dialogue').col, at('dialogue').width], [10, 35]);
    assert.deepEqual([at('transition').align, pgText(at('transition'))], ['right', 'CUT TO:']);
    assert.deepEqual([at('centered').align, pgText(at('centered'))], ['center', 'THE END']);
    assert.ok(at('lyrics').runs.every((r) => r.italic), 'lyrics are italic');
});

test('geometry: a forced mixed-case cue keeps its case; a scene heading is uppercased', () => {
    const l = pgLayout('@McCLANE\nYippee.');
    assert.equal(pgText(l.pages[0].lines[0]), 'McCLANE');
});

test('spacing: one blank row between elements, none inside a speech, and the page starts on row 0', () => {
    const p = pgPage(pgLayout('INT. A - DAY\n\nHe waits.\n\nJOHN\n(beat)\nHi.'), 0);
    assert.deepEqual(p.map((x) => x.row + ':' + x.kind), ['0:scene', '2:action', '4:character', '5:parenthetical', '6:dialogue']);
});

test('not printed: notes, sections, synopses and boneyard; a note-only element leaves no gap', () => {
    const p = pgPage(pgLayout('# Act One\n\n= The setup\n\nHe waits. [[fix]]\n\n[[just a note]]\n\n/* cut this */\n\nShe leaves.'), 0);
    assert.deepEqual(p.map((x) => x.row + ':' + x.text), ['0:He waits.', '2:She leaves.']);
});

test('page numbers: none on the first page, then "2", "3"; === starts a new page', () => {
    const l = pgLayout('One.\n\n===\n\nTwo.\n\n===\n\nThree.');
    assert.deepEqual(l.pages.map((p) => p.number), [null, 2, 3]);
    assert.deepEqual(l.pages.map((p) => pgText(p.lines[0])), ['One.', 'Two.', 'Three.']);
});

test('page: nothing is ever placed below the last row', () => {
    const l = pgLayout(Array.from({ length: 40 }, (_, i) => 'Line ' + i + ' of a scene that runs on for quite a while, long enough to wrap.').join('\n\n'));
    assert.ok(l.pages.length > 1);
    l.pages.forEach((p) => p.lines.forEach((x) => assert.ok(x.row >= 0 && x.row < PG_ROWS, 'row ' + x.row)));
});

// ---------- where a page may break ----------

test('scene heading: never the last thing on a page; it moves over with what follows', () => {
    const l = pgLayout(pgFill(PG_ROWS - 2) + '\n\nINT. HOUSE - DAY\n\nAnn.\nBob.\nCat.\nDan.');
    assert.ok(pgKinds(l, 0).every((k) => k === 'action'), 'page 1 holds only the filler');
    assert.deepEqual(pgPage(l, 1)[0], { row: 0, kind: 'scene', text: 'INT. HOUSE - DAY' });
});

test('scene heading: stays when at least two lines of what follows fit under it', () => {
    const l = pgLayout(pgFill(PG_ROWS - 6) + '\n\nINT. HOUSE - DAY\n\nAnn.\nBob.\nCat.\nDan.');
    assert.deepEqual(pgPage(l, 0).slice(-3).map((x) => x.text), ['INT. HOUSE - DAY', 'Ann.', 'Bob.'], 'three would fit, but then one would be left over');
    assert.deepEqual(pgPage(l, 1).map((x) => x.text), ['Cat.', 'Dan.']);
});

test('dialogue: splits between sentences, with (MORE) at the foot and the cue plus (CONT\'D) on the next page', () => {
    const speech = ['One.', 'Two.', 'Three.', 'Four.', 'Five.', 'Six.', 'Seven.', 'Eight.'].join('\n');
    const l = pgLayout(pgFill(PG_ROWS - 8) + '\n\nJOHN\n' + speech);
    const end = pgPage(l, 0).slice(-7);
    assert.deepEqual(end.map((x) => x.kind + ':' + x.text), ['character:JOHN', 'dialogue:One.', 'dialogue:Two.', 'dialogue:Three.',
        'dialogue:Four.', 'dialogue:Five.', 'more:(MORE)']);
    assert.equal(end[6].row, PG_ROWS - 1);
    assert.equal(l.pages[0].lines.find((x) => x.kind === 'more').col, 22);
    assert.deepEqual(pgPage(l, 1).slice(0, 4).map((x) => x.row + ':' + x.text), ['0:JOHN (CONT\'D)', '1:Six.', '2:Seven.', '3:Eight.']);
});

test('dialogue: (CONT\'D) follows an extension', () => {
    const l = pgLayout(pgFill(PG_ROWS - 6) + '\n\nJOHN (V.O.)\n' + ['A.', 'B.', 'C.', 'D.', 'E.'].join('\n'));
    assert.equal(pgPage(l, 1)[0].text, 'JOHN (V.O.) (CONT\'D)');
});

test('dialogue: keeps two lines on each side of the break, or moves the whole speech', () => {
    // Room for the cue and one line only: never a cue with one line and (MORE)
    const tight = pgLayout(pgFill(PG_ROWS - 4) + '\n\nJOHN\n' + ['A.', 'B.', 'C.', 'D.'].join('\n'));
    assert.ok(pgKinds(tight, 0).every((k) => k === 'action'), 'the speech moved whole');
    assert.equal(pgPage(tight, 1)[0].text, 'JOHN', 'no (CONT\'D) when nothing was split');
    // Exactly two each side is allowed
    const two = pgLayout(pgFill(PG_ROWS - 5) + '\n\nJOHN\n' + ['A.', 'B.', 'C.', 'D.'].join('\n'));
    assert.deepEqual(pgPage(two, 0).slice(-4).map((x) => x.text), ['JOHN', 'A.', 'B.', '(MORE)']);
    assert.deepEqual(pgPage(two, 1).map((x) => x.text), ['JOHN (CONT\'D)', 'C.', 'D.']);
});

test('dialogue: never splits mid-sentence, and a parenthetical never ends a page', () => {
    const run = pgLayout(pgFill(PG_ROWS - 6) + '\n\nJOHN\n' + 'and on and on '.repeat(20));
    assert.ok(pgKinds(run, 0).every((k) => k === 'action'), 'no sentence end to break at: the speech moved');
    const paren = pgLayout(pgFill(PG_ROWS - 6) + '\n\nJOHN\nOne.\nTwo.\n(beat)\nThree.\nFour.');
    const last = pgPage(paren, 0).filter((x) => x.kind !== 'more').pop();
    assert.ok(last.kind !== 'parenthetical', 'the page does not end on the parenthetical');
});

test('action: splits between sentences with two lines each side, or moves whole', () => {
    const split = pgLayout(pgFill(PG_ROWS - 4) + '\n\nAnn.\nBob.\nCat.\nDan.\nEve.');
    assert.deepEqual(pgPage(split, 0).slice(-3).map((x) => x.text), ['Ann.', 'Bob.', 'Cat.']);
    assert.deepEqual(pgPage(split, 1).map((x) => x.text), ['Dan.', 'Eve.']);
    const whole = pgLayout(pgFill(PG_ROWS - 2) + '\n\nAnn.\nBob.\nCat.\nDan.');
    assert.deepEqual(pgPage(whole, 1).map((x) => x.text), ['Ann.', 'Bob.', 'Cat.', 'Dan.']);
});

test('transition: does not start a page when the element before it can move over with it', () => {
    const l = pgLayout(pgFill(PG_ROWS - 4) + '\n\nAnn.\nBob.\nCat.\n\nCUT TO:');
    assert.ok(pgKinds(l, 0).every((k) => k === 'action') && pgLast(l, 0).text === 'Filler ' + (PG_ROWS - 5) + '.');
    assert.deepEqual(pgPage(l, 1).map((x) => x.row + ':' + x.text), ['0:Ann.', '1:Bob.', '2:Cat.', '4:CUT TO:']);
});

test('dual dialogue: side by side on the same rows, and never split', () => {
    const src = 'BRICK\nScrew you!\nAnd you.\n\nSTEEL ^\nScrew you more!\nAnd more.';
    const fits = pgLayout(src).pages[0].lines;
    const brick = fits.find((x) => pgText(x) === 'BRICK'), steel = fits.find((x) => pgText(x) === 'STEEL');
    assert.equal(brick.row, steel.row);
    assert.deepEqual([brick.col, steel.col], [6, 38]);
    assert.deepEqual(fits.filter((x) => x.kind === 'dialogue').map((x) => x.col), [0, 0, 32, 32]);
    assert.deepEqual(fits.map((x) => x.side), ['left', 'left', 'left', 'right', 'right', 'right'], 'reading order: left speech, then right');
    const moved = pgLayout(pgFill(PG_ROWS - 3) + '\n\n' + src);
    assert.ok(pgKinds(moved, 0).every((k) => k === 'action'), 'too tall for the space left: it moved whole');
    assert.equal(moved.pages[1].lines[0].row, 0);
});

test('too tall for any page: a speech longer than a page still splits (no words are ever dropped by a rule)', () => {
    const lines = Array.from({ length: 70 }, (_, i) => 'Word' + i + '.');
    const l = pgLayout('JOHN\n' + lines.join('\n'));
    assert.equal(l.pages.length, 2);
    assert.equal(pgLast(l, 0).text, '(MORE)');
    assert.equal(pgPage(l, 1)[0].text, 'JOHN (CONT\'D)');
    const spoken = [0, 1].reduce((all, i) => all.concat(pgPage(l, i).filter((x) => x.kind === 'dialogue').map((x) => x.text)), []);
    assert.deepEqual(spoken, lines);
});

test('too tall with nowhere proper to break (no sentence ends at all): split where the page ends, still losing nothing', () => {
    const speech = pgLayout('JOHN\n' + 'on and '.repeat(400).trim());
    assert.ok(speech.pages.length >= 2);
    assert.equal(pgLast(speech, 0).text, '(MORE)');
    assert.equal(pgLast(speech, 0).row, PG_ROWS - 1);
    const said = speech.pages.reduce((all, p) => all.concat(p.lines.filter((x) => x.kind === 'dialogue').map(pgText)), []).join(' ');
    assert.equal(said, 'on and '.repeat(400).trim());
    const action = pgLayout('on and '.repeat(600).trim());
    assert.equal(action.pages[0].lines.length, PG_ROWS, 'the first page is full to the last row');
    assert.equal(action.pages.reduce((all, p) => all.concat(p.lines.map(pgText)), []).join(' '), 'on and '.repeat(600).trim());
});

test('transitions are uppercased on paper, as in the preview', () => {
    assert.equal(pgText(pgLayout('> fade out.').pages[0].lines[0]), 'FADE OUT.');
});

// ---------- the title page ----------

test('title page: on its own sheet, not counted; title a third of the way down, contact bottom left, date bottom right', () => {
    const l = pgLayout('Title: Big Fish\nCredit: Written by\nAuthor: Jane Doe\nDraft date: 1 May 2026\nContact:\n    jane@example.com\n    555-0100\n\nINT. POND - DAY\n\nA fish.');
    const tp = l.titlePage.map((x) => ({ row: x.row, align: x.align, text: pgText(x) }));
    assert.deepEqual(tp.find((x) => x.text === 'BIG FISH'), { row: 17, align: 'center', text: 'BIG FISH' });
    assert.deepEqual(tp.find((x) => x.text === 'Written by'), { row: 19, align: 'center', text: 'Written by' });
    assert.deepEqual(tp.find((x) => x.text === 'Jane Doe'), { row: 21, align: 'center', text: 'Jane Doe' });
    assert.deepEqual(tp.filter((x) => x.align === 'left').map((x) => x.row + ':' + x.text), [(PG_ROWS - 2) + ':jane@example.com', (PG_ROWS - 1) + ':555-0100']);
    assert.deepEqual(tp.filter((x) => x.align === 'right').map((x) => x.row + ':' + x.text), [(PG_ROWS - 1) + ':1 May 2026']);
    assert.equal(l.pages[0].number, null, 'the first script page is still unnumbered');
    assert.equal(pgText(l.pages[0].lines[0]), 'INT. POND - DAY');
});

test('title page: none when the script has no Title: block', () => {
    assert.equal(pgLayout('INT. A - DAY').titlePage, null);
});

// ---------- whole scripts ----------

// A small seeded generator, so a failure can be replayed
const pgRandom = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pgScript = (rnd) => {
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const words = ['rain', 'glass', 'coffee', 'door', 'quietly', 'never', 'again', 'window', 'hands', 'the', 'a', 'slowly'];
    const sentence = () => { const n = 2 + Math.floor(rnd() * 14); let s = ''; for (let i = 0; i < n; i++) s += (i ? ' ' : '') + pick(words); return s[0].toUpperCase() + s.slice(1) + pick(['.', '.', '?', '!', ',']); };
    const para = () => Array.from({ length: 1 + Math.floor(rnd() * 5) }, sentence).join(' ');
    const out = [];
    for (let i = 0; i < 120; i++) {
        const r = rnd();
        const afterScene = out.length && /^INT\./.test(out[out.length - 1]);
        if (r < 0.1) out.push('INT. ROOM ' + i + ' - DAY');
        else if (r < 0.45) out.push(Array.from({ length: 1 + Math.floor(rnd() * 3) }, para).join('\n'));
        else if (r < 0.85) {
            const lines = [];
            for (let j = 0; j < 1 + Math.floor(rnd() * 6); j++) lines.push(rnd() < 0.2 ? '(' + pick(words) + ')' : para());
            if (lines[lines.length - 1][0] === '(') lines.push(sentence());
            out.push(pick(['JOHN', 'MARY', 'JOHN (V.O.)']) + '\n' + lines.join('\n'));
            if (rnd() < 0.1) out.push('STEEL ^\n' + sentence());
        } else if (r < 0.92) out.push('CUT TO:');
        else if (r < 0.96) out.push('> ' + sentence() + ' <');
        else if (!afterScene) out.push('==='); // a page break straight after a heading is the writer's choice, not a rule's
    }
    return out.join('\n\n');
};
const pgWords = (s) => s.toUpperCase().split(/\s+/).filter(Boolean);

test('no words lost: every printed word of the script appears on the pages exactly once, in order', () => {
    for (let seed = 1; seed <= 25; seed++) {
        const src = pgScript(pgRandom(seed));
        const tokens = Fountain.parse(src);
        const expected = [];
        tokens.forEach((t) => {
            if (t.type === 'dialogue') t.lines.forEach((x) => expected.push(...pgWords(x.text)));
            else if (t.text !== undefined && t.type !== 'section' && t.type !== 'synopsis') expected.push(...pgWords(t.text));
        });
        const layout = Paginate.layout(tokens);
        const printed = [];
        layout.pages.forEach((p) => p.lines.forEach((x) => { if (x.kind !== 'character' && x.kind !== 'more') printed.push(...pgWords(pgText(x))); }));
        assert.deepEqual(printed, expected, 'seed ' + seed);
        layout.pages.forEach((p, i) => p.lines.forEach((x) => {
            assert.ok(x.row >= 0 && x.row < PG_ROWS, 'seed ' + seed + ' page ' + (i + 1) + ' row ' + x.row);
            assert.ok(pgText(x).length <= x.width, 'seed ' + seed + ': a line wider than its element');
        }));
    }
});

test('no page ends on a scene heading, a lone cue or a parenthetical (whole generated scripts)', () => {
    for (let seed = 1; seed <= 25; seed++) {
        const layout = pgLayout(pgScript(pgRandom(seed)));
        layout.pages.slice(0, -1).forEach((p, i) => {
            const last = p.lines[p.lines.length - 1];
            if (!last || last.side) return; // dual dialogue is never split, so its last line is fine
            assert.ok(['scene', 'character', 'parenthetical'].indexOf(last.kind) === -1, 'seed ' + seed + ' page ' + (i + 1) + ' ends on ' + last.kind);
        });
    }
});

test('speed: a feature-length script (about 120 pages) lays out quickly', () => {
    const src = Array.from({ length: 12 }, (_, i) => pgScript(pgRandom(100 + i))).join('\n\n');
    const tokens = Fountain.parse(src);
    const t0 = Date.now();
    const pages = Paginate.layout(tokens).pages.length;
    const ms = Date.now() - t0;
    assert.ok(pages >= 100, pages + ' pages');
    assert.ok(ms < 150, pages + ' pages took ' + ms + ' ms');
});
