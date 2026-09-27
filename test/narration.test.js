// Narration timing and YouTube chapters (src/narration.js, P4-18, P3-13). Expects globals: test, assert, Narration.

const nWords = (n, word) => Array(n).fill(word || 'word').join(' ');

test('narration: dialogue is read aloud; headings, cues, parentheticals, transitions and notes are not', () => {
    const text = 'INT. OLD HOUSE - NIGHT\n\nThe door creaks open.\n\nNARRATOR\n(softly)\nFive words [[not these]] read *aloud* here.\n\nCUT TO:\n\n/* nor these words */';
    const n = Narration.of(text);
    assert.equal(n.words, 5);
    assert.equal(n.seconds, 2, 'five words at 150 a minute');
});

test('narration: lyrics are read aloud too, and both sides of dual dialogue count', () => {
    assert.equal(Narration.of('~La la la la\n\nBOB\nOne two.\n\nALICE ^\nThree.').words, 7);
});

test('narration: "all" also reads the action and centred text, never the headings', () => {
    const text = 'EXT. MOON - DAY\n\nDust drifts across the crater.\n\n> THE END <\n\nNARRATOR\nHello.';
    assert.equal(Narration.of(text).words, 1, 'dialogue only by default');
    assert.equal(Narration.of(text, { aloud: 'all' }).words, 8);
});

test('narration: the pace is words a minute, 150 unless set', () => {
    const text = 'NARRATOR\n' + nWords(300);
    assert.equal(Narration.of(text).seconds, 120);
    assert.equal(Narration.of(text, { pace: 200 }).seconds, 90);
    assert.equal(Narration.of(text, { pace: 0 }).seconds, 120, 'no pace: the default');
    assert.equal(Narration.of(text, { pace: -60 }).seconds, 120, 'a nonsense pace: the default');
    assert.equal(Narration.PACE, 150);
});

test('narration: chapters are the top-level sections, each starting at the words read before it', () => {
    const text = '# One\n\nNARRATOR\n' + nWords(150) + '\n\n# Two\n\n## A part of two\n\nNARRATOR\n' + nWords(75) + '\n\n# Three\n\nNARRATOR\n' + nWords(50);
    const n = Narration.of(text);
    assert.deepEqual(n.chapters.map((c) => [c.title, c.start, c.seconds]), [['One', 0, 60], ['Two', 60, 30], ['Three', 90, 20]]);
    assert.deepEqual(n.chapters.map((c) => c.line), [0, 5, 12], 'the section lines, to go to');
    assert.deepEqual(n.short, []);
    assert.equal(n.few, false);
});

test('narration: with no # sections, ## sections are the chapters', () => {
    const text = '## Alpha\n\nNARRATOR\nWords here.\n\n### Inside alpha\n\n## Beta\n\nNARRATOR\nMore.';
    assert.deepEqual(Narration.of(text).chapters.map((c) => c.title), ['Alpha', 'Beta']);
});

test('narration: words before the first section become an Intro at 0:00', () => {
    const text = 'Title: Moon\n\n# Cold open is not here\n\nNARRATOR\n' + nWords(25);
    assert.deepEqual(Narration.of(text).chapters.map((c) => c.title), ['Cold open is not here'], 'no words before it');
    const intro = Narration.of('NARRATOR\n' + nWords(25) + '\n\n# Part one\n\nNARRATOR\n' + nWords(25));
    assert.deepEqual(intro.chapters.map((c) => [c.title, c.start, c.line]), [['Intro', 0, 0], ['Part one', 10, 3]]);
});

test('narration: a section title is plain text, and an empty one is numbered', () => {
    const titles = Narration.of('# The *big* [[note]] reveal\n\nNARRATOR\nHi.\n\n#\n\nNARRATOR\nBye.').chapters.map((c) => c.title);
    assert.equal(titles[0], 'The big reveal');
    assert.equal(titles[1], 'Chapter 2');
});

test('narration: YouTube\'s rules are checked, never enforced: at least three chapters, ten seconds each', () => {
    const text = '# One\n\nNARRATOR\n' + nWords(25) + '\n\n# Two\n\nNARRATOR\n' + nWords(24) + '\n\n# Three\n\n# Four\n\nNARRATOR\n' + nWords(25);
    const n = Narration.of(text);
    assert.deepEqual(n.chapters.map((c) => c.seconds), [10, 10, 0, 10], '24 words round to ten seconds');
    assert.deepEqual(n.short, [2], 'a chapter with nothing read is too short');
    assert.equal(n.few, false);
    assert.equal(Narration.of('# One\n\nNARRATOR\nHi.\n\n# Two\n\nNARRATOR\nBye.').few, true);
    assert.equal(Narration.of('NARRATOR\nNo sections.').chapters.length, 0);
});

test('narration: the clock writes timestamps the way YouTube reads them', () => {
    assert.equal(Narration.clock(0), '0:00');
    assert.equal(Narration.clock(65), '1:05');
    assert.equal(Narration.clock(600), '10:00');
    assert.equal(Narration.clock(3723), '1:02:03');
    assert.equal(Narration.clock(3600 + 59.6), '1:01:00');
});

test('narration: the chapter list is one timestamp and title a line', () => {
    const list = Narration.chapterList([{ title: 'Intro', start: 0 }, { title: 'The alien ship', start: 75 }]);
    assert.equal(list, '0:00 Intro\n1:15 The alien ship');
});
