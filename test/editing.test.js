// Typing-helper suite (src/editing.js). Expects globals: test, assert, Fountain, Editing.

/** Apply an edit descriptor to text the way the page does; returns { text, caret }. */
const applied = (text, edit) => edit
    ? { text: text.slice(0, edit.from) + edit.insert + text.slice(edit.to), caret: edit.selStart }
    : { text: text, caret: null };

const kind = (text, idx) => Editing.kindAt(text, idx === undefined ? text.split('\n').length - 1 : idx);
/** Enter pressed with the caret at the very end of `text` */
const enterAtEnd = (text, mode) => Editing.enter(text, text.length, text.length, mode);
const typeTo = (text, target, mode) => Editing.setType(text, text.length, target, mode);
/** Convert the last line to `target` and return the resulting document text. */
const convert = (text, target) => {
    const r = typeTo(text, target);
    return r ? applied(text, r.edit).text : null;
};

// ---------- Fountain.classifyLines (the parser side of the editor) ----------

test('classifyLines: one type per source line', () => {
    const k = Fountain.classifyLines('INT. A - DAY\n\nHe waits.\nStill waiting.\n\nJOHN\n(quietly)\nHi.\n\nCUT TO:');
    assert.deepEqual(k, ['scene', 'blank', 'action', 'action', 'blank', 'character', 'parenthetical', 'dialogue', 'blank', 'transition']);
});

test('classifyLines: title page, sections and a two-space dialogue continuation', () => {
    const k = Fountain.classifyLines('Title: X\nAuthor: Y\n\n# ACT\n\nJOHN\nOne.\n  \nTwo.');
    assert.deepEqual(k, ['title_page', 'title_page', 'blank', 'section', 'blank', 'character', 'dialogue', 'blank', 'dialogue']);
});

// ---------- kindAt ----------

test('kindAt: the basic elements', () => {
    assert.equal(kind('INT. KITCHEN - DAY'), 'scene');
    assert.equal(kind('int. kitchen - day'), 'scene');
    assert.equal(kind('He waits.'), 'action');
    assert.equal(kind('CUT TO:'), 'transition');
    assert.equal(kind('# ACT ONE'), 'section');
    assert.equal(kind(''), 'blank');
});

test('kindAt: an uppercase line typed after a blank line is a character cue before its dialogue exists', () => {
    assert.equal(kind('He waits.\n\nJOHN'), 'character');
    assert.equal(kind('JOHN (V.O.)'), 'character');
});

test('kindAt: uppercase action that ends like a sentence is not a cue', () => {
    assert.equal(kind('He waits.\n\nBANG!'), 'action');
    assert.equal(kind('He waits.\n\nSILENCE.'), 'action');
});

test('kindAt: lowercase or mid-paragraph lines are action', () => {
    assert.equal(kind('He waits.\n\njohn'), 'action');
    assert.equal(kind('He waits.\nJOHN'), 'action');
});

test('kindAt: dialogue block lines', () => {
    assert.equal(kind('JOHN\n(quietly)', 1), 'parenthetical');
    assert.equal(kind('JOHN\nHi there.', 1), 'dialogue');
    assert.equal(kind('JOHN\nHi.\nMore.', 2), 'dialogue');
    assert.equal(kind('JOHN\nNO WAY', 1), 'dialogue'); // uppercase speech is still speech
});

test('kindAt: a cue is still a cue when its dialogue already exists below it', () => {
    assert.equal(kind('Text.\n\nJOHN\nHello.', 2), 'character');
});

test('kindAt: long scripts (windowed parsing) classify the same as short ones', () => {
    const filler = Array.from({ length: 400 }, (_, i) => 'Line ' + i + '.').join('\n\n');
    const withDialogue = filler + '\n\nJOHN\nHi there.';
    assert.equal(kind(withDialogue, 2 * 400), 'character');
    assert.equal(kind(withDialogue, 2 * 400 + 1), 'dialogue');
    assert.equal(kind(filler + '\n\nINT. A - DAY', 2 * 400), 'scene');
});

