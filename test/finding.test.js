test('finding: findAll locates plain-text matches case-insensitively by default and escapes regex characters', () => {
    const text = 'MARA\nHi Mara. [Mara?]\n';
    const insensitive = Finding.findAll(text, 'mara');
    assert.equal(insensitive.length, 3);
    assert.deepEqual(insensitive[0], { start: 0, end: 4 });
    assert.deepEqual(insensitive[1], { start: 8, end: 12 });

    const sensitive = Finding.findAll(text, 'Mara', { caseSensitive: true });
    assert.equal(sensitive.length, 2);
    assert.deepEqual(sensitive[0], { start: 8, end: 12 });

    const literal = Finding.findAll(text, '[Mara?]');
    assert.deepEqual(literal, [{ start: 14, end: 21 }]);
    assert.deepEqual(Finding.findAll(text, ''), []);
});

test('finding: nearest and step navigate matches with wrap-around', () => {
    const matches = [{ start: 5, end: 9 }, { start: 20, end: 24 }, { start: 40, end: 44 }];
    assert.equal(Finding.nearest([], 0), -1);
    assert.equal(Finding.nearest(matches, 0), 0);
    assert.equal(Finding.nearest(matches, 6), 1);
    assert.equal(Finding.nearest(matches, 50), 0);

    assert.equal(Finding.step(matches, 0, 1), 1);
    assert.equal(Finding.step(matches, 2, 1), 0);
    assert.equal(Finding.step(matches, 0, -1), 2);
    assert.equal(Finding.step([], 0, 1), -1);
});

test('finding: replaceAt and replaceAll substitute matches and return the new caret or count', () => {
    const text = 'INT. COFFEE SHOP - DAY\n\nJOHN\nCoffee is ready.';
    const m = Finding.findAll(text, 'coffee')[1];
    const single = Finding.replaceAt(text, m, 'Tea');
    assert.equal(single.text, 'INT. COFFEE SHOP - DAY\n\nJOHN\nTea is ready.');
    assert.equal(single.caret, m.start + 3);

    const all = Finding.replaceAll(text, 'coffee', 'TEA');
    assert.equal(all.count, 2);
    assert.equal(all.text, 'INT. TEA SHOP - DAY\n\nJOHN\nTEA is ready.');
});
