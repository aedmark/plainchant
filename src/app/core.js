const editor = document.getElementById('editor');
const renderTarget = document.getElementById('render-target');
const page = document.getElementById('page');

function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

let currentScriptId = newId();
let autoSaveTimer;

let noticeTimer;
function showNotice(message, isError = false) {
    const notice = document.getElementById('notice');
    notice.textContent = message;
    notice.classList.toggle('error', isError);
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.textContent = ''; }, isError ? 12000 : 6000);
}

let previewKeys = [];
let previewLines = [];

function drawPreview(tokens) {
    const blocks = Fountain.blocks(tokens);
    const keys = blocks.map((b) => b.html.replace(/data-line="(\d+)"/g, (m, n) => 'data-line="' + (n - b.line) + '"'));
    const els = page.children;
    if (!previewKeys.length || els.length !== previewKeys.length) {
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

const PREVIEW_LATER = 400;
let previewTokens = null;
let previewWaiting = false;

function drawPreviewLater() {
    previewWaiting = false;
    if (!previewTokens) return;
    const tokens = previewTokens;
    previewTokens = null;
    drawPreview(tokens);
}

function render(typed) {
    const tokens = Fountain.parse(editor.value || editor.getAttribute('placeholder'));
    if (typed === true && tokens.length > PREVIEW_LATER) {
        previewTokens = tokens;
        if (!previewWaiting) {
            previewWaiting = true;
            requestAnimationFrame(() => setTimeout(drawPreviewLater, 0));
            setTimeout(drawPreviewLater, 100);
        }
    } else {
        previewTokens = null;
        drawPreview(tokens);
    }
    drawShade(tokens);
    scheduleStats();
    schedulePages(tokens, typed);
}
