const FOCUS_KEY = 'plainchant_focus';
const focusBtn = document.getElementById('focusBtn');
const paneVoid = document.querySelector('.pane-void');
const veilAbove = document.createElement('div');
const veilBelow = document.createElement('div');
veilAbove.className = veilBelow.className = 'focus-veil';
veilAbove.setAttribute('aria-hidden', 'true');
veilBelow.setAttribute('aria-hidden', 'true');
paneVoid.append(veilAbove, veilBelow);

let focusOn = false;
let pointerHeld = false;

function updateFocus(recentre) {
    if (!focusOn || editor.offsetParent === null) return;
    const caret = editor.selectionEnd;
    const block = Editing.blockAt(editor.value, caret);
    const text = editor.value.slice(block.start, block.end);
    const lh = lineHeightPx();
    const padTop = parseFloat(getComputedStyle(editor).paddingTop);
    const top = textAbovePx(block.start);
    const bottom = top + textTopIn(text, text.length) + lh;
    if (recentre) {
        const caretY = padTop + top + textTopIn(text, caret - block.start);
        editor.scrollTop = caretY + lh / 2 - editor.clientHeight / 2;
    }
    const y0 = editor.offsetTop, y1 = editor.offsetTop + editor.clientHeight;
    const blockY0 = Math.min(y1, Math.max(y0, y0 + padTop + top - editor.scrollTop));
    const blockY1 = Math.min(y1, Math.max(y0, y0 + padTop + bottom - editor.scrollTop));
    const place = (veil, from, to) => {
        veil.style.top = from + 'px';
        veil.style.height = Math.max(0, to - from) + 'px';
        veil.style.left = editor.offsetLeft + 'px';
        veil.style.width = editor.clientWidth + 'px';
    };
    place(veilAbove, y0, blockY0);
    place(veilBelow, blockY1, y1);
}

function setFocusMode(on) {
    focusOn = !!on;
    document.body.classList.toggle('focus-mode', focusOn);
    focusBtn.setAttribute('aria-pressed', String(focusOn));
    try { if (focusOn) localStorage.setItem(FOCUS_KEY, '1'); else localStorage.removeItem(FOCUS_KEY); } catch (e) {
    }
    if (focusOn) updateFocus(true);
}

function restoreFocusMode() {
    let saved = null;
    try { saved = localStorage.getItem(FOCUS_KEY); } catch (e) {
    }
    if (saved === '1') setFocusMode(true);
}

focusBtn.addEventListener('click', () => setFocusMode(!focusOn));
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setFocusMode(!focusOn);
    }
});
editor.addEventListener('input', () => updateFocus(true));
editor.addEventListener('scroll', () => updateFocus(false));
editor.addEventListener('pointerdown', () => { pointerHeld = true; });
document.addEventListener('pointerup', () => {
    if (!pointerHeld) return;
    pointerHeld = false;
    if (document.activeElement === editor && editor.selectionStart === editor.selectionEnd) updateFocus(true);
});
document.addEventListener('selectionchange', () => {
    if (focusOn && !pointerHeld && document.activeElement === editor && editor.selectionStart === editor.selectionEnd) updateFocus(true);
});
window.addEventListener('resize', () => updateFocus(true));
