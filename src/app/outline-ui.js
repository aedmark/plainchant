/*
 * Plainchant app script: outline-ui: the Outline window, and jumping to a scene or section (P4-03)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// The items come from src/outline.js. Choosing one puts the caret at the start of that line, with the line a
// quarter of the way down the editor (not at its bottom edge), and the preview follows. In one-pane mode, from the
// Preview, it scrolls the preview instead and stays there.
const outlineBtn = document.getElementById('outlineBtn');
const outlineModal = document.getElementById('outline-modal');
const outlineList = document.getElementById('outline-list');
const outlineFilter = document.getElementById('outlineFilter');
let outlineItems = [];
let outlineHere = -1; // the item the caret is in when the window opens

function outlineRow(item, index) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'outline-item ' + item.kind;
    row.dataset.index = index;
    row.style.setProperty('--level', item.level);
    if (index === outlineHere) row.setAttribute('aria-current', 'location');
    const part = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; row.appendChild(s); };
    part('ol-num', item.number || '');
    part('ol-text', item.text); // the writer's words: text only, never markup
    part('ol-page', item.page ? 'p. ' + item.page : '');
    if (item.synopsis) { const d = document.createElement('div'); d.className = 'ol-synopsis'; d.textContent = item.synopsis; row.appendChild(d); }
    return row;
}

function renderOutline() {
    const query = outlineFilter.value.trim().toLowerCase();
    outlineList.textContent = '';
    let shown = 0;
    outlineItems.forEach((item, i) => {
        if (query && (item.text + ' ' + (item.synopsis || '')).toLowerCase().indexOf(query) === -1) return;
        outlineList.appendChild(outlineRow(item, i));
        shown++;
    });
    if (!shown) {
        const note = document.createElement('p');
        note.className = 'library-note';
        note.textContent = query ? 'Nothing matches “' + outlineFilter.value.trim() + '”.'
            : 'No scenes or sections yet. Scene headings (INT. / EXT.) and sections (# Act One) appear here.';
        outlineList.appendChild(note);
    }
}

function openOutline() {
    outlineItems = Outline.of(editor.value, { paper: paperChoice() }).items;
    outlineHere = Outline.current(outlineItems, caretLine());
    outlineFilter.value = '';
    renderOutline();
    openModal(outlineModal, { focus: outlineHere >= 0 ? '[data-index="' + outlineHere + '"]' : '#outlineFilter' });
}

// Global on purpose: the e2e tests call it
function jumpToLine(line) {
    const lines = editor.value.split('\n');
    let pos = 0;
    for (let i = 0; i < Math.min(line, lines.length); i++) pos += lines[i].length + 1;
    pos = Math.min(pos, editor.value.length);

    if (mobileMQ.matches && document.body.dataset.view === 'preview') { // stay in the preview, at that scene
        editor.setSelectionRange(pos, pos);
        scrollPreviewToCaret();
        return;
    }
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(pos, pos);
    const lineY = parseFloat(getComputedStyle(editor).paddingTop) + textTop(pos);
    const want = Math.max(0, Math.min(lineY - editor.clientHeight / 4, editor.scrollHeight - editor.clientHeight));
    if (Math.abs(editor.scrollTop - want) < 1) scrollPreviewToCaret();
    else { // the scroll sync moves the preview in proportion first; then put it exactly on the scene
        editor.addEventListener('scroll', scrollPreviewToCaret, { once: true });
        editor.scrollTop = want;
    }
    syncElementState();
}

function jumpToItem(index) {
    const item = outlineItems[index];
    if (!item) return;
    closeModal(outlineModal);
    jumpToLine(item.line);
}

// --- Wiring ---
outlineBtn.addEventListener('click', openOutline);
outlineFilter.addEventListener('input', renderOutline);
outlineFilter.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const first = outlineList.querySelector('.outline-item');
    if (first) jumpToItem(Number(first.dataset.index));
});
outlineList.addEventListener('click', (e) => {
    const row = e.target.closest('.outline-item');
    if (row) jumpToItem(Number(row.dataset.index));
});
// Up and Down move between the items, as in any list
outlineList.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = Array.from(outlineList.querySelectorAll('.outline-item'));
    const at = rows.indexOf(document.activeElement);
    const next = rows[at + (e.key === 'ArrowDown' ? 1 : -1)];
    if (next) { e.preventDefault(); next.focus(); }
});
