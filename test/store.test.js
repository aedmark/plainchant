// Storage rules (the pure half of src/store.js). Expects globals: test, assert, Store.
// The IndexedDB half is exercised against a real browser by test/app.e2e.html (section 17).
// Inputs are deeply frozen, so any rule that mutated its argument would throw ('use strict' in the module).

const STORE_NOW = 1_800_000_000_000;
const freezeDeep = (o) => { Object.values(o).forEach((v) => { if (v && typeof v === 'object') freezeDeep(v); }); return Object.freeze(o); };
const rec = (id, content, updatedAt, extra) => Object.assign({ id: id, title: id.toUpperCase(), content: content, updatedAt: updatedAt }, extra || {});
const idsFrom = (list) => list.map((s) => s.id).sort();
let freshIds = 0;
const makeId = () => 'fresh-' + (++freshIds);

// ---------- diff: what an in-memory change has to write ----------

test('diff: only records that changed are written, and removed ones are deleted', () => {
    const before = freezeDeep({ a: rec('a', 'A', 1), b: rec('b', 'B', 1), c: rec('c', 'C', 1) });
    const b2 = rec('b', 'B, edited', 2);
    const d = rec('d', 'D', 3);
    const after = { a: before.a, b: b2, d: d };
    const change = Store.diff(before, after);
    assert.deepEqual(idsFrom(change.put), ['b', 'd']);
    assert.ok(change.put.indexOf(b2) !== -1 && change.put.indexOf(d) !== -1, 'the new records themselves are written');
    assert.deepEqual(change.remove, ['c']);
});

test('diff: no change writes nothing', () => {
    const lib = freezeDeep({ a: rec('a', 'A', 1) });
    assert.deepEqual(Store.diff(lib, lib), { put: [], remove: [] });
    assert.deepEqual(Store.diff({}, {}), { put: [], remove: [] });
});

// ---------- guardSave: never write into a deleted script ----------

test('guardSave: a live or missing script is saved under its own id, as it is', () => {
    const r = freezeDeep(rec('a', 'Words', 9));
    assert.equal(Store.guardSave(rec('a', 'old', 1), r, 'new'), r);
    assert.equal(Store.guardSave(undefined, r, 'new'), r);
});

test('guardSave: words for a script another tab deleted go to a new script, which is not deleted', () => {
    const r = freezeDeep(rec('a', 'Words', 9, { deletedAt: 5 })); // even from a copy that knew it was deleted
    const out = Store.guardSave(freezeDeep(rec('a', 'old', 1, { deletedAt: 5 })), r, 'new');
    assert.equal(out.id, 'new');
    assert.equal(out.content, 'Words');
    assert.ok(!('deletedAt' in out), 'the new script is live');
});

// ---------- reconcile: the emergency buffer (words saved as the page was hidden) ----------

test('reconcile: nothing buffered changes nothing', () => {
    const lib = freezeDeep({ a: rec('a', 'A', 1) });
    [undefined, null, [], {}].forEach((entries) => {
        const out = Store.reconcile(lib, entries, makeId);
        assert.deepEqual(out.scripts, lib);
        assert.deepEqual(out.restored, []);
        assert.equal(out.currentId, null);
    });
});

test('reconcile: words newer than the stored script are put back, keeping its other fields', () => {
    const lib = freezeDeep({ a: rec('a', 'Old words', STORE_NOW - 10, { extra: 'kept' }), b: rec('b', 'B', 1) });
    const out = Store.reconcile(lib, freezeDeep([{ id: 'a', title: 'New title', content: 'Old words and the last few', updatedAt: STORE_NOW }]), makeId);
    assert.deepEqual(out.scripts.a, { id: 'a', title: 'New title', content: 'Old words and the last few', updatedAt: STORE_NOW, extra: 'kept' });
    assert.equal(out.scripts.b, lib.b);
    assert.deepEqual(idsFrom(out.restored), ['a']);
    assert.equal(out.currentId, 'a');
});

test('reconcile: an entry that is older, or says the same thing, is dropped (storage already has it)', () => {
    const lib = freezeDeep({ a: rec('a', 'Stored', STORE_NOW) });
    const older = Store.reconcile(lib, [{ id: 'a', title: 'A', content: 'Older words', updatedAt: STORE_NOW - 1 }], makeId);
    assert.deepEqual(older.restored, []);
    assert.equal(older.scripts.a, lib.a);
    const same = Store.reconcile(lib, [{ id: 'a', title: 'A', content: 'Stored', updatedAt: STORE_NOW + 5 }], makeId);
    assert.deepEqual(same.restored, [], 'same words: nothing to put back (the Edited time does not jump)');
    const equalTime = Store.reconcile(lib, [{ id: 'a', title: 'A', content: 'Different', updatedAt: STORE_NOW }], makeId);
    assert.deepEqual(equalTime.restored, [], 'the stored copy wins a tie');
});

test('reconcile: a script that never reached storage at all is created from the buffer', () => {
    const out = Store.reconcile(freezeDeep({}), [{ id: 'n', title: 'New', content: 'Brand new', updatedAt: STORE_NOW }], makeId);
    assert.deepEqual(out.scripts.n, { id: 'n', title: 'New', content: 'Brand new', updatedAt: STORE_NOW });
    assert.equal(out.currentId, 'n');
});

test('reconcile: words for a deleted script become a new script; the deleted one is untouched', () => {
    const lib = freezeDeep({ a: rec('a', 'Deleted words', STORE_NOW - 50, { deletedAt: STORE_NOW - 10 }) });
    const out = Store.reconcile(lib, [{ id: 'a', title: 'A', content: 'Typed after', updatedAt: STORE_NOW }], () => 'rescue');
    assert.equal(out.scripts.a, lib.a);
    assert.deepEqual(out.scripts.rescue, { id: 'rescue', title: 'A', content: 'Typed after', updatedAt: STORE_NOW });
    assert.equal(out.currentId, 'rescue');
});

test('reconcile: several entries (two tabs closed at once) are all kept; the newest becomes the open script', () => {
    const lib = freezeDeep({ a: rec('a', 'A', 1), b: rec('b', 'B', 1) });
    const out = Store.reconcile(lib, [ // newest first, so "the last one wins" would get it wrong
        { id: 'b', title: 'B', content: 'B plus', updatedAt: STORE_NOW },
        { id: 'a', title: 'A', content: 'A plus', updatedAt: STORE_NOW - 5 }
    ], makeId);
    assert.deepEqual(idsFrom(out.restored), ['a', 'b']);
    assert.equal(out.scripts.a.content, 'A plus');
    assert.equal(out.currentId, 'b');
});

test('reconcile: malformed entries are ignored, never written', () => {
    const lib = freezeDeep({ a: rec('a', 'A', 1) });
    const out = Store.reconcile(lib, [null, 'x', { id: 'a' }, { id: '', content: 'x', updatedAt: 9 }, { id: 'b', content: 5, updatedAt: 9 }, { id: 'c', content: 'x' }], makeId);
    assert.deepEqual(out.restored, []);
    assert.deepEqual(Object.keys(out.scripts), ['a']);
});
