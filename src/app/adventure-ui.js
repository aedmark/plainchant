/*
 * Plainchant app script: adventure-ui: in the retro theme, old parser commands get an answer (P4-20)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// A small joke for the retro theme (D-041, D-042): press Enter on "look", "inventory", "xyzzy"... typed alone in a
// paragraph of its own, and the notice at the foot of the screen answers, the way a 1980s adventure game would. It
// never changes the text or what Enter does: it listens first (capture, on the document, before typing.js rewrites
// the line), only reads, and shows the answer once Enter has done its work. Not in the other themes, not for a
// character's name (a character called LOOK), not on a line the writer made a character, not inside a speech.

// What the app knows where the caret is. Global on purpose: the e2e tests call it.
function adventureFacts(text, lineNo) {
    const s = Stats.of(text, { paper: paperChoice() });
    let scene = null;
    s.sceneList.forEach((sc) => { if (sc.line <= lineNo) scene = sc; });
    return {
        scene: scene ? scene.text : null,
        characters: scene ? scene.characters : [],
        words: s.words,
        scripts: Library.active(getScripts()).length,
        pages: s.pages
    };
}

function adventureReplyFor(e) {
    if (e.target !== editor || applyingEdit || e.isComposing || shiftDown) return null;
    if (e.inputType !== 'insertLineBreak' && e.inputType !== 'insertParagraph') return null;
    if (themeShown() !== 'retro' || (elementMode && elementMode !== 'action')) return null;
    const text = editor.value, at = editor.selectionStart;
    if (at !== editor.selectionEnd) return null;
    const start = text.lastIndexOf('\n', at - 1) + 1;
    const end = text.indexOf('\n', at) === -1 ? text.length : text.indexOf('\n', at);
    if (text.slice(at, end).trim()) return null; // Enter in the middle of a line splits it: not a command
    const key = Adventure.command(text.slice(start, end));
    if (!key) return null;
    if (start > 0 && text.slice(text.lastIndexOf('\n', start - 2) + 1, start - 1).trim()) return null; // inside a block
    const typed = text.slice(start, end).trim().toUpperCase();
    if (Suggest.names(text).indexOf(typed) !== -1) return null; // a character of that name
    return Adventure.reply(key, adventureFacts(text, text.slice(0, start).split('\n').length - 1));
}

// --- Wiring ---
document.addEventListener('beforeinput', (e) => {
    const answer = adventureReplyFor(e);
    if (answer) setTimeout(() => showNotice(answer), 0);
}, true);
