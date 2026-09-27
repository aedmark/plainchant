/*
 * Plainchant app script: chapters-ui: video chapters in the Export dialog (P3-13), timed by narration (P4-18)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// The rules are in src/narration.js: one chapter per top-level section, each starting at the words read aloud before
// it, at the reading speed and with what is read aloud as chosen in Settings (D-038). YouTube only shows chapters
// that follow its rules, so the dialog says which ones a list breaks; it never changes the list to fit them.
const chaptersList = document.getElementById('chaptersList');
const chaptersWarn = document.getElementById('chaptersWarn');
const chaptersCopy = document.getElementById('chaptersCopy');
let chaptersText = ''; // what Copy chapters copies

// Global on purpose: stats-ui.js uses these two for the read-aloud time
function narrationOf(text) {
    return Narration.of(text, { pace: settings.pace, aloud: settings.aloud });
}

// "the dialogue at 150 words a minute": how the read-aloud time is worked out, as the stats and Export say it
function narrationHow() {
    return (settings.aloud === 'all' ? 'the dialogue and action' : 'the dialogue') + ' at ' + settings.pace + ' words a minute';
}

function chaptersWarning(text) {
    chaptersWarn.appendChild(document.createElement('li')).textContent = text; // titles are the writer's text
}

// Called by openExport (export.js) every time the dialog opens
function prepareChapters() {
    const n = narrationOf(editor.value);
    chaptersText = Narration.chapterList(n.chapters);
    chaptersList.textContent = chaptersText;
    chaptersList.hidden = !n.chapters.length;
    chaptersCopy.hidden = !n.chapters.length;
    document.getElementById('chaptersExample').hidden = !!n.chapters.length; // with no chapters, an example instead
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

// --- Wiring ---
chaptersCopy.addEventListener('click', async () => {
    const ok = await copyText(chaptersText);
    flashButton(chaptersCopy, ok ? 'Copied!' : 'Copy failed', ok);
});
