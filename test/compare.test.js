// Comparing versions scene by scene (src/compare.js, P4-16). Expects globals: test, assert, Compare.

const CMP_WAS = 'Title: Moon\n\nINT. KITCHEN - NIGHT\n\nMara waits.\n\nMARA\nHello?\n\nEXT. ROOF - DAY\n\nWind.\n\nINT. HALL - DAY\n\nSteps.\n';
const cmpStatus = (items) => items.map((x) => x.status[0] + (x.heading ? ':' + x.heading : ''));

test('compare: a script is its opening, then a part per scene; joined, the parts are the text exactly', () => {
    const p = Compare.parts(CMP_WAS);
    assert.deepEqual(p.map((x) => x.heading), [null, 'INT. KITCHEN - NIGHT', 'EXT. ROOF - DAY', 'INT. HALL - DAY']);
    assert.equal(p.map((x) => x.text).join(''), CMP_WAS);
    assert.equal(p[1].text, 'INT. KITCHEN - NIGHT\n\nMara waits.\n\nMARA\nHello?\n\n');
    assert.deepEqual(p.map((x) => [x.start, x.end]).map(([s, e]) => CMP_WAS.slice(s, e)), p.map((x) => x.text));
    assert.deepEqual(Compare.parts('').map((x) => x.text), ['']);
    assert.deepEqual(Compare.parts('No scenes, just words.').map((x) => x.heading), [null]);
    assert.equal(Compare.parts('int. lab - day\n\nx')[1].key, 'INT. LAB - DAY', 'case does not count');
    assert.equal(Compare.parts('INT. LAB - DAY #12#\n\nx')[1].key, 'INT. LAB - DAY', 'the scene number does not count');
});

test('compare: the same text is the same throughout; trailing blank lines do not count', () => {
    assert.deepEqual(cmpStatus(Compare.of(CMP_WAS, CMP_WAS)), ['s', 's:INT. KITCHEN - NIGHT', 's:EXT. ROOF - DAY', 's:INT. HALL - DAY']);
    assert.ok(Compare.of(CMP_WAS, CMP_WAS + '\n\n\n').every((x) => x.status === 'same'));
});

test('compare: a scene changed, one removed, one added, in reading order', () => {
    const now = 'Title: Moon\n\nINT. KITCHEN - NIGHT\n\nMara waits, tapping.\n\nMARA\nHello?\n\nINT. HALL - DAY\n\nSteps.\n\nEXT. GARDEN - DAWN\n\nBirds.\n';
    const items = Compare.of(CMP_WAS, now);
    assert.deepEqual(cmpStatus(items), ['s', 'c:INT. KITCHEN - NIGHT', 'r:EXT. ROOF - DAY', 's:INT. HALL - DAY', 'a:EXT. GARDEN - DAWN']);
    assert.deepEqual(items[1].lines.filter((l) => l.op !== ' '), [{ op: '-', text: 'Mara waits.' }, { op: '+', text: 'Mara waits, tapping.' }]);
    assert.equal(items[2].now, null);
    assert.equal(items[4].was, null);
    assert.equal(items[0].lines, null, 'no line difference for a part that is the same');
});

test('compare: an edited heading in the same place is a changed scene; a heading used twice pairs up in order', () => {
    const edited = CMP_WAS.replace('EXT. ROOF - DAY', 'EXT. ROOF - NIGHT');
    assert.deepEqual(cmpStatus(Compare.of(CMP_WAS, edited)), ['s', 's:INT. KITCHEN - NIGHT', 'c:EXT. ROOF - NIGHT', 's:INT. HALL - DAY']);
    const twice = 'INT. ROOM - DAY\n\nOne.\n\nEXT. ST - DAY\n\nTwo.\n\nINT. ROOM - DAY\n\nThree.\n';
    const moreTwice = 'INT. ROOM - DAY\n\nOne.\n\nEXT. ST - DAY\n\nTwo.\n\nINT. ROOM - DAY\n\nThree, again.\n';
    assert.deepEqual(cmpStatus(Compare.of(twice, moreTwice)), ['s', 's:INT. ROOM - DAY', 's:EXT. ST - DAY', 'c:INT. ROOM - DAY']);
    assert.deepEqual(cmpStatus(Compare.of('', 'INT. A - DAY\n\nx')), ['s', 'a:INT. A - DAY']);
});

test('compare: the line difference marks what went and what came, the rest as context', () => {
    assert.deepEqual(Compare.lines('a\nb\nc\n\n', 'a\nx\nc'), [
        { op: ' ', text: 'a' }, { op: '-', text: 'b' }, { op: '+', text: 'x' }, { op: ' ', text: 'c' }]);
    assert.deepEqual(Compare.lines('a', 'a\nb'), [{ op: ' ', text: 'a' }, { op: '+', text: 'b' }]);
    assert.deepEqual(Compare.lines('a\nb', 'b'), [{ op: '-', text: 'a' }, { op: ' ', text: 'b' }]);
    // too long to compare line by line: the ends that match, and the middle as replaced
    const big = Array.from({ length: 600 }, (_, i) => 'line ' + i);
    const bigger = big.slice(); bigger[300] = 'changed';
    const d = Compare.lines(big.join('\n'), bigger.join('\n'));
    assert.deepEqual(d.filter((l) => l.op !== ' '), [{ op: '-', text: 'line 300' }, { op: '+', text: 'changed' }]);
    assert.equal(d.length, 601);
    const twoApart = big.slice(); twoApart[100] = 'early'; twoApart[500] = 'late';
    const ends = Compare.lines(big.join('\n'), twoApart.join('\n'));
    assert.equal(ends.filter((l) => l.op === '-').length, 401, 'past the limit, everything between the first and last change counts as replaced');
});

