// Version rules (src/versions.js, P4-05). Expects globals: test, assert, Versions.

const V_NOW = 1_800_000_000_000;
const V_MIN = 60 * 1000, V_HOUR = 60 * V_MIN, V_DAY = 24 * V_HOUR;
const vScript = (content, updatedAt, extra) => Object.assign({ id: 's1', title: 'S1', content: content, updatedAt: updatedAt }, extra || {});
const vKept = (id, takenAt, extra) => Object.assign({ id: id, scriptId: 's1', content: id, takenAt: takenAt, updatedAt: takenAt }, extra || {});

test('versions: the stored text is kept before a save overwrites it, the first time', () => {
    assert.equal(Versions.due(vScript('Old words.', V_NOW - V_DAY), null, V_NOW), true);
});

test('versions: then at most once every ten minutes, and only if the text has changed since', () => {
    const stored = vScript('Newer words.', V_NOW - 60000);
    assert.equal(Versions.due(stored, vKept('v1', V_NOW - 9 * V_MIN), V_NOW), false, 'nine minutes on');
    assert.equal(Versions.due(stored, vKept('v1', V_NOW - 10 * V_MIN), V_NOW), true, 'ten minutes on');
    assert.equal(Versions.due(stored, vKept('v1', V_NOW - V_DAY, { content: 'Newer words.' }), V_NOW), false, 'already kept');
});

test('versions: a save that changes nothing keeps nothing', () => {
    const stored = vScript('Same words.', V_NOW - V_DAY);
    assert.equal(Versions.due(stored, null, V_NOW, vScript('Same words.', V_NOW)), false);
    assert.equal(Versions.due(stored, null, V_NOW, vScript('Other words.', V_NOW)), true);
});

test('versions: nothing is kept for a new script, a deleted one or an empty page', () => {
    assert.equal(Versions.due(null, null, V_NOW), false);
    assert.equal(Versions.due(vScript('Words.', 1, { deletedAt: 5 }), null, V_NOW), false);
    assert.equal(Versions.due(vScript('  \n ', 1), null, V_NOW), false);
});

test('versions: make copies the script as it was, when it was saved and when it was kept', () => {
    const v = Versions.make(vScript('Words.', 123), 'v9', V_NOW, { name: 'Draft 2' });
    assert.deepEqual(v, { id: 'v9', scriptId: 's1', title: 'S1', content: 'Words.', updatedAt: 123, takenAt: V_NOW, name: 'Draft 2' });
    assert.equal('name' in Versions.make(vScript('Words.', 123), 'v8', V_NOW), false, 'no empty name');
});

test('versions: all of the last hour is kept, then the newest of each hour for a day', () => {
    const list = [
        vKept('now1', V_NOW - 5 * V_MIN), vKept('now2', V_NOW - 20 * V_MIN), vKept('now3', V_NOW - 50 * V_MIN),
        vKept('h1new', V_NOW - 3 * V_HOUR + 20 * V_MIN), vKept('h1old', V_NOW - 3 * V_HOUR + 5 * V_MIN)
    ];
    // both "h1" versions fall in the same clock hour (V_NOW is a whole hour)
    assert.equal(V_NOW % V_HOUR, 0);
    assert.deepEqual(Versions.prune(list, V_NOW), ['h1old']);
});

test('versions: within the day, different hours each keep one (not just one a day)', () => {
    const list = [vKept('h3', V_NOW - 3 * V_HOUR + 10 * V_MIN), vKept('h5', V_NOW - 5 * V_HOUR + 10 * V_MIN), vKept('h9', V_NOW - 9 * V_HOUR + 10 * V_MIN)];
    assert.deepEqual(Versions.prune(list, V_NOW), []);
});

test('versions: the newest of each day for thirty days, then the newest of each thirty days, for good', () => {
    const day = (n, minutes) => V_NOW - n * V_DAY - (minutes || 0) * V_MIN;
    const list = [
        vKept('d2a', day(2, 10)), vKept('d2b', day(2, 20)), vKept('d10', day(10)),
        vKept('old1', V_NOW - 400 * V_DAY), vKept('old2', V_NOW - 400 * V_DAY - V_HOUR), vKept('older', V_NOW - 800 * V_DAY)
    ];
    const dropped = Versions.prune(list, V_NOW).sort();
    assert.ok(dropped.indexOf('d2b') !== -1 && dropped.indexOf('d2a') === -1, dropped.join());
    assert.ok(dropped.indexOf('old2') !== -1 && dropped.indexOf('old1') === -1 && dropped.indexOf('older') === -1, dropped.join());
    assert.equal(dropped.indexOf('d10'), -1);
});

test('versions: named versions are never thinned out', () => {
    const list = [vKept('a', V_NOW - 3 * V_HOUR + V_MIN), vKept('b', V_NOW - 3 * V_HOUR + 2 * V_MIN, { name: 'Draft 2' }),
        vKept('c', V_NOW - 3 * V_HOUR + 3 * V_MIN, { name: 'Draft 3' })];
    assert.deepEqual(Versions.prune(list, V_NOW), [], 'the named ones stay, and do not take the unnamed one\'s place in its hour');
    const two = list.concat([vKept('d', V_NOW - 3 * V_HOUR + 4 * V_MIN)]);
    assert.deepEqual(Versions.prune(two, V_NOW), ['a'], 'two unnamed in one hour: the older goes, the named stay');
    assert.deepEqual(Versions.prune([vKept('x', V_NOW - 900 * V_DAY, { name: 'First draft' })], V_NOW), []);
});

test('versions: prune does not care about the order it is given, nor change its input', () => {
    const list = Object.freeze([vKept('h1old', V_NOW - 3 * V_HOUR + 5 * V_MIN), vKept('h1new', V_NOW - 3 * V_HOUR + 20 * V_MIN)].map(Object.freeze));
    assert.deepEqual(Versions.prune(list, V_NOW), ['h1old']);
});