// ---------- smart Enter ----------

test('enter: after a scene heading, a blank line then action', () => {
    assert.equal(applied('INT. A - DAY', enterAtEnd('INT. A - DAY')).text, 'INT. A - DAY\n\n');
});

test('enter: after action, a new paragraph', () => {
    assert.equal(applied('He waits.', enterAtEnd('He waits.')).text, 'He waits.\n\n');
});

test('enter: after a character cue, straight into dialogue (no blank line)', () => {
    const t = 'He waits.\n\nJOHN';
    assert.equal(applied(t, enterAtEnd(t)).text, t + '\n');
});

test('enter: after a parenthetical, straight into dialogue', () => {
    const t = 'JOHN\n(quietly)';
    assert.equal(applied(t, enterAtEnd(t)).text, t + '\n');
});

test('enter: after dialogue, a blank line (the block is over)', () => {
    const t = 'JOHN\nHi there.';
    assert.equal(applied(t, enterAtEnd(t)).text, t + '\n\n');
});

test('enter: after a transition, a blank line', () => {
    assert.equal(applied('CUT TO:', enterAtEnd('CUT TO:')).text, 'CUT TO:\n\n');
});

test('enter: caret lands after the inserted text', () => {
    const t = 'He waits.';
    assert.equal(enterAtEnd(t).selStart, t.length + 2);
});

test('enter: uppercase action ending in punctuation is a new paragraph, not the start of dialogue', () => {
    const t = 'He waits.\n\nBANG!';
    assert.equal(applied(t, enterAtEnd(t)).text, t + '\n\n');
});

test('enter: leaves the browser alone for a selection, a mid-line caret, a blank line or a mid-block edit', () => {
    assert.equal(Editing.enter('He waits.', 0, 4), null);
    assert.equal(Editing.enter('He waits.', 3, 3), null);
    assert.equal(Editing.enter('He waits.\n\n', 11, 11), null);
    assert.equal(Editing.enter('JOHN\nHi.\nMore.', 8, 8), null);
});

test('enter: fine to press at the end of a block that has a blank line and more script below it', () => {
    const t = 'He waits.\n\nINT. B - DAY';
    const e = Editing.enter(t, 9, 9);
    assert.equal(applied(t, e).text, 'He waits.\n\n\n\nINT. B - DAY');
});

test('enter with a chosen character mode: uppercases the cue, then straight into dialogue', () => {
    const t = 'He waits.\n\njohn';
    const r = applied(t, enterAtEnd(t, 'character'));
    assert.equal(r.text, 'He waits.\n\nJOHN\n');
    assert.equal(kind(r.text, 2), 'character');
});

test('enter with a chosen scene mode: finishes the heading, then a blank line', () => {
    const t = 'He waits.\n\nint. kitchen - day';
    assert.equal(applied(t, enterAtEnd(t, 'scene')).text, 'He waits.\n\nINT. KITCHEN - DAY\n\n');
});

test('enter with a chosen scene mode: a heading typed without INT./EXT. is forced', () => {
    const t = 'He waits.\n\nkitchen';
    const r = applied(t, enterAtEnd(t, 'scene'));
    assert.equal(r.text, 'He waits.\n\n.KITCHEN\n\n');
    assert.equal(kind(r.text, 2), 'scene');
});

test('enter with a chosen transition mode: real transitions stay plain, others get the > marker', () => {
    assert.equal(applied('X.\n\ncut to:', enterAtEnd('X.\n\ncut to:', 'transition')).text, 'X.\n\nCUT TO:\n\n');
    assert.equal(applied('X.\n\nsmash cut', enterAtEnd('X.\n\nsmash cut', 'transition')).text, 'X.\n\nSMASH CUT\n\n'); // the parser knows this one
    const r = applied('X.\n\nmeanwhile', enterAtEnd('X.\n\nmeanwhile', 'transition'));
    assert.equal(r.text, 'X.\n\n> MEANWHILE\n\n');
    assert.equal(kind(r.text, 2), 'transition');
});

