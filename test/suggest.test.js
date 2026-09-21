// Autocomplete suite (src/suggest.js). Expects globals: test, assert, Fountain, Editing, Suggest.

const SCRIPT = [
    'INT. COFFEE SHOP - DAY', '',
    'The cafe is empty.', '',
    'JOHN', 'Hello.', '',
    'MARY (V.O.)', 'Hi.', '',
    'JOHN (CONT\'D)', 'Again.', '',
    'EXT. COFFEE SHOP - NIGHT', '',
    'JOHN', 'Bye.', '',
    'MARY', 'Bye.', '',
    'INT. JOHN\'S CAR #12# ', '',
    'MARYLOU ^', 'Hey.', '', ''
].join('\n');

/** Type `line` on a new last line of `text`, the way the page sees it, and ask what to suggest. */
const typed = (text, line) => Suggest.at(text + line, (text + line).length);
const options = (text, line) => { const r = typed(text, line); return r ? r.options : null; };

// ---------- names ----------

test('names: character cues, most used first, extensions and ^ stripped', () => {
    assert.deepEqual(Suggest.names(SCRIPT), ['JOHN', 'MARY', 'MARYLOU']);
});

test('names: ties go to whoever spoke most recently', () => {
    assert.deepEqual(Suggest.names('AL\nx\n\nBO\nx\n\nAL\nx\n\nBO\nx'), ['BO', 'AL']);
});

test('names: an @-forced cue counts as its name, and a dual-dialogue ^ is not part of it', () => {
    assert.deepEqual(Suggest.names('\n@McCLANE\nYippee.\n\nHANS ^\nHm.'), ['HANS', 'McCLANE']);
});

test('names: an uppercase action line is not a name', () => {
    assert.deepEqual(Suggest.names('INT. A - DAY\n\nBANG!\n\nSILENCE\n\nJOHN\nHi.'), ['JOHN']);
});

test('names: the same name in different case is one name', () => {
    assert.deepEqual(Suggest.names('@Mary\nHi.\n\nMARY\nHi.'), ['MARY']);
});

test('names: an empty script has none', () => {
    assert.deepEqual(Suggest.names(''), []);
});

// ---------- locations ----------

test('locations: scene headings without INT./EXT., the scene number or the time of day', () => {
    assert.deepEqual(Suggest.locations(SCRIPT), ['COFFEE SHOP', 'JOHN\'S CAR']);
});

test('locations: a forced scene heading, INT./EXT. and sub-locations count', () => {
    assert.deepEqual(Suggest.locations('.THE VOID - DAY\n\nx\n\nINT./EXT. HOUSE - KITCHEN - NIGHT\n\nx\n\nI/E. HOUSE'), ['HOUSE', 'THE VOID']);
});

test('locations: most used first, then most recent', () => {
    assert.deepEqual(Suggest.locations('INT. A - DAY\n\nx\n\nINT. B - DAY\n\nx\n\nINT. B - NIGHT\n\nx\n\nINT. C - DAY'), ['B', 'C', 'A']);
});

// ---------- at: characters ----------

test('at: a strict prefix of a name offers the names that start with it', () => {
    assert.deepEqual(options(SCRIPT, 'JO'), ['JOHN']);
    assert.deepEqual(options(SCRIPT, 'MAR'), ['MARY', 'MARYLOU']);
    assert.deepEqual(options(SCRIPT, 'MARYL'), ['MARYLOU']);
});

test('at: it says where the typed word is and what it is, and the edit replaces exactly that', () => {
    const text = SCRIPT + 'JO';
    const hit = Suggest.at(text, text.length);
    assert.equal(hit.kind, 'character');
    assert.equal(text.slice(hit.from, hit.to), 'JO');
    const edit = Suggest.edit(hit, 'JOHN');
    assert.equal(text.slice(0, edit.from) + edit.insert + text.slice(edit.to), SCRIPT + 'JOHN');
    assert.equal(edit.selStart, (SCRIPT + 'JOHN').length);
    assert.equal(edit.selEnd, edit.selStart);
});

test('at: lower case is action until the editor capitalises it, so it is not offered names', () => {
    assert.equal(typed(SCRIPT, 'jo'), null);
});

