// Fountain parser suite. Expects globals: test, assert, Fountain (provided by test/index.html or test/run.js).

const parse = (t) => Fountain.parse(t);
const types = (t) => parse(t).map((x) => x.type);
const first = (t) => parse(t)[0];
const html = (t) => Fountain.toHTML(parse(t));

// ---------- scene headings ----------

test('scene heading: INT. / EXT. / EST. / INT./EXT. / I/E', () => {
    ['INT. HOUSE - DAY', 'EXT. STREET - NIGHT', 'EST. SKYLINE', 'INT./EXT. CAR - MOVING', 'INT/EXT CAR', 'I/E CAR']
        .forEach((h) => assert.equal(first(h).type, 'scene', h));
});

test('scene heading: case-insensitive prefix, followed by dot or space', () => {
    assert.equal(first('int. kitchen - day').type, 'scene');
    assert.equal(first('EXT BEACH - DAY').type, 'scene');
});

test('scene heading: words that merely start with INT/EXT are not headings', () => {
    assert.equal(first('INTERNAL AFFAIRS').type, 'action');
    assert.equal(first('EXTRA LARGE').type, 'action');
});

test('scene heading: needs a blank line before it', () => {
    const t = parse('He walks in.\nINT. HOUSE - DAY');
    assert.deepEqual(t.map((x) => x.type), ['action']);
    assert.includes(t[0].text, 'INT. HOUSE - DAY');
});

test('scene heading: forced with leading dot, but ellipsis is not forced', () => {
    const s = first('.SNIPER SCOPE POV');
    assert.equal(s.type, 'scene');
    assert.equal(s.text, 'SNIPER SCOPE POV');
    assert.equal(first('...and then it ended').type, 'action');
});

test('scene heading: scene number is split out', () => {
    const s = first('INT. HOUSE - DAY #12A#');
    assert.equal(s.text, 'INT. HOUSE - DAY');
    assert.equal(s.number, '12A');
});

// ---------- action ----------

test('action: consecutive lines form one paragraph, blank line splits', () => {
    const t = parse('He runs.\nHe falls.\n\nShe screams.');
    assert.deepEqual(t.map((x) => x.type), ['action', 'action']);
    assert.equal(t[0].text, 'He runs.\nHe falls.');
});

test('action: forced with !', () => {
    const t = parse('!JOHN\nis not a character');
    assert.equal(t[0].type, 'action');
    assert.equal(t[0].text, 'JOHN\nis not a character');
});

test('action: multiple blank lines collapse (no spacer tokens)', () => {
    assert.deepEqual(types('One.\n\n\n\nTwo.'), ['action', 'action']);
});

test('action: FADE IN: stays flush-left action', () => {
    assert.equal(first('FADE IN:').type, 'action');
});

// ---------- characters and dialogue ----------

test('dialogue: cue, parenthetical and speech are one block', () => {
    const d = first('JOHN\n(nervous)\nI just wanted to type.');
    assert.equal(d.type, 'dialogue');
    assert.equal(d.character, 'JOHN');
    assert.deepEqual(d.lines.map((l) => ({ type: l.type, text: l.text })), [
        { type: 'parenthetical', text: '(nervous)' },
        { type: 'dialogue', text: 'I just wanted to type.' }
    ]);
    assert.deepEqual(d.lines.map((l) => l.line), [1, 2]); // source line numbers, for the editor
});

test('dialogue: block ends at a blank line; the next line is not dialogue', () => {
    const t = parse('JOHN\nHello.\n\nHe leaves.');
    assert.deepEqual(t.map((x) => x.type), ['dialogue', 'action']);
});

test('dialogue: multi-line speech and a mid-speech parenthetical', () => {
    const d = first('MARY\nFirst line.\n(beat)\nSecond line.');
    assert.deepEqual(d.lines.map((l) => l.type), ['dialogue', 'parenthetical', 'dialogue']);
});

test('dialogue: two spaces on an empty line keep the block open', () => {
    const t = parse('JOHN\nFirst paragraph.\n  \nSecond paragraph.');
    assert.equal(t.length, 1);
    assert.equal(t[0].lines.length, 2);
});

test('character: extensions may be lowercase', () => {
    assert.equal(first("JOHN (cont'd)\nHi.").type, 'dialogue');
    assert.equal(first('JOHN (V.O.)\nHi.').character, 'JOHN (V.O.)');
});

test('character: all-caps line with nothing after it is action', () => {
    assert.equal(first('THE END').type, 'action');
});

