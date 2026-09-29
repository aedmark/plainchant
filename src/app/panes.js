const panesSwitch = document.getElementById('panesSwitch');
const panesButtons = Array.from(panesSwitch.querySelectorAll('button[data-panes]'));
const canvasTools = document.querySelector('.canvas-tools');
const voidButtons = document.querySelector('.pane-void .button-group');
const PANES_KEYS = { Digit1: 'write', Digit2: 'both', Digit3: 'preview' };

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
        if (had) had.focus();
    }
}

function setPanes(panes, toEditor) {
    setSetting('panes', panes);
    showPanes();
    if (panesShown() !== 'write' && settings.pageView) drawPages();
    if (toEditor && panesShown() !== 'preview') editor.focus({ preventScroll: true });
    updateFocus(true);
    scrollPreviewToCaret();
}

panesButtons.forEach((b) => b.addEventListener('click', () => setPanes(b.dataset.panes)));
document.addEventListener('keydown', (e) => {
    const panes = PANES_KEYS[e.code];
    if (!panes || !(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (!mobileMQ.matches) setPanes(panes, true);
    else if (panes !== 'both') setView(panes);
});
mobileMQ.addEventListener('change', showPanes);
showPanes();