test('at: nothing when the text already equals a name (Enter must never turn JOHN into JOHNNY)', () => {
    assert.equal(typed(SCRIPT + 'JOHNNY\nx\n\n', 'JOHN'), null);
    assert.equal(options('JOHNNY\nx\n\nJOHN\nx\n\n', 'JOHN'), null);
    assert.deepEqual(options('MARY JANE\nx\n\nMARY\nx\n\n', 'MARY '), ['MARY JANE']);
});

test('at: nothing on an empty line, and nothing for a name nobody has used', () => {
    assert.equal(typed(SCRIPT, ''), null);
    assert.equal(typed(SCRIPT, 'ZED'), null);
});

test('at: the line being typed is not its own source', () => {
    assert.equal(typed('The cafe.\n\n', 'JO'), null);
    // a cue being edited in the middle of a block, with its speech still below it
    const text = 'JOHN\nHi.\n\nJO\nHello.';
    const caret = text.indexOf('JO\nHello') + 2;
    assert.deepEqual(Suggest.at(text, caret).options, ['JOHN']);
    assert.equal(Suggest.at('JO\nHello.', 2), null);
});

test('at: only at the end of a line, and only for a cue', () => {
    assert.equal(Suggest.at(SCRIPT + 'JOH', SCRIPT.length + 2), null);              // caret inside the word
    assert.equal(typed(SCRIPT, 'JOHN\nSo, JO'), null);                              // dialogue
    assert.equal(typed(SCRIPT, 'The cafe. JO'), null);                              // action
    assert.equal(typed(SCRIPT, 'Joh'), null);                      // mixed case is action
    assert.equal(typed(SCRIPT.trimEnd(), '\nJO'), null);                   // no blank line above: not a cue
});

test('at: an @-forced cue keeps the @ and offers names as written', () => {
    const script = '@McCLANE\nYippee.\n\n';
    const hit = typed(script, '@Mc');
    assert.deepEqual(hit.options, ['McCLANE']);
    assert.equal((script + '@Mc').slice(hit.from, hit.to), 'Mc');
});

test('at: no more than four suggestions', () => {
    const many = ['AA', 'AB', 'AC', 'AD', 'AE', 'AF'].map((n) => n + '\nx\n').join('\n') + '\n';
    assert.equal(options(many, 'A').length, 4);
});

// ---------- at: scene headings ----------

test('at: after INT. or EXT., a prefix of a known location', () => {
    assert.deepEqual(options(SCRIPT, 'INT. COF'), ['COFFEE SHOP']);
    assert.deepEqual(options(SCRIPT, 'EXT. J'), ['JOHN\'S CAR']);
    const text = SCRIPT + 'INT. COF';
    const hit = Suggest.at(text, text.length);
    assert.equal(hit.kind, 'location');
    assert.equal(text.slice(hit.from, hit.to), 'COF');
});

test('at: locations work for a forced heading and INT./EXT.', () => {
    assert.deepEqual(options(SCRIPT, '.COF'), ['COFFEE SHOP']);
    assert.deepEqual(options(SCRIPT, 'INT./EXT. COF'), ['COFFEE SHOP']);
});

test('at: nothing yet after a bare "INT. " (Tab must keep cycling), nor once the location is done', () => {
    assert.equal(typed(SCRIPT, 'INT. '), null);
    assert.equal(typed(SCRIPT, 'INT. COFFEE SHOP'), null);
    assert.equal(typed(SCRIPT, 'INT. COFFEE SHOP - '), null);
    assert.equal(typed(SCRIPT, 'INT. COFFEE SHOP - D'), null);
    assert.equal(typed(SCRIPT, 'INT. COF #4#'), null);
});

test('at: a heading must follow a blank line, and the current heading is not its own source', () => {
    assert.equal(typed(SCRIPT.trimEnd(), '\nINT. COF'), null);
    assert.equal(typed('The cafe.\n\n', 'INT. COF'), null);
});

test('at: it costs a few milliseconds on a long script', () => {
    const scene = 'INT. PLACE - DAY\n\nSome action here for a while.\n\nJOHN\nWords, words.\n\nMARY\n(quietly)\nMore words.\n\n';
    const long = scene.repeat(2500) + 'JO'; // about 30,000 lines
    const start = Date.now();
    for (let i = 0; i < 5; i++) assert.deepEqual(Suggest.at(long, long.length).options, ['JOHN']);
    const each = (Date.now() - start) / 5;
    assert.ok(each < 100, 'each lookup took ' + each + 'ms');
});
