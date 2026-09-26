// Script stats suite (src/stats.js, P4-04, P4-13). Expects globals: test, assert, Fountain, Paginate, Library, Stats, Outline.

const stFill = (n) => Array.from({ length: n }, (_, i) => 'Filler ' + i + '.').join('\n');
const stNames = (s) => s.characters.map((c) => c.name);

test('stats: an empty script has nothing to count', () => {
    ['', '   \n\n'].forEach((text) => {
        const s = Stats.of(text);
        assert.deepEqual([s.pages, s.minutes, s.scenes, s.words, s.characters.length], [0, 0, 0, 0, 0], JSON.stringify(text));
    });
});

test('stats: pages are the printed pages (the title page not counted), on the paper asked for', () => {
    const text = 'Title: X\n\n' + stFill(54 + 30);
    assert.equal(Stats.of(text).pages, 2);
    assert.equal(Stats.of(text).pages, Paginate.layout(Fountain.parse(text)).pages.length);
    assert.equal(Stats.of(stFill(56)).pages, 2, 'Letter holds 54 rows');
    assert.equal(Stats.of(stFill(56), { paper: 'a4' }).pages, 1, 'A4 holds 58');
});

test('stats: screen time is about a minute a page, counting how full the last page is', () => {
    assert.equal(Stats.of(stFill(54 + 27)).minutes, 2, 'one and a half pages rounds up to 2');
    assert.equal(Stats.of(stFill(54 + 5)).minutes, 1, 'a page and a few lines is still about a minute');
    assert.equal(Stats.of('A few words.').minutes, 1, 'anything at all is at least a minute');
});

test('stats: duration reads the way people say it', () => {
    assert.equal(Stats.duration(0), 'no screen time yet');
    assert.equal(Stats.duration(1), 'about 1 min');
    assert.equal(Stats.duration(47), 'about 47 min');
    assert.equal(Stats.duration(60), 'about 1 h');
    assert.equal(Stats.duration(112), 'about 1 h 52 min');
});

test('stats: scenes are the scene headings; words match the Library\'s count exactly', () => {
    const text = 'Title: Big Fish\n\nINT. A - DAY\n\nHe waits. [[a note]]\n\nEXT. B - NIGHT\n\n.MONTAGE\n\nJOHN\nHi there.';
    const s = Stats.of(text);
    assert.equal(s.scenes, 3);
    assert.equal(s.words, Library.wordCount(text));
});

test('stats: each character is counted once, whatever extension their cue carries', () => {
    const text = [
        'JOHN', 'One two three.', '',
        'JOHN (V.O.)', 'Four five.', '',
        'JOHN (CONT\'D)', 'Six.', '',
        '@McCLANE', 'Yippee ki yay.', '',
        'MCCLANE (O.S.)', 'Again.'
    ].join('\n');
    const s = Stats.of(text);
    assert.deepEqual(stNames(s), ['JOHN', 'McCLANE'], 'the first spelling seen is the one shown');
    assert.deepEqual([s.characters[0].speeches, s.characters[0].words], [3, 6]);
    assert.deepEqual([s.characters[1].speeches, s.characters[1].words], [2, 4]);
});

test('stats: dialogue words leave out parentheticals and notes; both sides of dual dialogue count', () => {
    const text = 'BRICK\n(shouting)\nScrew you! [[loud]]\n\nSTEEL ^\nScrew you more!';
    const s = Stats.of(text);
    const by = (n) => s.characters.find((c) => c.name === n);
    assert.equal(by('BRICK').words, 2);
    assert.equal(by('STEEL').words, 3);
    assert.equal(by('STEEL').speeches, 1);
});

test('stats: characters are listed by how much they say, with their share of all dialogue', () => {
    const text = 'ANN\nOne.\n\nBOB\nOne two three.\n\nCAL\nOne two three.\n\nCAL\nFour.';
    const s = Stats.of(text);
    assert.deepEqual(stNames(s), ['CAL', 'BOB', 'ANN']);
    assert.deepEqual(s.characters.map((c) => c.share), [50, 38, 13]);
});

test('stats: a length in eighths of a page reads the way schedules write it', () => {
    assert.deepEqual([1, 5, 8, 11, 16, 23].map(Stats.eighths), ['1/8', '5/8', '1', '1 3/8', '2', '2 7/8']);
});

