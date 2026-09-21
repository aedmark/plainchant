// Import rules (src/importing.js, and Library.add). Expects globals: test, assert, Fountain, Library, Importing.

const bytes = (...parts) => Uint8Array.from([].concat(...parts.map((p) => (typeof p === 'string' ? Array.from(new TextEncoder().encode(p)) : p))));
const utf16 = (text, bigEndian) => {
    const out = [];
    for (const ch of text) { const c = ch.charCodeAt(0); out.push(...(bigEndian ? [c >> 8, c & 255] : [c & 255, c >> 8])); }
    return out;
};

// ---------- readText ----------

test('readText: plain UTF-8 comes back as it was written', () => {
    const r = Importing.readText(bytes('Title: Big Fish\n\nINT. POND - DAY\n'));
    assert.deepEqual(r, { ok: true, text: 'Title: Big Fish\n\nINT. POND - DAY\n' });
});

test('readText: a UTF-8 byte order mark is dropped, and accents survive', () => {
    const r = Importing.readText(bytes([0xEF, 0xBB, 0xBF], 'CAFÉ — “quoted”'));
    assert.equal(r.text, 'CAFÉ — “quoted”');
});

test('readText: UTF-16 files (Notepad\'s "Unicode") are decoded, little and big endian', () => {
    assert.equal(Importing.readText(bytes([0xFF, 0xFE], utf16('INT. HALL - DAY\nHé.'))).text, 'INT. HALL - DAY\nHé.');
    assert.equal(Importing.readText(bytes([0xFE, 0xFF], utf16('INT. HALL - DAY\nHé.', true))).text, 'INT. HALL - DAY\nHé.');
});

test('readText: an old Windows-1252 file is read as text, not as replacement characters', () => {
    const r = Importing.readText(bytes('Caf', [0xE9], ' ', [0x93], 'hi', [0x94]));
    assert.equal(r.text, 'Café “hi”');
});

test('readText: Windows and old Mac line endings become plain newlines', () => {
    assert.equal(Importing.readText(bytes('a\r\nb\r\n\r\nc')).text, 'a\nb\n\nc');
    assert.equal(Importing.readText(bytes('a\rb\r\rc')).text, 'a\nb\n\nc');
});

test('readText: a file with nothing in it is refused, kindly', () => {
    assert.equal(Importing.readText(bytes('')).ok, false);
    const r = Importing.readText(bytes(' \n\r\n \t'));
    assert.equal(r.ok, false);
    assert.ok(/empty/i.test(r.reason), r.reason);
});

test('readText: binary files are refused instead of filling the editor with junk', () => {
    const pdf = bytes('%PDF-1.7\n', [0, 0, 0, 1, 0xFF, 0xFE, 0], ' more');
    const r = Importing.readText(pdf);
    assert.equal(r.ok, false);
    assert.ok(/text/i.test(r.reason), r.reason);
});

test('readText: the words are never altered beyond encoding and line endings', () => {
    const src = '  INT. ROOM - DAY  \n\n\tIndented action.  \n\n\n\nEnd';
    assert.equal(Importing.readText(bytes(src)).text, src);
});

// ---------- checkFile ----------

test('checkFile: .fountain, .txt, .md, upper-case and extension-less files are accepted', () => {
    ['a.fountain', 'a.txt', 'A.FOUNTAIN', 'notes.md', 'a.text', 'script', 'my.draft.v2.txt'].forEach((n) => {
        assert.equal(Importing.checkFile(n, 100).ok, true, n);
    });
});

test('checkFile: other screenwriting and document formats are refused with a reason that names them', () => {
    const fdx = Importing.checkFile('film.fdx', 100);
    assert.equal(fdx.ok, false);
    assert.ok(/Final Draft/.test(fdx.reason) && /fountain/i.test(fdx.reason), fdx.reason);
    ['a.pdf', 'a.docx', 'a.doc', 'a.rtf', 'a.pages', 'a.highland', 'a.fadein', 'a.celtx', 'a.zip'].forEach((n) => {
        const r = Importing.checkFile(n, 100);
        assert.equal(r.ok, false, n);
        assert.ok(r.reason.length > 10, n);
    });
});

test('checkFile: an empty file and a huge file are refused before anyone reads them', () => {
    assert.equal(Importing.checkFile('a.txt', 0).ok, false);
    assert.equal(Importing.checkFile('a.txt', Importing.MAX_BYTES).ok, true);
    const big = Importing.checkFile('a.txt', Importing.MAX_BYTES + 1);
    assert.equal(big.ok, false);
    assert.ok(/MB/.test(big.reason), big.reason);
});

// ---------- Library.add ----------

test('Library.add: puts the text in as a new script titled from its own Title: line, and mutates nothing', () => {
    const before = Object.freeze({ a: Object.freeze({ id: 'a', title: 'Alpha', content: 'Title: Alpha', updatedAt: 1 }) });
    const r = Library.add(before, 'n1', 'Title: Big Fish\n\nINT. POND - DAY', 500);
    assert.equal(r.id, 'n1');
    assert.equal(Object.keys(r.scripts).length, 2);
    assert.deepEqual(r.scripts.n1, { id: 'n1', title: 'Big Fish', content: 'Title: Big Fish\n\nINT. POND - DAY', updatedAt: 500 });
    assert.equal(r.scripts.a, before.a);
});

test('Library.add: an id that already exists is never overwritten', () => {
    const before = Object.freeze({ a: Object.freeze({ id: 'a', title: 'Alpha', content: 'Alpha', updatedAt: 1 }) });
    assert.equal(Library.add(before, 'a', 'Other', 2), null);
});
