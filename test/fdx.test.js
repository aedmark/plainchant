// Final Draft export (src/fdx.js, P3-08). Expects globals: test, assert, Fdx.

const FDX_SCRIPT = 'Title: Big *Fish*\nCredit: Written by\nAuthor: Me & You\nDraft date: 1 May\nContact:\n    Me\n    555-1234\n\n' +
    'INT. KITCHEN - NIGHT #1A#\n\nShe **waits** and _waits_ and *waits*. [[a note]] 3 < 4 & "so".\nThen stops.\n\n' +
    'BOB (V.O.)\n(beat)\nHi *there*.\n~A little song\n\nJO ^\nYo.\n\n> THE END <\n\n> CUT TO:\n\n===\n\n# Act Two\n\n= A synopsis.\n\n' +
    '/* boneyard words */\n\n~Solo lyric\n\n.MONTAGE\n\nMore.';
const fdxParas = (xml) => (xml.match(/<Paragraph[^>]*Type="[^"]+"[^>]*>[\s\S]*?<\/Paragraph>/g) || []);
const fdxTypes = (xml) => fdxParas(xml.split('<TitlePage>')[0]).map((p) => p.match(/Type="([^"]+)"/)[1]);

test('fdx: a Final Draft document, every element a paragraph of its type, in order', () => {
    const x = Fdx.of(FDX_SCRIPT);
    assert.ok(x.indexOf('<?xml version="1.0" encoding="UTF-8"') === 0);
    assert.includes(x, '<FinalDraft DocumentType="Script" Template="No" Version="5">');
    assert.deepEqual(fdxTypes(x), ['Scene Heading', 'Action', 'Character', 'Parenthetical', 'Dialogue', 'Dialogue',
        'Character', 'Dialogue', 'Action', 'Transition', 'Action', 'Scene Heading', 'Action']);
    assert.ok(/<\/FinalDraft>\n$/.test(x));
});

test('fdx: the scene number, centred text, a page break and the forced heading', () => {
    const x = Fdx.of(FDX_SCRIPT);
    assert.includes(x, '<Paragraph Type="Scene Heading" Number="1A"><Text>INT. KITCHEN - NIGHT</Text></Paragraph>');
    assert.includes(x, '<Paragraph Type="Action" Alignment="Center"><Text>THE END</Text></Paragraph>');
    assert.includes(x, '<Paragraph Type="Action" StartsNewPage="Yes"><Text Style="Italic">Solo lyric</Text></Paragraph>',
        'the paragraph after === starts a new page (sections and synopses in between are not paragraphs)');
    assert.includes(x, '<Paragraph Type="Scene Heading"><Text>MONTAGE</Text></Paragraph>');
});

test('fdx: bold, italic and underline become styled runs; text is escaped; notes are left out', () => {
    const x = Fdx.of(FDX_SCRIPT);
    assert.includes(x, '<Text>She </Text><Text Style="Bold">waits</Text><Text> and </Text><Text Style="Underline">waits</Text><Text> and </Text><Text Style="Italic">waits</Text>');
    assert.includes(x, '3 &lt; 4 &amp; &quot;so&quot;.\nThen stops.</Text>', 'a line break inside the paragraph stays');
    assert.excludes(x, 'a note');
    assert.equal(Fdx.of('***Both*** and **_all three_**').match(/Style="([^"]+)"/g).join(), 'Style="Bold+Italic",Style="Bold+Underline"');
});

test('fdx: a speech: cue with its extension, parenthetical, dialogue; a lyric in it is italic without its ~', () => {
    const x = Fdx.of(FDX_SCRIPT);
    assert.includes(x, '<Paragraph Type="Character"><Text>BOB (V.O.)</Text></Paragraph>');
    assert.includes(x, '<Paragraph Type="Parenthetical"><Text>(beat)</Text></Paragraph>');
    assert.includes(x, '<Paragraph Type="Dialogue"><Text>Hi </Text><Text Style="Italic">there</Text><Text>.</Text></Paragraph>');
    assert.includes(x, '<Paragraph Type="Dialogue"><Text Style="Italic">A little song</Text></Paragraph>');
});

test('fdx: dual dialogue is one DualDialogue block holding both speeches', () => {
    const x = Fdx.of(FDX_SCRIPT);
    const block = x.match(/<Paragraph>\n    <DualDialogue>\n([\s\S]*?)    <\/DualDialogue>\n    <\/Paragraph>/);
    assert.ok(block, 'a DualDialogue block');
    assert.equal(fdxTypes(block[1]).join(), 'Character,Parenthetical,Dialogue,Dialogue,Character,Dialogue');
    assert.includes(block[1], '<Text>JO</Text>');
    assert.excludes(x, '^');
});

test('fdx: what does not print does not go: sections, synopses, the boneyard', () => {
    const x = Fdx.of(FDX_SCRIPT);
    ['Act Two', 'A synopsis', 'boneyard'].forEach((w) => assert.excludes(x, w));
});

test('fdx: the title page: title, credit and author centred, draft date and contact at the foot on the left', () => {
    const x = Fdx.of(FDX_SCRIPT);
    const tp = x.split('<TitlePage>')[1];
    assert.ok(tp && /<\/TitlePage>/.test(tp));
    assert.ok(/^\n    <Content>\n(      <Paragraph Alignment="Center"><Text><\/Text><\/Paragraph>\n){16}      <Paragraph Alignment="Center"><Text>Big /.test(tp), 'the title a third of the way down the page');
    assert.includes(tp, '<Paragraph Alignment="Center"><Text>Big </Text><Text Style="Italic">Fish</Text></Paragraph>');
    assert.includes(tp, '<Paragraph Alignment="Center"><Text>Me &amp; You</Text></Paragraph>');
    assert.includes(tp, '<Paragraph Alignment="Left"><Text>1 May</Text></Paragraph>');
    assert.includes(tp, '<Paragraph Alignment="Left"><Text>Me</Text></Paragraph>\n      <Paragraph Alignment="Left"><Text>555-1234</Text></Paragraph>', 'each contact line its own');
    assert.ok(tp.indexOf('Written by') < tp.indexOf('Me &amp; You') && tp.indexOf('Me &amp; You') < tp.indexOf('1 May'));
    assert.excludes(Fdx.of('INT. A - DAY\n\nx'), '<TitlePage>', 'no title page, none written');
    assert.includes(Fdx.of('Title: T\nContact: [[ask first]]\n\nx'), '<Paragraph Alignment="Left"><Text></Text></Paragraph>',
        'a title-page line with nothing left still has its (empty) text, as Final Draft writes it');
});

test('fdx: characters XML cannot hold are dropped; an empty script is still a document', () => {
    assert.includes(Fdx.of('Bell\u0007 here.'), '<Text>Bell here.</Text>');
    const empty = Fdx.of('');
    assert.includes(empty, '<Content>\n  </Content>');
    assert.includes(Fdx.of('INT. A - DAY\n\nx [[only a note]]\n\ny'), '<Paragraph Type="Action"><Text>x</Text></Paragraph>');
    assert.equal((Fdx.of('INT. A - DAY\n\n[[just a note]]\n\ny').match(/Type="Action"/g) || []).length, 1, 'a paragraph that is only a note is not written');
    assert.includes(Fdx.of('INT. A - DAY\n\n[[note]] Then words.'), '<Paragraph Type="Action"><Text>Then words.</Text></Paragraph>', 'no space left where a note began the line');
});