test('enter with a mode but nothing typed yet: plain newline', () => {
    assert.equal(enterAtEnd('X.\n\nINT. ', 'scene'), null);
});

test('enter with blank lines switched off (settings): a plain line break everywhere, the browser\'s own', () => {
    const off = { paragraphs: false };
    ['INT. A - DAY', 'He waits.', 'X.\n\nCUT TO:', 'X.\n\nJOHN', 'JOHN\nHi.'].forEach((t) => {
        assert.equal(Editing.enter(t, t.length, t.length, null, off), null, t);
    });
    assert.ok(Editing.enter('He waits.', 9, 9, null, { paragraphs: true }) !== null, 'on is the default');
});

test('enter with blank lines switched off: a chosen element is still finished, with one line break', () => {
    const off = { paragraphs: false };
    const scene = 'He waits.\n\nint. kitchen - day';
    assert.equal(applied(scene, Editing.enter(scene, scene.length, scene.length, 'scene', off)).text, 'He waits.\n\nINT. KITCHEN - DAY\n');
    const cue = 'He waits.\n\njohn';
    assert.equal(applied(cue, Editing.enter(cue, cue.length, cue.length, 'character', off)).text, 'He waits.\n\nJOHN\n');
    const tr = 'X.\n\nmeanwhile';
    assert.equal(applied(tr, Editing.enter(tr, tr.length, tr.length, 'transition', off)).text, 'X.\n\n> MEANWHILE\n');
});

// ---------- Tab: which element next ----------

test('cycleTarget: action -> character -> scene -> transition -> action', () => {
    assert.equal(Editing.cycleTarget('Some line.', 10, 1), 'character');
    assert.equal(Editing.cycleTarget('X.\n\nJOHN\nHi.', 5, 1), 'scene');            // on the cue line
    assert.equal(Editing.cycleTarget('X.\n\nINT. A - DAY', 16, 1), 'transition');
    assert.equal(Editing.cycleTarget('X.\n\nCUT TO:', 10, 1), 'action');
});

test('cycleTarget: Shift+Tab walks backwards', () => {
    assert.equal(Editing.cycleTarget('X.\n\nINT. A - DAY', 16, -1), 'character');
    assert.equal(Editing.cycleTarget('Some line.', 10, -1), 'transition');
});

test('cycleTarget: on a blank line it steps from the chosen mode (default action)', () => {
    assert.equal(Editing.cycleTarget('X.\n\n', 4, 1, null), 'character');
    assert.equal(Editing.cycleTarget('X.\n\n', 4, 1, 'character'), 'scene');
    assert.equal(Editing.cycleTarget('X.\n\n', 4, 1, 'transition'), 'action');
});

test('cycleTarget: inside a dialogue block it toggles dialogue / parenthetical', () => {
    assert.equal(Editing.cycleTarget('JOHN\nHi.', 8, 1), 'parenthetical');
    assert.equal(Editing.cycleTarget('JOHN\n(beat)', 11, 1), 'dialogue');
    assert.equal(Editing.cycleTarget('JOHN\n', 5, 1), 'parenthetical'); // empty line under a cue
});

// ---------- converting a line ----------

test('setType character: uppercases the words and adds the blank line above', () => {
    assert.equal(convert('He waits.\njohn', 'character'), 'He waits.\n\nJOHN');
});

test('setType character on a blank line: nothing to change in the text, mode remembered', () => {
    const r = typeTo('He waits.\n\n', 'character');
    assert.equal(r.edit, null);
    assert.equal(r.mode, 'character');
});

test('setType character on a blank line straight under text: makes the blank line a cue needs', () => {
    const t = 'He waits.\n';
    const r = typeTo(t, 'character');
    assert.equal(applied(t, r.edit).text, 'He waits.\n\n');
    assert.equal(r.mode, 'character');
});

