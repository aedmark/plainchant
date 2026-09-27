// Real files on disk (src/filesync.js, P5-01). Expects globals: test, assert, FileSync.

const fsState = (text, synced, modified, diskText, diskModified) =>
    ({ text: text, synced: synced === null ? null : FileSync.canon(synced), modified: modified, disk: { text: diskText, modified: diskModified } });

test('filesync: a file is written with \\n line endings and exactly one newline at the end', () => {
    assert.equal(FileSync.canon('A\r\nB\rC'), 'A\nB\nC\n');
    assert.equal(FileSync.canon('A\n\n\n'), 'A\n');
    assert.equal(FileSync.canon(''), '\n');
    assert.equal(FileSync.canon(null), '\n');
});

test('filesync: a file that says what the script says is agreed on, whoever wrote it', () => {
    assert.equal(FileSync.decide(fsState('Words.', 'Old.', 1, 'Words.\n', 2)), 'same');
    assert.equal(FileSync.decide(fsState('Words.\n\n', 'Words.', 1, 'Words.\r\n', 1)), 'same', 'line endings and trailing newlines aside');
});

test('filesync: only the script changed since they agreed: write it', () => {
    assert.equal(FileSync.decide(fsState('New words.', 'Old.', 1, 'Old.\n', 1)), 'write');
});

test('filesync: only the file changed (in another program): load it', () => {
    assert.equal(FileSync.decide(fsState('Old.', 'Old.', 1, 'Edited elsewhere.\n', 2)), 'load');
});

test('filesync: both changed: ask the writer, never write over the file', () => {
    assert.equal(FileSync.decide(fsState('Mine.', 'Old.', 1, 'Theirs.\n', 2)), 'conflict');
    assert.equal(FileSync.decide(fsState('Mine.', null, null, 'Theirs.\n', 2)), 'conflict', 'never agreed at all');
});

test('filesync: the file\'s text, not only its time, says whether it changed', () => {
    assert.equal(FileSync.decide(fsState('New words.', 'Old.', 1, 'Old.\n', 5)), 'write', 'touched but the same words: the script\'s change is written');
    assert.equal(FileSync.decide(fsState('Old.', 'Old.', 1, 'Other.\n', 1)), 'none', 'different words with the same time: leave both alone');
});

test('filesync: the open and save windows offer Fountain and plain text', () => {
    assert.deepEqual(FileSync.TYPES[0].accept['text/plain'], ['.fountain', '.txt', '.md']);
});