test('character: lowercase name is not a cue', () => {
    assert.equal(first('john\nHello.').type, 'action');
});

test('character: forced with @ allows lowercase names', () => {
    const d = first('@McCLANE\nYippee.');
    assert.equal(d.type, 'dialogue');
    assert.equal(d.character, 'McCLANE');
});

test('character: needs a blank line before it', () => {
    const t = parse('He turns.\nJOHN\nHello.');
    assert.deepEqual(t.map((x) => x.type), ['action']);
});

test('character: digits and punctuation in names are fine', () => {
    assert.equal(first('R2-D2\nBeep.').type, 'dialogue');
    assert.equal(first('MR. SMITH\nHello.').type, 'dialogue');
});

test('dual dialogue: ^ pairs the block with the one before it', () => {
    const t = parse('BRICK\nScrew you!\n\nSTEEL ^\nScrew you!');
    assert.equal(t.length, 2);
    assert.equal(t[0].dual, 'left');
    assert.equal(t[1].dual, 'right');
    assert.equal(t[1].character, 'STEEL');
    assert.includes(Fountain.toHTML(t), 'script-dual');
});

test('dual dialogue: unpaired ^ renders as a normal block', () => {
    const t = parse('An action.\n\nSTEEL ^\nHello.');
    assert.equal(t[1].dual, false);
    assert.excludes(Fountain.toHTML(t), 'script-dual');
});

// ---------- transitions ----------

test('transition: uppercase line ending in TO:', () => {
    const t = parse('He leaves.\n\nCUT TO:\n\nINT. HOUSE - DAY');
    assert.deepEqual(t.map((x) => x.type), ['action', 'transition', 'scene']);
});

test('transition: common transitions work without a > prefix', () => {
    ['FADE OUT.', 'SMASH CUT:', 'DISSOLVE TO:', 'FADE TO BLACK.'].forEach((s) =>
        assert.equal(parse('Text.\n\n' + s + '\n\nMore.')[1].type, 'transition', s));
});

test('transition: forced with >', () => {
    const tr = parse('Text.\n\n> Burn to white.\n\nMore.')[1];
    assert.equal(tr.type, 'transition');
    assert.equal(tr.text, 'Burn to white.');
});

test('transition: lowercase "cut to:" is action (spec-strict, D-004)', () => {
    assert.equal(parse('Text.\n\ncut to:\n\nMore.')[1].type, 'action');
});

test('transition: needs a blank line after it', () => {
    assert.equal(parse('Text.\n\nCUT TO:\nMore.')[1].type, 'action');
});

// ---------- other elements ----------

test('centered text', () => {
    const c = first('> THE END <');
    assert.equal(c.type, 'centered');
    assert.equal(c.text, 'THE END');
});

test('lyrics', () => {
    const l = first('~Willy Wonka! Willy Wonka!');
    assert.equal(l.type, 'lyrics');
    assert.equal(l.text, 'Willy Wonka! Willy Wonka!');
});

test('section and synopsis', () => {
    const t = parse('## Act Two\n\n= Hero loses everything.');
    assert.equal(t[0].type, 'section');
    assert.equal(t[0].depth, 2);
    assert.equal(t[0].text, 'Act Two');
    assert.equal(t[1].type, 'synopsis');
    assert.equal(t[1].text, 'Hero loses everything.');
});

test('page break', () => {
    assert.deepEqual(types('One.\n\n===\n\nTwo.'), ['action', 'page_break', 'action']);
});

test('boneyard: closed comments are removed, line numbers stay valid', () => {
    const t = parse('One.\n\n/* hidden\nblock */\n\nTwo.');
    assert.deepEqual(t.map((x) => x.type), ['action', 'action']);
    assert.equal(t[1].line, 5);
});

test('boneyard: unclosed /* stays literal so typing it does not swallow the script', () => {
    const t = parse('One.\n\n/* still typing\n\nTwo.');
    assert.equal(t.length, 3);
});

test('notes render inline in a note span', () => {
    assert.includes(html('He waits. [[fix this]]'), '<span class="script-note">[[fix this]]</span>');
});

// ---------- title page ----------

test('title page: known keys at the top, with multi-line values', () => {
    const t = parse('Title: BIG FISH\nCredit: Written by\nAuthor: John August\nContact:\n    123 Main St\n    LA\n\nFADE IN:');
    assert.equal(t[0].type, 'title_page');
    assert.equal(t[0].fields.length, 4);
    assert.equal(t[0].fields[3].value, '123 Main St\nLA');
    assert.equal(t[1].type, 'action');
});