test('setType scene: adds INT. to plain words, keeps an existing prefix, uppercases', () => {
    assert.equal(convert('X.\n\nthe kitchen', 'scene'), 'X.\n\nINT. THE KITCHEN');
    assert.equal(convert('X.\n\next. beach - day', 'scene'), 'X.\n\nEXT. BEACH - DAY');
});

test('setType scene on a blank line: pre-fills INT. and remembers the mode', () => {
    const t = 'X.\n\n';
    const r = typeTo(t, 'scene');
    assert.equal(applied(t, r.edit).text, 'X.\n\nINT. ');
    assert.equal(r.mode, 'scene');
});

test('setType scene -> character strips the prefix', () => {
    assert.equal(convert('X.\n\nINT. KITCHEN - DAY', 'character'), 'X.\n\nKITCHEN - DAY');
});

test('setType transition: a real transition stays plain, anything else gets the > marker', () => {
    assert.equal(convert('X.\n\ncut to', 'transition'), 'X.\n\n> CUT TO');
    assert.equal(convert('X.\n\nfade out.', 'transition'), 'X.\n\nFADE OUT.');
    assert.equal(convert('X.\n\nlater that day', 'transition'), 'X.\n\n> LATER THAT DAY');
});

test('setType action: strips markers; uppercase words that would read as a cue are forced with !', () => {
    assert.equal(convert('X.\n\nINT. KITCHEN', 'action'), 'X.\n\n!KITCHEN');
    assert.equal(convert('X.\n\n> CUT TO:', 'action'), 'X.\n\n!CUT TO:');
    assert.equal(convert('X.\n\n(beat)', 'action'), 'X.\n\nbeat');
});

test('setType parenthetical / dialogue: only inside a character block', () => {
    assert.equal(convert('JOHN\nbeat', 'parenthetical'), 'JOHN\n(beat)');
    assert.equal(convert('JOHN\n(beat)', 'dialogue'), 'JOHN\nbeat');
    assert.equal(typeTo('He waits.', 'parenthetical'), null);
    assert.equal(typeTo('X.\n\nJOHN', 'parenthetical'), null); // the cue line itself is not speech
});

test('setType parenthetical on the empty line under a cue: inserts () with the caret inside', () => {
    const t = 'JOHN\n';
    const r = typeTo(t, 'parenthetical');
    const out = applied(t, r.edit);
    assert.equal(out.text, 'JOHN\n()');
    assert.equal(out.caret, 6);
    assert.equal(kind(out.text, 1), 'parenthetical');
});

const SAMPLE_LINES = ['john', 'JOHN', 'the kitchen', 'INT. KITCHEN - DAY', 'cut to:', 'CUT TO:', 'He waits.', 'BANG!', 'smash cut', '(beat)', 'Mr. Smith'];

test('setType: whichever line it converts, the parser agrees afterwards (property check)', () => {
    ['action', 'character', 'scene', 'transition'].forEach((target) => {
        SAMPLE_LINES.forEach((l) => {
            const before = 'He waits.\n\n' + l;
            const r = typeTo(before, target);
            if (!r) {
                // The one impossible conversion: a line ending in "TO:" can never read as a character cue
                assert.ok(target === 'character' && /to:$/i.test(l), target + ' from ' + l + ' returned null');
                return;
            }
            const out = applied(before, r.edit).text;
            assert.equal(kind(out), target, l + ' -> ' + target + ' gave ' + JSON.stringify(out));
        });
    });
});

