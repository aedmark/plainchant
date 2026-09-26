/*
 * Plainchant app script: focus: focus mode (P2-07): everything but the current block dimmed, the caret kept centred
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// The editor is a plain textarea, which cannot style part of its text. So the dimming is two translucent veils laid
// over it, above and below the block the caret is in (Editing.blockAt), and the text itself is never touched: typing,
// undo, selection and the on-screen keyboard behave exactly as without focus mode. Typing or moving the caret scrolls
// the caret's line to the middle; scrolling by hand is left alone. Only the block is measured on each change: the
// height of the text above it is kept until that text changes (textAbovePx in layout.js).
const FOCUS_KEY = 'plainchant_focus';   // '1' while focus mode is on, remembered per browser
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

// Puts the veils around the current block and, if asked, scrolls the caret's line to the middle.
// Global on purpose: the e2e tests call it.
function updateFocus(recentre) {
    if (!focusOn || editor.offsetParent === null) return; // off, or the editor is hidden (previewing on a phone)
    const caret = editor.selectionEnd;
    const block = Editing.blockAt(editor.value, caret);
    const text = editor.value.slice(block.start, block.end);
    const lh = lineHeightPx();
    const padTop = parseFloat(getComputedStyle(editor).paddingTop);
    const top = textAbovePx(block.start); // cached while the text above the block is unchanged (layout.js)
    const bottom = top + textTopIn(text, text.length) + lh;
    if (recentre) {
        const caretY = padTop + top + textTopIn(text, caret - block.start);
        editor.scrollTop = caretY + lh / 2 - editor.clientHeight / 2; // the browser keeps it in range
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

// Global on purpose: the e2e tests call it
function setFocusMode(on) {
    focusOn = !!on;
    document.body.classList.toggle('focus-mode', focusOn);
    focusBtn.setAttribute('aria-pressed', String(focusOn));
    try { if (focusOn) localStorage.setItem(FOCUS_KEY, '1'); else localStorage.removeItem(FOCUS_KEY); } catch (e) { /* not remembered */ }
    if (focusOn) updateFocus(true);
}

function restoreFocusMode() {
    let saved = null;
    try { saved = localStorage.getItem(FOCUS_KEY); } catch (e) { /* storage unavailable */ }
    if (saved === '1') setFocusMode(true);
}

// --- Wiring ---
focusBtn.addEventListener('click', () => setFocusMode(!focusOn)); // the element bar keeps the caret in the editor (typing.js)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setFocusMode(!focusOn);
    }
});
editor.addEventListener('input', () => updateFocus(true));
editor.addEventListener('scroll', () => updateFocus(false)); // scrolling by hand moves the veils, never the text
editor.addEventListener('pointerdown', () => { pointerHeld = true; });
document.addEventListener('pointerup', () => {
    if (!pointerHeld) return;
    pointerHeld = false;
    if (document.activeElement === editor && editor.selectionStart === editor.selectionEnd) updateFocus(true);
});
// Arrow keys, Home / End, Page Up / Down and the rest move the caret without typing: follow them. Not while a
// pointer is down (dragging a selection must not scroll away under the mouse), nor for a selection.
document.addEventListener('selectionchange', () => {
    if (focusOn && !pointerHeld && document.activeElement === editor && editor.selectionStart === editor.selectionEnd) updateFocus(true);
});
window.addEventListener('resize', () => updateFocus(true)); // a new width is a new cache key (layout.js)
