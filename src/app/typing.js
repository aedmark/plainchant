let elementMode = null;
let modeLine = -1;
let applyingEdit = false;
let tabReleased = false;
let shiftDown = false;
const elementBar = document.querySelector('.element-bar');
const elementButtons = Array.from(elementBar.querySelectorAll('.el-btn'));
const AUTO_CASE_INPUTS = ['insertText', 'insertReplacementText'];

function caretLine() {
    return editor.value.slice(0, editor.selectionStart).split('\n').length - 1;
}

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
            editor.value = expected;
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

const suggestBox = elementBar.querySelector('.suggestions');
const suggestSay = document.getElementById('suggestSay');
const SUGGEST_WHAT = { character: 'Names', location: 'Places', time: 'Times of day' };
let suggestion = null;
let dismissedFor = '';

function suggestionKey(hit) {
    return caretLine() + ':' + editor.value.slice(hit.from, hit.to);
}

function showSuggestions(hit) {
    const same = suggestion && hit && suggestion.options.join('\n') === hit.options.join('\n');
    suggestion = hit;
    if (same) return;
    suggestBox.hidden = !hit;
    suggestBox.classList.toggle('no-tab', !!hit && hit.tab === false);
    elementBar.classList.toggle('suggesting', !!hit);
    suggestSay.textContent = hit ? SUGGEST_WHAT[hit.kind] + ': ' + hit.options.join(', ') + '.' +
        (hit.tab === false ? '' : ' Tab takes ' + hit.options[0] + '.') : '';
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
    if (document.activeElement === editor && editor.selectionStart === editor.selectionEnd) {
        hit = Suggest.at(editor.value, editor.selectionStart, elementMode);
    }
    const key = hit ? suggestionKey(hit) : '';
    if (key !== dismissedFor) dismissedFor = '';
    showSuggestions(hit && key !== dismissedFor ? hit : null);
}

function acceptSuggestion(index) {
    if (!suggestion || !suggestion.options[index]) return;
    applyEdit(Suggest.edit(suggestion, suggestion.options[index]));
    syncElementState();
}

elementBar.addEventListener('mousedown', (e) => e.preventDefault());
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
        if (suggestion) { dismissedFor = suggestionKey(suggestion); syncSuggestions(); } else tabReleased = true;
        return;
    }
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (tabReleased) { tabReleased = false; return; }
        e.preventDefault();
        if (!e.shiftKey) {
            syncSuggestions();
            if (suggestion && suggestion.tab !== false) { acceptSuggestion(0); return; }
        }
        cycleElement(e.shiftKey ? -1 : 1);
        return;
    }
    if (e.key !== 'Shift') tabReleased = false;
});
editor.addEventListener('keyup', (e) => { shiftDown = e.shiftKey; scheduleSync(); });
editor.addEventListener('blur', () => { tabReleased = false; shiftDown = false; dismissedFor = ''; showSuggestions(null); });
['click', 'focus', 'pointerup'].forEach((name) => editor.addEventListener(name, scheduleSync));

editor.addEventListener('beforeinput', (e) => {
    if (applyingEdit || e.isComposing) return;
    if (e.inputType !== 'insertLineBreak' && e.inputType !== 'insertParagraph') return;
    if (shiftDown) return;
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

editor.addEventListener('input', (e) => {
    if (!applyingEdit && !e.isComposing && AUTO_CASE_INPUTS.indexOf(e.inputType) !== -1) {
        const edit = Editing.autoCase(editor.value, editor.selectionStart, elementMode, { guess: settings.capitals });
        if (edit) applyEdit(edit);
    }
    render(true);
    scheduleSync();

    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        if (editor.value.trim()) {
            saveScript(true);
        }
    }, 2000);
});
