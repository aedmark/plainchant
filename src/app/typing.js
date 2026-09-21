/*
 * Plainchant app script: typing: Tab, smart Enter, auto-uppercase and the element bar (the rules are in src/editing.js)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// --- Typing helpers (P2-01..P2-03, P2-11). What to do is decided by src/editing.js; this applies it. ---
// elementMode is the element chosen for a line that has no text yet ('character' | 'scene' | 'transition'):
// a blank line cannot say what it is, so the page remembers, and uppercases what is typed on that line.
let elementMode = null;
let modeLine = -1;
let applyingEdit = false;   // our own edits fire input events; don't react to them as if the writer typed
let tabReleased = false;    // Esc then Tab lets keyboard users leave the editor
let shiftDown = false;
const elementBar = document.querySelector('.element-bar');
const elementButtons = Array.from(elementBar.querySelectorAll('.el-btn'));
const AUTO_CASE_INPUTS = ['insertText', 'insertReplacementText']; // typing, never paste / undo / composition

function caretLine() {
    return editor.value.slice(0, editor.selectionStart).split('\n').length - 1;
}

// Replace part of the text the way typing would, so Ctrl/Cmd+Z undoes it. Assigning editor.value or using
// setRangeText would wipe the undo history; execCommand keeps it (deprecated but universal, and the only way).
// options.keepFocus: change the text without leaving the control the writer is in (a dialog). The editor has to
// be focused for execCommand to work, so it is focused briefly with the on-screen keyboard suppressed
// (inputmode="none"), then focus goes back.
function applyEdit(edit, options = {}) {
    const before = editor.value;
    const expected = before.slice(0, edit.from) + edit.insert + before.slice(edit.to);
    const previous = document.activeElement;
    applyingEdit = true;
    try {
        if (options.keepFocus) editor.inputMode = 'none';
        editor.focus({ preventScroll: true });
        editor.setSelectionRange(edit.from, edit.to);
        let done = false;
        try { done = document.execCommand('insertText', false, edit.insert); } catch (e) { done = false; }
        if (!done || editor.value !== expected) {
            editor.value = expected; // last resort (no undo): still leaves the text correct
            editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        editor.setSelectionRange(edit.selStart, edit.selEnd);
    } finally {
        applyingEdit = false;
        if (options.keepFocus) {
            editor.inputMode = '';
            if (previous && previous !== editor && document.contains(previous)) previous.focus({ preventScroll: true });
        }
    }
}

function commitElement(result) {
    if (result.edit) applyEdit(result.edit);
    else editor.focus({ preventScroll: true });
    elementMode = result.mode;
    modeLine = caretLine();
    syncElementState();
}

function setElement(target) {
    const r = Editing.setType(editor.value, editor.selectionStart, target, elementMode);
    if (r) commitElement({ edit: r.edit, mode: r.mode });
}

function cycleElement(direction) {
    const r = Editing.tab(editor.value, editor.selectionStart, direction, elementMode);
    if (r) commitElement(r);
}

// Highlight what the current line is (or, on a blank line, what it is set to become)
let syncQueued = false;
function syncElementState() {
    syncQueued = false;
    const idx = caretLine();
    if (elementMode && idx !== modeLine) elementMode = null;
    let kind = Editing.kindAt(editor.value, idx);
    if (kind === 'blank') kind = elementMode || (Editing.inDialogueBlock(editor.value, idx) ? 'dialogue' : 'action');
    elementButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.el === kind)));
}
function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(syncElementState);
}

elementBar.addEventListener('mousedown', (e) => e.preventDefault()); // a tap must not pull focus (and the keyboard) away
elementBar.addEventListener('click', (e) => {
    const button = e.target.closest('.el-btn');
    if (button) setElement(button.dataset.el);
});

editor.addEventListener('keydown', (e) => {
    shiftDown = e.shiftKey;
    if (e.isComposing) return;
    if (e.key === 'Escape') { tabReleased = true; return; }
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (tabReleased) { tabReleased = false; return; } // Esc, Tab: move focus on as usual
        e.preventDefault();
        cycleElement(e.shiftKey ? -1 : 1);
        return;
    }
    if (e.key !== 'Shift') tabReleased = false;
});
editor.addEventListener('keyup', (e) => { shiftDown = e.shiftKey; scheduleSync(); });
editor.addEventListener('blur', () => { tabReleased = false; shiftDown = false; });
['click', 'focus', 'pointerup'].forEach((name) => editor.addEventListener(name, scheduleSync));

// Enter. beforeinput rather than keydown: on-screen keyboards often send keydown as "Unidentified" but always
// announce the line break here. Shift+Enter is left alone, for a plain line break inside an element.
editor.addEventListener('beforeinput', (e) => {
    if (applyingEdit || e.isComposing) return;
    if (e.inputType !== 'insertLineBreak' && e.inputType !== 'insertParagraph') return;
    if (shiftDown) return;
    const edit = Editing.enter(editor.value, editor.selectionStart, editor.selectionEnd, elementMode);
    if (!edit) return;
    e.preventDefault();
    applyEdit(edit);
    elementMode = null;
    syncElementState();
});

// Rendering is handled by src/fountain.js (see D-003); render() is defined above.
editor.addEventListener('input', (e) => {
    if (!applyingEdit && !e.isComposing && AUTO_CASE_INPUTS.indexOf(e.inputType) !== -1) {
        const edit = Editing.autoCase(editor.value, editor.selectionStart, elementMode);
        if (edit) applyEdit(edit);
    }
    render();
    scheduleSync();

    // Quietly auto-save after 2 seconds of typing inactivity
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        if (editor.value.trim()) {
            saveScript(true);
        }
    }, 2000);
});
