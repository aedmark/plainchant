// Adventure-game replies (src/adventure.js, P4-20). Expects globals: test, assert, Adventure.

test('adventure: a whole line in any case, with spaces tidied, is a command', () => {
    assert.equal(Adventure.command('look'), 'look');
    assert.equal(Adventure.command('  LOOK   Around '), 'look');
    assert.equal(Adventure.command('Inventory'), 'inventory');
    assert.equal(Adventure.command('inv'), 'inventory');
    assert.equal(Adventure.command('take inventory'), 'inventory');
    assert.equal(Adventure.command('XYZZY'), 'xyzzy');
    assert.equal(Adventure.command('plugh'), 'plugh');
    assert.equal(Adventure.command('get all'), 'all');
    assert.equal(Adventure.command('TAKE ALL'), 'all');
    assert.equal(Adventure.command('score'), 'score');
    assert.equal(Adventure.command('save game'), 'save');
    assert.equal(Adventure.command('restore game'), 'restore');
});

test('adventure: real text is never a command: more words, punctuation, everyday words, nothing', () => {
    ['look at me', 'Look.', 'look!', 'She looks around.', 'wait', 'help', 'save', 'quit', '', null, 'constructor', 'toString']
        .forEach((line) => assert.equal(Adventure.command(line), null, JSON.stringify(line)));
});

test('adventure: LOOK describes the scene the caret is in and who speaks there', () => {
    assert.equal(Adventure.reply('look', { scene: 'INT. KITCHEN - NIGHT', characters: ['MARA', 'DEV', 'JO'] }),
        'You are in INT. KITCHEN - NIGHT. MARA, DEV and JO are here.');
    assert.equal(Adventure.reply('look', { scene: 'EXT. ROOF - DAY', characters: ['MARA'] }), 'You are in EXT. ROOF - DAY. MARA is here.');
    assert.equal(Adventure.reply('look', { scene: 'EXT. ROOF - DAY', characters: [] }), 'You are in EXT. ROOF - DAY. Nobody speaks here yet.');
    assert.includes(Adventure.reply('look', { scene: null }), 'no scene heading yet');
    assert.includes(Adventure.reply('look'), 'no scene heading yet');
});

test('adventure: INVENTORY and SCORE count the script and the Library', () => {
    assert.equal(Adventure.reply('inventory', { words: 1204, scripts: 3 }), 'You are carrying 1204 words, 3 scripts and an unreasonable amount of coffee.');
    assert.equal(Adventure.reply('inventory', { words: 1, scripts: 1 }), 'You are carrying 1 word, 1 script and an unreasonable amount of coffee.');
    assert.equal(Adventure.reply('inventory', {}), 'You are carrying 0 words, 0 scripts and an unreasonable amount of coffee.');
    assert.equal(Adventure.reply('score', { pages: 12 }), 'Your score is 12 out of a possible 120 pages.');
    assert.equal(Adventure.reply('score', {}), 'Your score is 0 out of a possible 120 pages.');
});

test('adventure: the rest have their classic answers, and an unknown key has none', () => {
    assert.equal(Adventure.reply('xyzzy'), 'Nothing happens.');
    assert.equal(Adventure.reply('plugh'), 'A hollow voice says “Plugh.”');
    assert.includes(Adventure.reply('all'), 'Export can');
    assert.includes(Adventure.reply('save'), 'saves as you type');
    assert.includes(Adventure.reply('restore'), 'under Versions');
    assert.equal(Adventure.reply('dance'), '');
});