test('title page: unknown key on line one is not a title page', () => {
    assert.equal(first('Random: thing').type, 'action');
});

test('title page: only recognised at the very start', () => {
    assert.equal(types('Hello.\n\nTitle: Late')[1], 'action');
});

test('extractTitle: prefers Title, falls back to first line, then Untitled', () => {
    assert.equal(Fountain.extractTitle('Title: _Big Fish_\nAuthor: X'), 'Big Fish');
    assert.equal(Fountain.extractTitle('\n\nINT. HOUSE - DAY\nHi'), 'INT. HOUSE - DAY');
    assert.equal(Fountain.extractTitle('  \n '), 'Untitled Script');
});

// ---------- emphasis ----------

test('emphasis: bold, italic, bold-italic, underline', () => {
    assert.includes(Fountain.inline('a **b** c'), '<strong>b</strong>');
    assert.includes(Fountain.inline('a *b* c'), '<em>b</em>');
    assert.includes(Fountain.inline('a ***b*** c'), '<strong><em>b</em></strong>');
    assert.includes(Fountain.inline('a _b_ c'), 'a <u>b</u> c');
});

test('emphasis: backslash escapes and snake_case are left literal', () => {
    assert.equal(Fountain.inline('2 \\* 3 \\* 4'), '2 * 3 * 4');
    assert.equal(Fountain.inline('snake_case_name'), 'snake_case_name');
});

test('emphasis: lone asterisks with spaces are not italics', () => {
    assert.equal(Fountain.inline('5 * 6 * 7'), '5 * 6 * 7');
});

// ---------- rendering and safety ----------

test('render: user text is HTML-escaped everywhere', () => {
    const out = html('<script>alert(1)</script>\n\nJOHN <b>\n<img src=x onerror=alert(1)>');
    assert.excludes(out, '<script>');
    assert.excludes(out, '<img');
    assert.excludes(out, '<b>');
    assert.includes(out, '&lt;script&gt;');
});

test('render: elements carry data-line anchors for scroll sync', () => {
    const out = html('One.\n\nINT. HOUSE - DAY');
    assert.includes(out, 'data-line="0"');
    assert.includes(out, 'data-line="2"');
});

test('render: the prototype placeholder script parses into the expected structure', () => {
    const script = [
        'FADE IN:', '', 'INT. COFFEE SHOP - DAY', '', 'The cafe is entirely empty.', '',
        'JOHN', '(nervous)', 'I just wanted a program that let me type without thinking.', '',
        'THE ARTISAN', 'It is done.', '', 'CUT TO:', '', 'EXT. THE VOID - CONTINUOUS'
    ].join('\n');
    assert.deepEqual(types(script),
        ['action', 'scene', 'action', 'dialogue', 'dialogue', 'transition', 'scene']);
});

test('robustness: empty, whitespace, CRLF and undefined input', () => {
    assert.deepEqual(parse(''), []);
    assert.deepEqual(parse('   \n\n  '), []);
    assert.deepEqual(parse(undefined), []);
    assert.deepEqual(types('JOHN\r\nHi.\r\n\r\nHe leaves.'), ['dialogue', 'action']);
});

// ---------- setTitle / fullTitle (Library rename writes the title into the script's own text) ----------

test('setTitle: a script with no title page gets one, leading blank lines dropped, body untouched', () => {
    assert.equal(Fountain.setTitle('INT. A - DAY\nHi.', 'X'), 'Title: X\n\nINT. A - DAY\nHi.');
    assert.equal(Fountain.setTitle('\n\nFADE IN:', 'X'), 'Title: X\n\nFADE IN:');
    assert.equal(Fountain.setTitle('', 'X'), 'Title: X\n\n');
});

test('setTitle: an existing Title: line is replaced in place, other keys untouched', () => {
    assert.equal(Fountain.setTitle('Title: Old\nAuthor: Me\n\nFADE IN:', 'New'), 'Title: New\nAuthor: Me\n\nFADE IN:');
    assert.equal(Fountain.setTitle('Author: Me\nTitle: Old\nDate: 1\n\nText', 'New'), 'Author: Me\nTitle: New\nDate: 1\n\nText');
    assert.equal(Fountain.setTitle('title: old\n\nText', 'New'), 'Title: New\n\nText');
});

test('setTitle: a multi-line Title value is replaced whole', () => {
    assert.equal(Fountain.setTitle('Title:\n    Big\n    Fish\nAuthor: Me\n\nText', 'New'), 'Title: New\nAuthor: Me\n\nText');
});

