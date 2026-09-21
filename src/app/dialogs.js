/*
 * Plainchant app script: dialogs: one accessible helper for every modal window
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// --- Dialogs: one helper for every modal window ---
// Focus moves into the dialog and stays there (Tab wraps), Esc or a click on the backdrop closes it, and focus
// goes back to whatever opened it. Dialogs can stack (Help opened over the tour, say); Esc closes the top one.
const openModals = [];
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(el) {
    return Array.from(el.querySelectorAll(FOCUSABLE)).filter((n) => !n.hidden && n.getClientRects().length > 0);
}

function openModal(overlay, options = {}) {
    if (openModals.some((m) => m.overlay === overlay)) return;
    openModals.push({ overlay: overlay, opener: document.activeElement, onClose: options.onClose });
    overlay.classList.add('active');
    const target = (options.focus && overlay.querySelector(options.focus)) || focusableIn(overlay)[0];
    if (target) target.focus({ preventScroll: true });
}

function closeModal(overlay) {
    const i = openModals.findIndex((m) => m.overlay === overlay);
    if (i === -1) return;
    const entry = openModals.splice(i, 1)[0];
    overlay.classList.remove('active');
    if (entry.onClose) entry.onClose();
    // Return focus to what opened the dialog. If that was an item in the phone menu it is hidden again by now,
    // so fall back to the menu button, then the editor.
    const visible = (el) => el && el !== document.body && document.contains(el) && el.getClientRects().length > 0;
    const back = [entry.opener, menuBtn, editor].find(visible);
    if (back) back.focus({ preventScroll: true });
}

document.addEventListener('keydown', (e) => {
    if (!openModals.length) return;
    const top = openModals[openModals.length - 1].overlay;
    if (e.key === 'Escape') {
        // Esc inside an inline field (renaming a script) cancels that edit, not the whole dialog
        if (e.target.closest && e.target.closest('[data-esc-local]')) return;
        e.preventDefault();
        e.stopPropagation();
        closeModal(top);
    } else if (e.key === 'Tab') {
        // Keep Tab inside the dialog, and away from the editor's own Tab handling
        e.stopPropagation();
        const items = focusableIn(top);
        if (!items.length) { e.preventDefault(); return; }
        const first = items[0], last = items[items.length - 1];
        if (!top.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
}, true);

document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('modal-overlay')) { closeModal(e.target); return; } // backdrop
    const closer = e.target.closest('[data-close]');
    if (closer) closeModal(closer.closest('.modal-overlay'));
});