test('stats: each scene runs from its heading to the next, in eighths of a printed page, on the paper asked for', () => {
    // 47 rows: the heading, a blank, 44 lines of action, a blank. 47/54 of a Letter page is 6.96 eighths, of A4 6.48.
    const text = 'INT. A - DAY\n\n' + stFill(44) + '\n\nINT. B - NIGHT\n\nShort.\n\nEXT. C - DAY\n\nEnd.';
    const letter = Stats.of(text).sceneList, a4 = Stats.of(text, { paper: 'a4' }).sceneList;
    assert.deepEqual(letter.map((sc) => sc.text), ['INT. A - DAY', 'INT. B - NIGHT', 'EXT. C - DAY']);
    assert.equal(letter[0].eighths, 7);
    assert.equal(a4[0].eighths, 6);
    assert.deepEqual([letter[1].eighths, letter[2].eighths], [1, 1], 'a scene of a line or two is still 1/8');
});

test('stats: a scene across a page break counts the rows on both pages; the lengths add up to the script', () => {
    const text = 'Title: X\n\nFADE IN:\n\nINT. A - DAY\n\n' + stFill(30) + '\n\nINT. B - DAY\n\n' + stFill(60) + '\n\nINT. C - DAY\n\n' + stFill(20);
    const s = Stats.of(text);
    assert.deepEqual(s.sceneList.map((sc) => sc.page), [1, 1, 2]);
    assert.ok(s.sceneList[1].eighths >= 9 && s.sceneList[1].eighths <= 10, s.sceneList[1].eighths);
    const pages = Paginate.layout(Fountain.parse(text)).pages, last = pages[pages.length - 1].lines;
    const rows = (pages.length - 1) * 54 + last[last.length - 1].row + 1 - 2; // every printed row but FADE IN: and its blank
    const total = s.sceneList.reduce((n, sc) => n + sc.eighths, 0);
    assert.ok(Math.abs(total - rows / 54 * 8) <= 1.5, total + ' eighths for ' + rows + ' rows');
    const outline = Outline.of(text).items.filter((i) => i.kind === 'scene');
    assert.deepEqual(s.sceneList.map((sc) => sc.page), outline.map((i) => i.page), 'the same pages as the Outline');
    assert.deepEqual(s.sceneList.map((sc) => sc.line), outline.map((i) => i.line));
});

test('stats: a scene heading reads as it prints: capitals, no notes, the scene number kept apart', () => {
    const sc = Stats.of('int. kitchen - day [[check]] #12#\n\nShe cooks.').sceneList[0];
    assert.deepEqual([sc.text, sc.number], ['INT. KITCHEN - DAY', '12']);
    assert.equal(Stats.of('.MONTAGE\n\nThings happen.').sceneList[0].text, 'MONTAGE');
    assert.deepEqual(Stats.of('No scenes here.').sceneList, []);
});

test('stats: a scene\'s characters are the ones who speak in it, in the order they first do, one name each', () => {
    const text = [
        'NARRATOR', 'Before any scene.', '',
        'INT. A - DAY', '',
        'Mara enters.', '',
        '@McCLANE', 'Hi.', '',
        'MARA (V.O.)', 'Hello.', '',
        'MCCLANE (CONT\'D)', 'Again.', '',
        'EXT. B - NIGHT', '',
        'BRICK', 'Left.', '',
        'STEEL ^', 'Right.', '',
        'EXT. C - NIGHT', '',
        'Silence.'
    ].join('\n');
    const list = Stats.of(text).sceneList;
    assert.deepEqual(list.map((sc) => sc.characters), [['McCLANE', 'MARA'], ['BRICK', 'STEEL'], []]);
});

test('stats: speed, so the live page count can follow typing on a feature-length script', () => {
    const scene = 'INT. ROOM - DAY\n\nShe crosses to the window and looks out at the rain.\n\nMARA\nI have been here all week, and nothing has changed at all.\n\n';
    const text = scene.repeat(700);
    const t0 = Date.now();
    const s = Stats.of(text);
    const ms = Date.now() - t0;
    assert.ok(s.pages >= 100, s.pages + ' pages');
    assert.ok(ms < 250, s.pages + ' pages took ' + ms + ' ms');
});