test('compare: taking a changed scene replaces it, keeping the blank lines around it', () => {
    const now = CMP_WAS.replace('Wind.', 'Wind howls.').replace('Mara waits.', 'Mara paces.');
    const items = Compare.of(CMP_WAS, now);
    const back = Compare.take(now, items, 2);
    assert.equal(back, CMP_WAS.replace('Mara waits.', 'Mara paces.'), 'only the roof scene went back');
    assert.equal(Compare.take(back, Compare.of(CMP_WAS, back), 1), CMP_WAS);
    // the last scene of the version into the middle of the text now: it still gets its blank line
    const moved = 'INT. HALL - DAY\n\nSteps.\n\nEXT. ROOF - DAY\n\nWind.\n';
    const was2 = 'INT. HALL - DAY\n\nFootsteps.';
    assert.equal(Compare.take(moved, Compare.of(was2, moved), 1), 'INT. HALL - DAY\n\nFootsteps.\n\nEXT. ROOF - DAY\n\nWind.\n');
});

test('compare: a removed scene is put back where it was, before the next scene still there, or at the end', () => {
    const now = CMP_WAS.replace('EXT. ROOF - DAY\n\nWind.\n\n', '');
    const items = Compare.of(CMP_WAS, now);
    assert.equal(Compare.take(now, items, items.findIndex((x) => x.status === 'removed')), CMP_WAS);
    const noEnd = CMP_WAS.replace('\nINT. HALL - DAY\n\nSteps.\n', '');
    const items2 = Compare.of(CMP_WAS, noEnd);
    const emptyNow = Compare.of('INT. A - DAY\n\nx', '');
    assert.equal(Compare.take('', emptyNow, 1), 'INT. A - DAY\n\nx\n', 'into an empty script, with no blank lines before it');
    assert.equal(Compare.take(noEnd, items2, 3), 'Title: Moon\n\nINT. KITCHEN - NIGHT\n\nMara waits.\n\nMARA\nHello?\n\nEXT. ROOF - DAY\n\nWind.\n\nINT. HALL - DAY\n\nSteps.\n');
});

test('compare: the opening too (a title page taken back), and nothing to take changes nothing', () => {
    const now = CMP_WAS.replace('Title: Moon\n\n', '');
    const items = Compare.of(CMP_WAS, now);
    assert.equal(items[0].status, 'changed');
    assert.equal(Compare.take(now, items, 0), CMP_WAS);
    const titled = CMP_WAS.replace('Title: Moon', 'Title: Sun');
    assert.equal(Compare.take(titled, Compare.of(CMP_WAS, titled), 0), CMP_WAS);
    const noOpening = Compare.of(now, CMP_WAS); // the version had no title page: taking its opening removes it
    assert.equal(Compare.take(CMP_WAS, noOpening, 0), now);
    assert.equal(Compare.take(CMP_WAS, Compare.of(CMP_WAS, CMP_WAS), 1), CMP_WAS, 'the same');
    const added = Compare.of('', 'INT. A - DAY\n\nx');
    assert.equal(Compare.take('INT. A - DAY\n\nx', added, 1), 'INT. A - DAY\n\nx', 'an added scene is not in the version: nothing to take');
    assert.equal(Compare.take('x', [], 5), 'x');
});

test('compare: around a change, the unchanged lines further away fold into a count', () => {
    const same = (t) => ({ op: ' ', text: t });
    const list = ['a', 'b', 'c', 'd', 'e'].map(same).concat([{ op: '-', text: 'x' }, { op: '+', text: 'y' }], ['f', 'g', 'h', 'i'].map(same));
    assert.deepEqual(Compare.around(list, 2).map((l) => l.op === '…' ? '…' + l.count : l.op + l.text),
        ['…3', ' d', ' e', '-x', '+y', ' f', ' g', '…2']);
    assert.deepEqual(Compare.around(list, 10), list, 'all near: nothing folded');
    assert.deepEqual(Compare.around([same('a'), same('b')], 2), [{ op: '…', count: 2 }], 'no change at all');
    const two = [{ op: '-', text: '1' }].concat(['a', 'b', 'c', 'd', 'e', 'f'].map(same), [{ op: '+', text: '2' }]);
    assert.deepEqual(Compare.around(two, 2).map((l) => l.op === '…' ? '…' + l.count : l.op + l.text), ['-1', ' a', ' b', '…2', ' e', ' f', '+2']);
});
