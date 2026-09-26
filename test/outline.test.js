// Outline suite (src/outline.js, P4-03). Expects globals: test, assert, Fountain, Paginate, Outline.

const olKinds = (o) => o.items.map((i) => i.kind + ':' + i.level + ':' + i.text);

test('outline: an empty script has no outline', () => {
    assert.deepEqual(Outline.of('').items, []);
    assert.deepEqual(Outline.of('Just some action.').items, []);
});

test('outline: sections and scenes in order, scenes nested under the section above them', () => {
    const o = Outline.of('# Act One\n\nINT. A - DAY\n\nHi.\n\n## The meeting\n\nEXT. B - NIGHT\n\nHo.\n\n# Act Two\n\nINT. C - DAY');
    assert.deepEqual(olKinds(o), ['section:0:Act One', 'scene:1:INT. A - DAY', 'section:1:The meeting', 'scene:2:EXT. B - NIGHT',
        'section:0:Act Two', 'scene:1:INT. C - DAY']);
});

test('outline: scenes before any section sit at the top level; each item knows its source line', () => {
    const o = Outline.of('INT. A - DAY\n\nHi.\n\nEXT. B - NIGHT');
    assert.deepEqual(o.items.map((i) => [i.kind, i.level, i.line]), [['scene', 0, 0], ['scene', 0, 4]]);
});

test('outline: a synopsis belongs to the item above it; one before anything stands alone', () => {
    const o = Outline.of('= The whole story\n\n# Act One\n= Setup\n\nINT. A - DAY\n= She waits');
    assert.deepEqual(olKinds(o), ['synopsis:0:The whole story', 'section:0:Act One', 'scene:1:INT. A - DAY']);
    assert.equal(o.items[1].synopsis, 'Setup');
    assert.equal(o.items[2].synopsis, 'She waits');
});

test('outline: scene headings read as printed (capitals, no number marks, no notes or emphasis marks)', () => {
    const o = Outline.of('int. *big* house - day [[fix]] #12A#');
    assert.deepEqual([o.items[0].text, o.items[0].number], ['INT. BIG HOUSE - DAY', '12A']);
});

test('outline: each scene knows the page it starts on, as printed on the paper asked for', () => {
    const filler = Array.from({ length: 56 }, (_, i) => 'Filler ' + i + '.').join('\n');
    const text = 'INT. A - DAY\n\n' + filler + '\n\nEXT. B - NIGHT\n\nHo.';
    assert.deepEqual(Outline.of(text).items.map((i) => i.page), [1, 2]);
    assert.deepEqual(Outline.of(text, { paper: 'a4' }).items.map((i) => i.page), [1, 2]);
    const short = 'INT. A - DAY\n\n' + Array.from({ length: 50 }, (_, i) => 'Filler ' + i + '.').join('\n') + '\n\nEXT. B - NIGHT\n\nHo.';
    assert.deepEqual(Outline.of(short).items.map((i) => i.page), [1, 2], 'Letter: 54 rows');
    assert.deepEqual(Outline.of(short, { paper: 'a4' }).items.map((i) => i.page), [1, 1], 'A4: 58 rows');
    assert.equal(Outline.of('# Act One').items[0].page, null, 'sections do not print, so they have no page');
});

test('outline: where the caret is: the last scene or section at or above a line', () => {
    const o = Outline.of('Opening action.\n\n# Act One\n\nINT. A - DAY\n\nHi.\n\nEXT. B - NIGHT\n\nHo.');
    assert.equal(Outline.current(o.items, 0), -1, 'above the first item: nothing');
    assert.equal(Outline.current(o.items, 2), 0);
    assert.equal(Outline.current(o.items, 6), 1);
    assert.equal(Outline.current(o.items, 100), 2);
});

test('outline: scene headings in the print layout carry the source line they came from', () => {
    const l = Paginate.layout(Fountain.parse('Hi.\n\nINT. A - DAY\n\nHo.'));
    assert.equal(l.pages[0].lines.find((x) => x.kind === 'scene').source, 2);
});

test('outline: speed, for a feature-length script', () => {
    const text = Array.from({ length: 150 }, (_, i) => 'INT. ROOM ' + i + ' - DAY\n\nShe crosses to the window and looks out at the rain for a long while.\n\nMARA\nI have been here all week.').join('\n\n');
    const t0 = Date.now();
    const o = Outline.of(text);
    const ms = Date.now() - t0;
    assert.equal(o.items.length, 150);
    assert.ok(ms < 250, ms + ' ms');
});