test('tab: never stalls; pressing it repeatedly always changes the line, on any kind of line', () => {
    SAMPLE_LINES.forEach((l) => {
        [1, -1].forEach((dir) => {
            let text = 'He waits.\n\n' + l;
            const seen = [];
            for (let n = 0; n < 8; n++) {
                const r = Editing.tab(text, text.length, dir, null);
                assert.ok(r, 'stalled on ' + JSON.stringify(text) + ' pressing ' + (dir > 0 ? 'Tab' : 'Shift+Tab') + ' (from ' + l + ')');
                assert.ok(r.edit, 'no change for ' + JSON.stringify(text));
                text = applied(text, r.edit).text;
                seen.push(kind(text));
            }
            assert.ok(seen.indexOf('scene') !== -1 && seen.indexOf('transition') !== -1, l + ' cycle ' + seen.join(','));
        });
    });
});

test('tab: skips an impossible step (a line ending in TO: cannot be a cue)', () => {
    const r = Editing.tab('X.\n\nCUT TO:', 10, 1, null);       // transition -> action
    assert.equal(r.target, 'action');
    const t = 'X.\n\n!CUT TO:';
    const r2 = Editing.tab(t, t.length, 1, null);              // action -> (character impossible) -> scene
    assert.equal(r2.target, 'scene');
});

test('tab: inside a block it toggles; on a blank line it returns the mode to remember', () => {
    assert.equal(Editing.tab('JOHN\nHi.', 8, 1, null).target, 'parenthetical');
    const r = Editing.tab('X.\n\n', 4, 1, null);
    assert.equal(r.target, 'character');
    assert.equal(r.mode, 'character');
    assert.equal(r.edit, null);
});

test('setType: converting twice is stable', () => {
    ['character', 'scene', 'transition', 'action'].forEach((target) => {
        const once = convert('He waits.\n\nthe kitchen', target);
        const twice = convert(once, target);
        assert.equal(twice, once, target);
    });
});

// ---------- auto-uppercase ----------

test('autoCase: obvious scene headings are uppercased as they are typed', () => {
    const t = 'He waits.\n\nint. kitchen';
    assert.equal(applied(t, Editing.autoCase(t, t.length)).text, 'He waits.\n\nINT. KITCHEN');
    ['ext. beach', 'est. skyline', 'int./ext. car', 'i/e car'].forEach((l) => {
        const tt = 'X.\n\n' + l;
        assert.equal(applied(tt, Editing.autoCase(tt, tt.length)).text, 'X.\n\n' + l.toUpperCase(), l);
    });
});

test('autoCase: a partly typed prefix is left alone until it is unmistakable', () => {
    assert.equal(Editing.autoCase('X.\n\nint', 6), null);
    assert.equal(Editing.autoCase('X.\n\nint.', 8), null);
    assert.equal(Editing.autoCase('X.\n\nExtra chairs', 15), null);
});

test('autoCase: transitions typed in lowercase', () => {
    const t = 'X.\n\ncut to:';
    assert.equal(applied(t, Editing.autoCase(t, t.length)).text, 'X.\n\nCUT TO:');
});

test('autoCase: never touches action, dialogue, or a line that is not at the end of the caret', () => {
    assert.equal(Editing.autoCase('He said int. hello', 18), null);
    assert.equal(Editing.autoCase('JOHN\nint. is a prefix', 21), null);     // inside a block: not preceded by a blank line
    assert.equal(Editing.autoCase('X.\n\nint. kitchen', 6), null);           // caret mid-line
    assert.equal(Editing.autoCase('X.\n\nHe waits and waits', 22), null);
});

test('autoCase: a chosen mode uppercases whatever is typed', () => {
    ['character', 'scene', 'transition'].forEach((m) => {
        const t = 'X.\n\nsome words';
        assert.equal(applied(t, Editing.autoCase(t, t.length, m)).text, 'X.\n\nSOME WORDS', m);
    });
    assert.equal(Editing.autoCase('X.\n\nsome words', 14, null), null);
});

test('autoCase with capitals switched off (settings): no guessing, but a chosen element is still uppercased', () => {
    const off = { guess: false };
    ['X.\n\nint. kitchen', 'X.\n\ncut to:'].forEach((t) => assert.equal(Editing.autoCase(t, t.length, null, off), null, t));
    const t = 'X.\n\nsome words';
    assert.equal(applied(t, Editing.autoCase(t, t.length, 'character', off)).text, 'X.\n\nSOME WORDS');
    assert.ok(Editing.autoCase('X.\n\nint. kitchen', 16, null, { guess: true }) !== null, 'on is the default');
});

