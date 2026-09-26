/*
 * Plainchant app script: layout: one pane at a time on phones and tablets, the drop-down menu, keyboard-safe sizing, scroll sync
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// --- Mobile: one pane at a time, drop-down menu, keyboard-safe sizing (P2-05) ---
// Both must match the media queries in the stylesheet (the "one pane at a time" block, and the fixed-body rule).
const MOBILE_QUERY = '(max-width: 1023px), (pointer: coarse) and (max-height: 500px)';
const FIT_QUERY = '(pointer: coarse), (max-width: 1023px)';
const mobileMQ = window.matchMedia(MOBILE_QUERY);
const fitMQ = window.matchMedia(FIT_QUERY);
const tabWrite = document.getElementById('tabWrite');
const tabPreview = document.getElementById('tabPreview');
const menuBtn = document.getElementById('menuBtn');
const buttonGroup = document.querySelector('.button-group');

function setView(view) {
    document.body.dataset.view = view;
    tabWrite.setAttribute('aria-pressed', String(view === 'write'));
    tabPreview.setAttribute('aria-pressed', String(view === 'preview'));
    setMenu(false);
    if (view === 'preview') {
        editor.blur(); // drop the keyboard so the preview gets the full height
        scrollPreviewToCaret();
    } else if (mobileMQ.matches) {
        editor.focus({ preventScroll: true });
    }
}

// Show the part of the script the writer was just typing, not the top of the page.
// Uses the data-line anchors the renderer puts on every block.
function scrollPreviewToCaret() {
    const line = caretLine();
    let target = null;
    for (const el of renderTarget.querySelectorAll('[data-line]')) {
        if (Number(el.dataset.line) > line) break;
        target = el;
    }
    if (!target) { renderTarget.scrollTop = 0; return; }
    const top = target.getBoundingClientRect().top - renderTarget.getBoundingClientRect().top + renderTarget.scrollTop;
    renderTarget.scrollTop = Math.max(0, top - renderTarget.clientHeight / 3);
}

// Where the top of the character at `pos` in `text` would sit if `text` filled the editor, in pixels from the top of
// its text (padding not counted). Measured on a hidden copy with the editor's width and type, since a textarea cannot
// say where its wrapped lines fall. Used by the outline's jump (D-024) and focus mode (P2-07). A piece of the text
// that starts at a line start measures the same as it would in place.
const measureCopy = document.createElement('div');
function textTopIn(text, pos) {
    const cs = getComputedStyle(editor);
    ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'wordSpacing', 'lineHeight', 'tabSize', 'textIndent',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach((p) => { measureCopy.style[p] = cs[p]; });
    Object.assign(measureCopy.style, { position: 'absolute', visibility: 'hidden', left: '-9999px', top: '0', boxSizing: 'border-box',
        width: editor.clientWidth + 'px', border: '0', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
    if (!measureCopy.isConnected) document.body.appendChild(measureCopy);
    // A span's offsetTop is the top of its text, a little below the top of its line; measuring from a mark at the
    // very start cancels that (and the padding) out
    const markAt = (before) => {
        measureCopy.textContent = before;
        const mark = document.createElement('span');
        mark.textContent = '\u200b';
        measureCopy.appendChild(mark);
        return mark.offsetTop;
    };
    const top = markAt(text.slice(0, pos)) - markAt('');
    measureCopy.textContent = '';
    return top;
}

function textTop(pos) {
    return textTopIn(editor.value, pos);
}

function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
}

// Size the app to the *visual* viewport so the on-screen keyboard never hides the text being typed.
// Chromium already does this via interactive-widget=resizes-content; Safari needs it done by hand.
// Takes the viewport as an argument so tests can pass a fake one.
function fitToViewport(vv = window.visualViewport) {
    const rootStyle = document.documentElement.style;
    if (!vv || !fitMQ.matches) {
        rootStyle.removeProperty('--app-height');
        rootStyle.removeProperty('--app-top');
        document.body.classList.remove('kb-open');
        return;
    }
    rootStyle.setProperty('--app-height', vv.height + 'px');
    rootStyle.setProperty('--app-top', vv.offsetTop + 'px');
    // Keyboard up: the home-indicator inset is hidden behind it, so don't reserve space for it
    document.body.classList.toggle('kb-open', vv.height < window.innerHeight - 120);
}

// --- Wiring ---
tabWrite.addEventListener('click', () => setView('write'));
tabPreview.addEventListener('click', () => setView('preview'));

menuBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // otherwise the outside-click handler below closes the menu straight away
    setMenu(!document.body.classList.contains('menu-open'));
});
buttonGroup.addEventListener('click', () => setMenu(false)); // choosing an action closes the menu
document.addEventListener('click', (e) => {
    if (document.body.classList.contains('menu-open') && !e.target.closest('.button-group')) setMenu(false);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

mobileMQ.addEventListener('change', () => { setMenu(false); fitToViewport(); });
fitMQ.addEventListener('change', () => fitToViewport());
if (window.visualViewport) {
    visualViewport.addEventListener('resize', () => fitToViewport());
    visualViewport.addEventListener('scroll', () => fitToViewport());
}

// Sync scrolling (Optional but helpful for large documents)
// A pane that does not overflow has a scroll range of 0; dividing by it produced NaN
editor.addEventListener('scroll', () => {
    const editorRange = editor.scrollHeight - editor.clientHeight;
    const renderRange = renderTarget.scrollHeight - renderTarget.clientHeight;
    if (editorRange <= 0 || renderRange <= 0) return;
    renderTarget.scrollTop = (editor.scrollTop / editorRange) * renderRange;
});
