/*
 * Plainchant app script: panes: on a desktop, the editor and the preview side by side, or either one alone (P2-23)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// Phones and tablets already show one pane at a time, with Write | Preview in the top bar (layout.js, D-009). Where
// both panes fit, the writer chooses: both, the editor alone (its text held to a readable width in the middle) or
// the preview alone (the editor's action buttons stay above it). The three buttons sit in the preview's header; with
// the preview hidden they move to the editor's header, the one left showing. Ctrl/Cmd+Shift+1, 2 and 3 do the same
// (on a phone or tablet, 1 and 3 switch Write and Preview). The choice is remembered with the settings (`panes`), and
// body[data-panes] is set only where both panes could show, so the one-pane layout never sees it (D-056).
const panesSwitch = document.getElementById('panesSwitch');
const panesButtons = Array.from(panesSwitch.querySelectorAll('button[data-panes]'));
const canvasTools = document.querySelector('.canvas-tools');
const voidButtons = document.querySelector('.pane-void .button-group');
const PANES_KEYS = { Digit1: 'write', Digit2: 'both', Digit3: 'preview' };

// Which panes are showing: 'both', 'write' or 'preview'. Global on purpose: sheets-ui.js asks, and the e2e tests.
function panesShown() {
    if (mobileMQ.matches) return document.body.dataset.view === 'preview' ? 'preview' : 'write';
    return settings.panes;
}

function showPanes() {
    if (mobileMQ.matches) delete document.body.dataset.panes;
    else document.body.dataset.panes = settings.panes;
    panesButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.panes === settings.panes)));
    const home = panesShown() === 'write' && !mobileMQ.matches ? voidButtons : canvasTools;
    if (panesSwitch.parentElement !== home) {
        const had = panesSwitch.contains(document.activeElement) ? document.activeElement : null;
        home.insertBefore(panesSwitch, home.firstChild);
        if (had) had.focus(); // moving an element drops its focus
    }
}

// Global on purpose: the e2e tests call it. `toEditor`: from the keyboard, the caret goes back to the text.
function setPanes(panes, toEditor) {
    setSetting('panes', panes);
    showPanes();
    if (panesShown() !== 'write' && settings.pageView) drawPages(); // not drawn while hidden (sheets-ui.js)
    if (toEditor && panesShown() !== 'preview') editor.focus({ preventScroll: true });
    updateFocus(true);      // the editor's width changed: focus mode's veils (focus.js)
    scrollPreviewToCaret(); // the preview, if showing, at the same place (layout.js)
}

// --- Wiring ---
panesButtons.forEach((b) => b.addEventListener('click', () => setPanes(b.dataset.panes)));
document.addEventListener('keydown', (e) => {
    const panes = PANES_KEYS[e.code];
    if (!panes || !(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (!mobileMQ.matches) setPanes(panes, true);
    else if (panes !== 'both') setView(panes); // one pane at a time already (layout.js)
});
mobileMQ.addEventListener('change', showPanes);
showPanes();