test('setTitle: a title page with no Title gets one as its first line', () => {
    assert.equal(Fountain.setTitle('Author: Me\n\nText', 'New'), 'Title: New\nAuthor: Me\n\nText');
});

test('setTitle: only the title page is touched, not a "Title:" later in the body', () => {
    assert.equal(Fountain.setTitle('Hello.\n\nTitle: not me', 'X'), 'Title: X\n\nHello.\n\nTitle: not me');
});

test('setTitle: newlines become spaces, and setting it twice is the same as once', () => {
    assert.equal(Fountain.setTitle('Text', 'Two\nLines'), 'Title: Two Lines\n\nText');
    const once = Fountain.setTitle('Title: A\n\nText', 'B');
    assert.equal(Fountain.setTitle(once, 'B'), once);
});

test('setTitle: what it writes is what extractTitle and the title page read back', () => {
    const t = Fountain.setTitle('INT. A - DAY', 'Big Fish');
    assert.equal(Fountain.extractTitle(t), 'Big Fish');
    assert.equal(Fountain.parse(t)[0].type, 'title_page');
    assert.equal(Fountain.parse(t)[1].type, 'scene');
});

test('fullTitle is not truncated; extractTitle caps at 40 for list labels', () => {
    const long = 'Title: ' + 'x'.repeat(60);
    assert.equal(Fountain.fullTitle(long).length, 60);
    assert.equal(Fountain.extractTitle(long).length, 40);
    assert.equal(Fountain.fullTitle('  \n '), '');
    assert.equal(Fountain.extractTitle('  \n '), 'Untitled Script');
});

// ---------- fileName (Export) ----------

test('fileName: the title makes a readable file name', () => {
    assert.equal(Fountain.fileName('Title: Big Fish\n\nFADE IN:'), 'big-fish.fountain');
    assert.equal(Fountain.fileName('INT. KITCHEN - DAY\nHi.'), 'int-kitchen-day.fountain'); // no title page: the first line
    assert.equal(Fountain.fileName('Title: _Big_ **Fish**\n\nX'), 'big-fish.fountain');
});

test('fileName: punctuation and slashes cannot reach the file system', () => {
    assert.equal(Fountain.fileName('Title: A/B: "C"?*<>|\ D'), 'a-b-c-d.fountain');
    assert.equal(Fountain.fileName('Title: ../../etc/passwd'), 'etc-passwd.fountain');
});

test('fileName: letters from any language are kept', () => {
    assert.equal(Fountain.fileName('Title: Caf\u00e9 Am\u00e9lie'), 'caf\u00e9-am\u00e9lie.fountain');
    assert.equal(Fountain.fileName('Title: \u5927\u9b5a'), '\u5927\u9b5a.fountain');
});

test('fileName: nothing usable gives "untitled"', () => {
    assert.equal(Fountain.fileName(''), 'untitled.fountain');
    assert.equal(Fountain.fileName('  \n  '), 'untitled.fountain');
    assert.equal(Fountain.fileName('Title: !!! ???'), 'untitled.fountain');
});

test('fileName: names Windows will not accept are prefixed', () => {
    assert.equal(Fountain.fileName('Title: CON'), 'script-con.fountain');
    assert.equal(Fountain.fileName('Title: nul'), 'script-nul.fountain');
    assert.equal(Fountain.fileName('Title: COM3'), 'script-com3.fountain');
    assert.equal(Fountain.fileName('Title: Con Air'), 'con-air.fountain'); // only the bare reserved word
});

test('fileName: long titles are cut at a word boundary, never with a trailing hyphen', () => {
    const name = Fountain.fileName('Title: ' + 'wonderful '.repeat(12));
    const slug = name.replace('.fountain', '');
    assert.ok(slug.length <= 60, slug.length + ' chars');
    assert.ok(!/-$/.test(slug) && !/^-/.test(slug));
    assert.ok(/^(wonderful-)*wonderful$/.test(slug), slug); // whole words only
    assert.equal(Fountain.fileName('Title: ' + 'x'.repeat(100)).replace('.fountain', '').length, 60); // one huge word is cut at 60
});

test('fileName: the extension can be chosen, with or without the dot', () => {
    assert.equal(Fountain.fileName('Title: Big Fish', 'txt'), 'big-fish.txt');
    assert.equal(Fountain.fileName('Title: Big Fish', '.txt'), 'big-fish.txt');
});
