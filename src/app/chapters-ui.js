const chaptersList = document.getElementById('chaptersList');
const chaptersWarn = document.getElementById('chaptersWarn');
const chaptersCopy = document.getElementById('chaptersCopy');
let chaptersText = '';

function narrationOf(text) {
    return Narration.of(text, { pace: settings.pace, aloud: settings.aloud });
}

function narrationHow() {
    return (settings.aloud === 'all' ? 'the dialogue and action' : 'the dialogue') + ' at ' + settings.pace + ' words a minute';
}

function chaptersWarning(text) {
    chaptersWarn.appendChild(document.createElement('li')).textContent = text;
}

function prepareChapters() {
    const n = narrationOf(editor.value);
    chaptersText = Narration.chapterList(n.chapters);
    chaptersList.textContent = chaptersText;
    chaptersList.hidden = !n.chapters.length;
    chaptersCopy.hidden = !n.chapters.length;
    document.getElementById('chaptersExample').hidden = !!n.chapters.length;
    document.getElementById('chaptersPace').textContent = 'Read aloud: ' + Narration.clock(n.seconds) +
        ', counting ' + narrationHow() + ' (change it in Settings).';

    chaptersWarn.textContent = '';
    if (!n.chapters.length) {
        chaptersWarning('No chapters yet: start each part with a section, a line such as # The crash site. Sections mark the parts; they are never printed.');
    } else {
        if (n.few) chaptersWarning('YouTube shows chapters only when there are at least three.');
        if (!n.words) chaptersWarning('Nothing is read aloud yet, so every chapter starts at 0:00. ' +
            (settings.aloud === 'all' ? 'Dialogue and action are counted.' : 'Only dialogue is counted: Settings can count the action too.'));
        else n.short.forEach((i) => {
            const c = n.chapters[i];
            chaptersWarning('YouTube needs every chapter to last at least ten seconds: “' + c.title + '” lasts ' + Narration.clock(c.seconds) + '.');
        });
    }
    chaptersWarn.hidden = !chaptersWarn.children.length;
}

chaptersCopy.addEventListener('click', async () => {
    const ok = await copyText(chaptersText);
    flashButton(chaptersCopy, ok ? 'Copied!' : 'Copy failed', ok);
});
