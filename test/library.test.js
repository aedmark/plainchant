// Library management suite (src/library.js). Expects globals: test, assert, Fountain, Library.
// Inputs are deeply frozen, so any function that mutated its argument would throw ('use strict' in the module).

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

const deepFreeze = (o) => { Object.values(o).forEach((v) => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); };
const script = (id, content, updatedAt, extra) => Object.assign({ id: id, title: Fountain.extractTitle(content), content: content, updatedAt: updatedAt }, extra || {});
const sample = () => deepFreeze({
    a: script('a', 'Title: Alpha\n\nINT. A - DAY', NOW - 3 * DAY),
    b: script('b', 'Title: Beta\n\nThe rain falls.', NOW - 1 * DAY),
    c: script('c', 'INT. GAMMA - NIGHT\nHi.', NOW - 2 * DAY),
    d: script('d', 'Title: Deleted One\n\nGone.', NOW - 5 * DAY, { deletedAt: NOW - 2 * DAY })
});

// ---------- listing ----------

test('active: live scripts only, most recently edited first', () => {
    assert.deepEqual(Library.active(sample()).map((s) => s.id), ['b', 'c', 'a']);
});

test('trashed: deleted scripts only, most recently deleted first', () => {
    const s = deepFreeze(Object.assign({}, sample(), { e: script('e', 'x', 1, { deletedAt: NOW - 1 * DAY }) }));
    assert.deepEqual(Library.trashed(s).map((x) => x.id), ['e', 'd']);
});

test('active / trashed: empty and missing input', () => {
    assert.deepEqual(Library.active({}), []);
    assert.deepEqual(Library.active(undefined), []);
    assert.deepEqual(Library.trashed({}), []);
});

test('search: title and text, any case; empty query matches everything', () => {
    const list = Library.active(sample());
    assert.deepEqual(Library.search(list, 'alpha').map((s) => s.id), ['a']);
    assert.deepEqual(Library.search(list, 'RAIN').map((s) => s.id), ['b']);          // matches text, not title
    assert.deepEqual(Library.search(list, 'night').map((s) => s.id), ['c']);
    assert.deepEqual(Library.search(list, '  ').map((s) => s.id), ['b', 'c', 'a']);
    assert.deepEqual(Library.search(list, 'nothing like this'), []);
});

// ---------- soft delete, restore, remove for good ----------

test('softDelete: marks the script, changes nothing else, never mutates', () => {
    const s = sample();
    const after = Library.softDelete(s, 'a', NOW);
    assert.equal(after.a.deletedAt, NOW);
    assert.equal(after.a.content, s.a.content);
    assert.equal(after.b, s.b);
    assert.equal(s.a.deletedAt, undefined);
    assert.deepEqual(Library.active(after).map((x) => x.id), ['b', 'c']);
});

test('softDelete: deleting twice or deleting a missing script changes nothing', () => {
    const s = sample();
    assert.equal(Library.softDelete(s, 'd', NOW), s);
    assert.equal(Library.softDelete(s, 'zzz', NOW), s);
});

test('restore: brings a deleted script back with its text and date intact', () => {
    const s = sample();
    const after = Library.restore(s, 'd');
    assert.equal(after.d.deletedAt, undefined);
    assert.equal(after.d.content, s.d.content);
    assert.equal(after.d.updatedAt, s.d.updatedAt);
    assert.equal(Library.restore(s, 'a'), s); // not deleted: nothing to do
});

test('delete then restore round-trips exactly', () => {
    const s = sample();
    assert.deepEqual(Library.restore(Library.softDelete(s, 'a', NOW), 'a'), s);
});

test('removeForever: gone from the object; unknown ids change nothing', () => {
    const s = sample();
    assert.equal(Library.removeForever(s, 'd').d, undefined);
    assert.equal(Object.keys(Library.removeForever(s, 'd')).length, 3);
    assert.equal(Library.removeForever(s, 'zzz'), s);
});

test('purgeExpired: removes scripts deleted 30 days ago or more, keeps the rest', () => {
    const s = deepFreeze({
        old: script('old', 'x', 1, { deletedAt: NOW - 30 * DAY }),
        edge: script('edge', 'x', 1, { deletedAt: NOW - 30 * DAY + 1 }),
        recent: script('recent', 'x', 1, { deletedAt: NOW - 1 * DAY }),
        live: script('live', 'x', 1)
    });
    const r = Library.purgeExpired(s, NOW);
    assert.deepEqual(r.removed, ['old']);
    assert.deepEqual(Object.keys(r.scripts).sort(), ['edge', 'live', 'recent']);
});

test('purgeExpired: never touches live scripts, however old; returns the same object if nothing expired', () => {
    const s = deepFreeze({ live: script('live', 'x', 1), fresh: script('fresh', 'x', 1, { deletedAt: NOW - DAY }) });
    const r = Library.purgeExpired(s, NOW);
    assert.equal(r.scripts, s);
    assert.deepEqual(r.removed, []);
});