test('autoCase: caret stays where it was', () => {
    const t = 'X.\n\nint. kitchen';
    assert.equal(Editing.autoCase(t, t.length).selStart, t.length);
});

// ---------- diffEdit (title changes from the Library keep the writer's place and undo history) ----------

const diffApplied = (a, b, s, e) => { const d = Editing.diffEdit(a, b, s, e); return { d: d, text: a.slice(0, d.from) + d.insert + a.slice(d.to) }; };

test('diffEdit: applying the edit to the old text gives the new text, for all sorts of changes', () => {
    [['abc', 'abXc'], ['abc', 'ac'], ['abc', 'abc'], ['', 'abc'], ['abc', ''], ['aaa', 'aaaa'], ['Title: A\n\nBody', 'Title: Bigger\n\nBody'],
        ['one two three', 'one 2 three'], ['same', 'same!']].forEach(([a, b]) =>
        assert.equal(diffApplied(a, b, 0, 0).text, b, JSON.stringify([a, b])));
});

test('diffEdit: only the changed span is replaced', () => {
    const d = Editing.diffEdit('Title: A\n\nBody', 'Title: Bigger\n\nBody', 0, 0);
    assert.deepEqual([d.from, d.to, d.insert], [7, 8, 'Bigger']);
});

test('diffEdit: identical text is an empty edit', () => {
    const d = Editing.diffEdit('same', 'same', 2, 2);
    assert.equal(d.insert, '');
    assert.equal(d.from, d.to);
    assert.deepEqual([d.selStart, d.selEnd], [2, 2]);
});

test('diffEdit: the caret before the change stays, after it shifts by the change in length, inside it lands at its end', () => {
    const old = 'Title: A\n\nBody text', neu = 'Title: Bigger\n\nBody text';
    assert.equal(Editing.diffEdit(old, neu, 3, 3).selStart, 3);                              // before
    assert.equal(Editing.diffEdit(old, neu, old.length, old.length).selStart, neu.length);   // after
    assert.equal(Editing.diffEdit(old, neu, 10, 14).selStart, 10 + 5);                       // a selection in the body moves as a unit
    assert.equal(Editing.diffEdit(old, neu, 10, 14).selEnd, 14 + 5);
    assert.equal(Editing.diffEdit(old, neu, 7, 8).selEnd, 13);                               // covering the change: end of the insert
});

// ---------- blockAt: the block the caret is in, for focus mode (P2-07) ----------

const blk = (text, caret) => { const b = Editing.blockAt(text, caret); return text.slice(b.start, b.end); };

test('blockAt: the run of non-blank lines around the caret', () => {
    const text = 'INT. A - DAY\n\nJOHN\n(beat)\nHello.\n\nShe leaves.';
    assert.equal(blk(text, 0), 'INT. A - DAY');
    assert.equal(blk(text, text.indexOf('beat')), 'JOHN\n(beat)\nHello.');
    assert.equal(blk(text, text.length), 'She leaves.');
});

test('blockAt: on a blank line the block is that empty line', () => {
    const text = 'One.\n\nTwo.';
    const b = Editing.blockAt(text, 5);
    assert.deepEqual([b.start, b.end], [5, 5]);
    assert.deepEqual(Editing.blockAt('', 0), { start: 0, end: 0 });
});

test('blockAt: a line of spaces counts as blank, and the caret at a line end belongs to that line', () => {
    const text = 'One.\n   \nTwo.';
    assert.equal(blk(text, 4), 'One.');
    assert.equal(blk(text, 6), '   ');
    assert.equal(blk('Alpha\nBeta', 5), 'Alpha\nBeta');
});
