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
    const visible = (el) => el && el !== document.body && document.contains(el) && el.getClientRects().length > 0;
    const back = [entry.opener, menuBtn, editor].find(visible);
    if (back) back.focus({ preventScroll: true });
}

document.addEventListener('keydown', (e) => {
    if (!openModals.length) return;
    const top = openModals[openModals.length - 1].overlay;
    if (e.key === 'Escape') {
        if (e.target.closest && e.target.closest('[data-esc-local]')) return;
        e.preventDefault();
        e.stopPropagation();
        closeModal(top);
    } else if (e.key === 'Tab') {
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
    if (e.target.classList && e.target.classList.contains('modal-overlay')) { closeModal(e.target); return; }
    const closer = e.target.closest('[data-close]');
    if (closer) closeModal(closer.closest('.modal-overlay'));
});