test('purgeExpired: the retention period can be changed', () => {
    const s = deepFreeze({ a: script('a', 'x', 1, { deletedAt: NOW - 8 * DAY }) });
    assert.deepEqual(Library.purgeExpired(s, NOW, 7).removed, ['a']);
    assert.deepEqual(Library.purgeExpired(s, NOW, 30).removed, []);
    assert.equal(Library.TRASH_DAYS, 30);
});

// ---------- duplicate ----------

test('duplicate: a new script whose own text says "(copy)"', () => {
    const s = sample();
    const r = Library.duplicate(s, 'a', 'a2', NOW);
    assert.equal(r.id, 'a2');
    assert.equal(r.scripts.a2.content, 'Title: Alpha (copy)\n\nINT. A - DAY');
    assert.equal(r.scripts.a2.title, 'Alpha (copy)');
    assert.equal(r.scripts.a2.updatedAt, NOW);
    assert.equal(r.scripts.a, s.a); // the original is untouched
});

test('duplicate: a script with no Title: gets one from its first line', () => {
    const r = Library.duplicate(sample(), 'c', 'c2', NOW);
    assert.equal(r.scripts.c2.content, 'Title: INT. GAMMA - NIGHT (copy)\n\nINT. GAMMA - NIGHT\nHi.');
});

test('duplicate: long titles are not truncated in the copy, and a copy of a copy stacks', () => {
    const longTitle = 'A very long title that runs well past forty characters indeed';
    const s = deepFreeze({ x: script('x', 'Title: ' + longTitle + '\n\nText', 1) });
    const r = Library.duplicate(s, 'x', 'y', NOW);
    assert.equal(Fountain.fullTitle(r.scripts.y.content), longTitle + ' (copy)');
    const r2 = Library.duplicate(r.scripts, 'y', 'z', NOW);
    assert.equal(Fountain.fullTitle(r2.scripts.z.content), longTitle + ' (copy) (copy)');
});

test('duplicate: missing or deleted scripts cannot be copied', () => {
    assert.equal(Library.duplicate(sample(), 'zzz', 'n', NOW), null);
    assert.equal(Library.duplicate(sample(), 'd', 'n', NOW), null);
});

// ---------- rename ----------

test('rename: rewrites the Title: line in the text, and the label, and the date', () => {
    const s = sample();
    const r = Library.rename(s, 'a', 'Alpha Prime', NOW);
    assert.equal(r.content, 'Title: Alpha Prime\n\nINT. A - DAY');
    assert.equal(r.scripts.a.content, r.content);
    assert.equal(r.scripts.a.title, 'Alpha Prime');
    assert.equal(r.scripts.a.updatedAt, NOW);
    assert.equal(s.a.title, 'Alpha'); // not mutated
});

test('rename: a script without a title page gets one, and the rest of the text survives byte for byte', () => {
    const r = Library.rename(sample(), 'c', '  Gamma   Ray ', NOW);
    assert.equal(r.content, 'Title: Gamma Ray\n\nINT. GAMMA - NIGHT\nHi.');
});

test('rename: empty titles, missing scripts and deleted scripts are refused', () => {
    assert.equal(Library.rename(sample(), 'a', '   ', NOW), null);
    assert.equal(Library.rename(sample(), 'zzz', 'X', NOW), null);
    assert.equal(Library.rename(sample(), 'd', 'X', NOW), null);
});

// ---------- descriptions ----------

test('wordCount', () => {
    assert.equal(Library.wordCount(''), 0);
    assert.equal(Library.wordCount('  \n '), 0);
    assert.equal(Library.wordCount('Two words'), 2);
    assert.equal(Library.wordCount('INT. A - DAY\n\nHe waits.'), 6);
});

test('relativeTime: seconds, minutes, hours, days', () => {
    assert.equal(Library.relativeTime(NOW - 5000, NOW), 'just now');
    assert.equal(Library.relativeTime(NOW - 5 * 60000, NOW), '5 min ago');
    assert.equal(Library.relativeTime(NOW - 3 * 3600000, NOW), '3 h ago');
    assert.equal(Library.relativeTime(NOW - 1 * DAY, NOW), '1 day ago');
    assert.equal(Library.relativeTime(NOW - 3 * DAY, NOW), '3 days ago');
    assert.equal(Library.relativeTime(NOW + 5000, NOW), 'just now'); // clock skew never goes negative
});

test('relativeTime: older than a week is a date, not a count of days', () => {
    assert.ok(!/ago/.test(Library.relativeTime(NOW - 30 * DAY, NOW)));
});

test('daysLeft: counts down and never goes negative', () => {
    assert.equal(Library.daysLeft({ deletedAt: NOW }, NOW), 30);
    assert.equal(Library.daysLeft({ deletedAt: NOW - 2 * DAY }, NOW), 28);
    assert.equal(Library.daysLeft({ deletedAt: NOW - 45 * DAY }, NOW), 0);
});
