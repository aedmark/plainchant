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
    syncSuggestions();
}
function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(syncElementState);
}

// --- Autocomplete (P2-04, D-017). What to suggest is decided by src/suggest.js; this shows it and applies it. ---
// While a name is being typed the suggestions take the place of the element buttons in the same bar (same height,
// so nothing moves, and nothing covers the line being typed). Tab takes the first one; Enter never does.
const suggestBox = elementBar.querySelector('.suggestions');
let suggestion = null;      // the Suggest.at() result while chips are showing
let dismissedFor = '';      // the word Esc waved away; a different word (or line) brings suggestions back

function suggestionKey(hit) {
    return caretLine() + ':' + editor.value.slice(hit.from, hit.to);
}

function showSuggestions(hit) {
    const same = suggestion && hit && suggestion.options.join('\n') === hit.options.join('\n');
    suggestion = hit;
    if (same) return;
    suggestBox.hidden = !hit;
    elementBar.classList.toggle('suggesting', !!hit);
    suggestBox.replaceChildren(...(hit ? hit.options : []).map((option, i) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'suggest-chip';
        chip.dataset.index = String(i);
        chip.textContent = option;
        return chip;
    }));
}

function syncSuggestions() {
    let hit = null;
    if (document.activeElement === editor && editor.selectionStart === editor.selectionEnd) hit = Suggest.at(editor.value, editor.selectionStart);
    const key = hit ? suggestionKey(hit) : '';
    if (key !== dismissedFor) dismissedFor = '';   // Esc only holds while the caret stays on that word
    showSuggestions(hit && key !== dismissedFor ? hit : null);
}

function acceptSuggestion(index) {
    if (!suggestion || !suggestion.options[index]) return;
    applyEdit(Suggest.edit(suggestion, suggestion.options[index]));
    syncElementState();
}

elementBar.addEventListener('mousedown', (e) => e.preventDefault()); // a tap must not pull focus (and the keyboard) away
elementBar.addEventListener('click', (e) => {
    const chip = e.target.closest('.suggest-chip');
    if (chip) { acceptSuggestion(Number(chip.dataset.index)); return; }
    const button = e.target.closest('.el-btn');
    if (button) setElement(button.dataset.el);
});

editor.addEventListener('keydown', (e) => {
    shiftDown = e.shiftKey;
    if (e.isComposing) return;
    if (e.key === 'Escape') {
        if (suggestion) { dismissedFor = suggestionKey(suggestion); syncSuggestions(); } // dismisses only; a second Esc frees Tab
        else tabReleased = true;
        return;
    }
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (tabReleased) { tabReleased = false; return; } // Esc, Tab: move focus on as usual
        e.preventDefault();
        if (!e.shiftKey) {
            syncSuggestions(); // the bar is refreshed on the next frame; Tab may arrive before it
            if (suggestion) { acceptSuggestion(0); return; }
        }
        cycleElement(e.shiftKey ? -1 : 1);
        return;
    }
    if (e.key !== 'Shift') tabReleased = false;
});
editor.addEventListener('keyup', (e) => { shiftDown = e.shiftKey; scheduleSync(); });
editor.addEventListener('blur', () => { tabReleased = false; shiftDown = false; dismissedFor = ''; showSuggestions(null); });
['click', 'focus', 'pointerup'].forEach((name) => editor.addEventListener(name, scheduleSync));

// Enter. beforeinput rather than keydown: on-screen keyboards often send keydown as "Unidentified" but always
// announce the line break here. Shift+Enter is left alone, for a plain line break inside an element.
editor.addEventListener('beforeinput', (e) => {
    if (applyingEdit || e.isComposing) return;
    if (e.inputType !== 'insertLineBreak' && e.inputType !== 'insertParagraph') return;
    if (shiftDown) return;
    // The writer's settings (settings.js). The script's names are only read if a line might be a cue (P2-14).
    const text = editor.value;
    const edit = Editing.enter(text, editor.selectionStart, editor.selectionEnd, elementMode, {
        paragraphs: settings.paragraphs,
        cues: settings.cues ? { get names() { return Suggest.names(text); } } : null
    });
    if (!edit) return;
    e.preventDefault();
    applyEdit(edit);
    elementMode = null;
    syncElementState();
});

// Rendering is handled by src/fountain.js (see D-003); render() is defined above.
editor.addEventListener('input', (e) => {
    if (!applyingEdit && !e.isComposing && AUTO_CASE_INPUTS.indexOf(e.inputType) !== -1) {
        const edit = Editing.autoCase(editor.value, editor.selectionStart, elementMode, { guess: settings.capitals });
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
