/*
 * Plainchant app script: core: the shared editor references, ids and the render step (the preview drawn block by block)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

const editor = document.getElementById('editor');
const renderTarget = document.getElementById('render-target'); // scroll container
const page = document.getElementById('page');                  // where the screenplay is rendered

// crypto.randomUUID is unavailable on plain-http origins (e.g. testing from a phone on the LAN)
function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

let currentScriptId = newId();
let autoSaveTimer;

// A short message at the foot of the page, for things that happen outside a dialog (an import). An error stays
// longer, since it is usually longer and has to be read.
let noticeTimer;
function showNotice(message, isError = false) {
    const notice = document.getElementById('notice');
    notice.textContent = message;
    notice.classList.toggle('error', isError);
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.textContent = ''; }, isError ? 12000 : 6000);
}

// The preview, redrawn block by block (P4-01, D-043): rebuilding the whole of a long script on every keystroke made
// the browser lay all of it out again (about 90 ms a key on 160 pages). The blocks that did not change at either end
// are kept; only those between are replaced. A block is compared with its line numbers counted from its own first
// line, so the blocks below an Enter still match, and only their data-line numbers are moved on.
let previewKeys = [];   // each drawn block's HTML, its line numbers relative to its first line
let previewLines = [];  // the line each drawn block starts on

function drawPreview(tokens) {
    const blocks = Fountain.blocks(tokens);
    const keys = blocks.map((b) => b.html.replace(/data-line="(\d+)"/g, (m, n) => 'data-line="' + (n - b.line) + '"'));
    const els = page.children;
    if (!previewKeys.length || els.length !== previewKeys.length) { // the first draw, or not ours: start again
        previewKeys = [];
        previewLines = [];
        page.textContent = '';
    }
    let head = 0;
    while (head < keys.length && head < previewKeys.length && keys[head] === previewKeys[head]) head++;
    let tail = 0;
    while (tail < keys.length - head && tail < previewKeys.length - head &&
        keys[keys.length - 1 - tail] === previewKeys[previewKeys.length - 1 - tail]) tail++;
    for (let k = previewKeys.length - tail - 1; k >= head; k--) els[k].remove();
    const fresh = document.createElement('template');
    fresh.innerHTML = blocks.slice(head, blocks.length - tail).map((b) => b.html).join('');
    page.insertBefore(fresh.content, els[head] || null);
    // The kept blocks: the same, perhaps further down (or up) the script
    const moved = previewLines.length - blocks.length;
    blocks.forEach((b, k) => {
        if (k >= head && k < blocks.length - tail) return;
        const shift = b.line - previewLines[k < head ? k : k + moved];
        if (!shift) return;
        const el = els[k];
        [el].concat(Array.from(el.querySelectorAll('[data-line]'))).forEach((x) => {
            if (x.hasAttribute('data-line')) x.setAttribute('data-line', Number(x.getAttribute('data-line')) + shift);
        });
    });
    previewKeys = keys;
    previewLines = blocks.map((b) => b.line);
}

// On a long script a keystroke does not wait for the preview: the typed text shows at once (the colour layer, drawn
// now), and the preview follows just after the browser has painted it, one redraw for a burst of keys. A short
// script, and everything that is not typing (opening a script, the Library, the examples), draws it at once.
const PREVIEW_LATER = 400; // tokens: about 18 pages
let previewTokens = null;  // the latest parse, waiting to be drawn
let previewWaiting = false;

function drawPreviewLater() {
    previewWaiting = false;
    if (!previewTokens) return; // drawn since, at once
    const tokens = previewTokens;
    previewTokens = null;
    drawPreview(tokens);
}

// Global on purpose: typing.js calls render(true) for a keystroke; the e2e tests call it.
function render(typed) {
    const tokens = Fountain.parse(editor.value || editor.getAttribute('placeholder'));
    if (typed === true && tokens.length > PREVIEW_LATER) {
        previewTokens = tokens;
        if (!previewWaiting) {
            previewWaiting = true;
            requestAnimationFrame(() => setTimeout(drawPreviewLater, 0));
            setTimeout(drawPreviewLater, 100); // a hidden tab has no frames
        }
    } else {
        previewTokens = null;
        drawPreview(tokens);
    }
    drawShade(tokens);  // the editor's colours, from the same parse (src/app/shade.js)
    scheduleStats();    // the page count in the preview's header follows, a moment later (src/app/stats-ui.js)
    schedulePages(tokens, typed); // and the page view, if it is showing (src/app/pageview.js)
}
