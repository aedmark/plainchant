const QUICK_HOLD = 500;
const QUICK_SLOP = 10;
let quick = null;
let quickHold = null;
let quickHeld = false;

function quickLine(el) {
    const at = el && el.closest ? el.closest('[data-line]') : null;
    return at && previewShown().contains(at) ? at : null;
}

function placeQuickEdit(box, anchor) {
    const rt = renderTarget.getBoundingClientRect();
    const sheet = anchor.closest('.print-page');
    let left, width;
    if (sheet) {
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

function openQuickEdit(el) {
    closeQuickEdit(true);
    if (!el) return;
    const para = Editing.paragraphAt(editor.value, Number(el.dataset.line));
    if (para.start === para.end) return;
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
    field.addEventListener('blur', () => closeQuickEdit(true));
    field.focus({ preventScroll: true });
    field.setSelectionRange(field.value.length, field.value.length);
}

function closeQuickEdit(keep) {
    if (!quick) return;
    const q = quick;
    quick = null;
    const text = q.field.value.replace(/\r\n?/g, '\n');
    q.box.remove();
    if (!keep || text === q.original) return;
    if (editor.value.slice(q.start, q.end) !== q.original) {
        showNotice('The script changed while you were editing that paragraph, so your quick edit was not kept.', true);
        return;
    }
    const next = editor.value.slice(0, q.start) + text + editor.value.slice(q.end);
    const hidden = editor.offsetParent === null;
    if (hidden) document.body.classList.add('quick-applying');
    try { applyEdit(Editing.diffEdit(editor.value, next, editor.selectionStart, editor.selectionEnd), { keepFocus: true }); }
    finally { document.body.classList.remove('quick-applying'); }
    if (hidden) editor.blur();
}

function endHold() {
    if (quickHold) clearTimeout(quickHold.timer);
    quickHold = null;
}

renderTarget.addEventListener('dblclick', (e) => {
    const at = quickLine(e.target);
    if (!at) return;
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    openQuickEdit(at);
});
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
document.addEventListener('click', (e) => {
    if (!quickHeld) return;
    quickHeld = false;
    e.preventDefault();
    e.stopImmediatePropagation();
}, true);
