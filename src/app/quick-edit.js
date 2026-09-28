/*
 * Plainchant app script: quick-edit: touch up a paragraph in the preview, without going back to the text (P2-24)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// Double-click a line of the preview (on a touch screen, press and hold) and its paragraph opens in place: a small
// box over it holding that paragraph's own Fountain lines (Editing.paragraphAt; every line of the preview and of the
// page view carries its source line). Enter, or clicking away, puts the change into the script as one edit, through
// applyEdit (typing.js), so Ctrl/Cmd+Z in the editor undoes it; Shift+Enter is a new line; Esc leaves it as it was.
// The script's text stays the one source of truth: the box is not the preview, and nothing here writes to the preview
// (drawPreview and drawPages redraw it from the edited text). With the editor hidden (the preview alone, or Preview
// on a phone) it is shown off-screen for the moment of the edit, so the edit still goes through the editor's undo (D-057).
const QUICK_HOLD = 500;   // ms: press and hold, on a touch screen
const QUICK_SLOP = 10;    // px a finger may move and still be holding
let quick = null;         // the open quick edit: { box, field, start, end, original }
let quickHold = null;     // { timer, x, y, at } while a finger is held down
let quickHeld = false;    // a hold just opened a quick edit: the click that follows is not a tap

// The line of the preview that `el` is in, if it is one the writer can edit (the title page of the sheets is not)
function quickLine(el) {
    const at = el && el.closest ? el.closest('[data-line]') : null;
    return at && previewShown().contains(at) ? at : null;
}

// Where the box goes: over the paragraph's first line, across the preview's column (or the sheet's text)
function placeQuickEdit(box, anchor) {
    const rt = renderTarget.getBoundingClientRect();
    const sheet = anchor.closest('.print-page');
    let left, width;
    if (sheet) { // 1.5 inches in from the sheet's left edge, 6 inches of text (D-021)
        const r = sheet.getBoundingClientRect();
        const inches = sheet.classList.contains('a4') ? 8.27 : 8.5;
        left = r.left + r.width * 1.5 / inches;
        width = r.width * 6 / inches;
    } else {
        const r = page.getBoundingClientRect();
        left = r.left;
        width = r.width;
    }
    box.style.top = Math.max(0, anchor.getBoundingClientRect().top - rt.top + renderTarget.scrollTop - 8) + 'px';
    box.style.left = (left - rt.left + renderTarget.scrollLeft - 8) + 'px';
    box.style.width = (width + 16) + 'px';
}

// Opens the paragraph of the preview line `el`. Global on purpose: the e2e tests call it.
function openQuickEdit(el) {
    closeQuickEdit(true);
    if (!el) return;
    const para = Editing.paragraphAt(editor.value, Number(el.dataset.line));
    if (para.start === para.end) return; // a blank line, or a blank script (the preview is showing the example)
    const original = editor.value.slice(para.start, para.end);
    const box = document.createElement('div');
    box.className = 'quick-edit';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Quick edit');
    const field = document.createElement('textarea');
    field.className = 'quick-edit-field';
    field.value = original;
    field.setAttribute('aria-label', 'The script lines of this paragraph');
    field.setAttribute('aria-describedby', 'quickEditHint');
    const hint = document.createElement('p');
    hint.className = 'quick-edit-hint';
    hint.id = 'quickEditHint';
    hint.textContent = 'Enter keeps the change · Shift+Enter starts a new line · Esc leaves it as it was';
    box.append(field, hint);
    renderTarget.appendChild(box);
    placeQuickEdit(box, previewShown().querySelector('[data-line="' + para.first + '"]') || el);
    quick = { box: box, field: field, start: para.start, end: para.end, original: original };
    const fit = () => { field.style.height = 'auto'; field.style.height = field.scrollHeight + 'px'; };
    fit();
    field.addEventListener('input', fit);
    field.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); closeQuickEdit(true); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeQuickEdit(false); }
    });
    field.addEventListener('blur', () => closeQuickEdit(true)); // clicking away keeps it
    field.focus({ preventScroll: true });
    field.setSelectionRange(field.value.length, field.value.length);
}

// Closes the box; `keep` puts its text into the script. Global on purpose: the e2e tests call it.
function closeQuickEdit(keep) {
    if (!quick) return;
    const q = quick;
    quick = null;
    const text = q.field.value.replace(/\r\n?/g, '\n');
    q.box.remove();
    if (!keep || text === q.original) return;
    if (editor.value.slice(q.start, q.end) !== q.original) { // changed meanwhile (another tab, a file loaded)
        showNotice('The script changed while you were editing that paragraph, so your quick edit was not kept.', true);
        return;
    }
    const next = editor.value.slice(0, q.start) + text + editor.value.slice(q.end);
    const hidden = editor.offsetParent === null;
    if (hidden) document.body.classList.add('quick-applying'); // the editor must be there to take an undoable edit
    try { applyEdit(Editing.diffEdit(editor.value, next, editor.selectionStart, editor.selectionEnd), { keepFocus: true }); }
    finally { document.body.classList.remove('quick-applying'); }
    if (hidden) editor.blur();
}

function endHold() {
    if (quickHold) clearTimeout(quickHold.timer);
    quickHold = null;
}

// --- Wiring ---
renderTarget.addEventListener('dblclick', (e) => {
    const at = quickLine(e.target);
    if (!at) return;
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges(); // a double-click also selects a word
    openQuickEdit(at);
});
// Press and hold, on a touch screen (a mouse double-clicks). A tap still goes to the line (layout.js).
renderTarget.addEventListener('pointerdown', (e) => {
    quickHeld = false;
    endHold();
    const at = e.pointerType !== 'mouse' ? quickLine(e.target) : null;
    if (!at) return;
    quickHold = { x: e.clientX, y: e.clientY, at: at, timer: setTimeout(() => {
        const held = quickHold;
        quickHold = null;
        quickHeld = true;
        openQuickEdit(held.at);
    }, QUICK_HOLD) };
});
renderTarget.addEventListener('pointermove', (e) => {
    if (quickHold && Math.hypot(e.clientX - quickHold.x, e.clientY - quickHold.y) > QUICK_SLOP) endHold();
});
['pointerup', 'pointercancel', 'scroll'].forEach((type) => renderTarget.addEventListener(type, endHold));
renderTarget.addEventListener('contextmenu', (e) => { if (quickHeld || quickHold) e.preventDefault(); });
document.addEventListener('click', (e) => { // the release of a hold is not a tap on the line (layout.js)
    if (!quickHeld) return;
    quickHeld = false;
    e.preventDefault();
    e.stopImmediatePropagation();
}, true);
