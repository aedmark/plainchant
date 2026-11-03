const MOBILE_QUERY = '(max-width: 1023px), (pointer: coarse) and (max-height: 500px)';
const FIT_QUERY = '(pointer: coarse), (max-width: 1023px)';
const mobileMQ = window.matchMedia(MOBILE_QUERY);
const fitMQ = window.matchMedia(FIT_QUERY);
const tabWrite = document.getElementById('tabWrite');
const tabPreview = document.getElementById('tabPreview');
const menuBtn = document.getElementById('menuBtn');
const buttonGroup = document.querySelector('.button-group');
let syncingFromCanvas = false;

function setView(view) {
    document.body.dataset.view = view;
    tabWrite.setAttribute('aria-pressed', String(view === 'write'));
    tabPreview.setAttribute('aria-pressed', String(view === 'preview'));
    setMenu(false);
    if (view === 'preview') {
        editor.blur();
        scrollPreviewToCaret();
    } else if (mobileMQ.matches) {
        editor.focus({ preventScroll: true });
    }
}

function previewAnchorForLine(line) {
    let target = null;
    for (const el of previewShown().querySelectorAll('[data-line]')) {
        if (Number(el.dataset.line) > line) break;
        target = el;
    }
    return target;
}

function scrollPreviewToCaret() {
    const target = previewAnchorForLine(caretLine());
    if (!target) { renderTarget.scrollTop = 0; return; }
    const top = target.getBoundingClientRect().top - renderTarget.getBoundingClientRect().top + renderTarget.scrollTop;
    renderTarget.scrollTop = Math.max(0, top - renderTarget.clientHeight / 3);
}

function syncPreviewToCaret() {
    if (mobileMQ.matches || (typeof panesShown === 'function' && panesShown() !== 'both')) return;
    if (renderTarget.clientHeight <= 0 || renderTarget.scrollHeight <= renderTarget.clientHeight) return;
    const target = previewAnchorForLine(caretLine());
    if (!target) return;
    const rt = renderTarget.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    const pad = Math.min(48, renderTarget.clientHeight / 5);
    if (tr.top < rt.top + pad) {
        renderTarget.scrollTop = Math.max(0, renderTarget.scrollTop + (tr.top - rt.top) - renderTarget.clientHeight / 3);
    } else if (tr.bottom > rt.bottom - pad) {
        renderTarget.scrollTop = Math.min(
            renderTarget.scrollHeight - renderTarget.clientHeight,
            renderTarget.scrollTop + (tr.bottom - rt.bottom) + renderTarget.clientHeight / 3
        );
    }
}

const measureCopy = document.createElement('div');

function copyEditorType(el) {
    const cs = getComputedStyle(editor);
    ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'wordSpacing', 'lineHeight', 'tabSize', 'textIndent',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach((p) => { el.style[p] = cs[p]; });
    const width = editor.getBoundingClientRect().width - (editor.offsetWidth - editor.clientWidth);
    Object.assign(el.style, { boxSizing: 'border-box', width: width + 'px', border: '0', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
}

function textTopIn(text, pos) {
    copyEditorType(measureCopy);
    Object.assign(measureCopy.style, { position: 'absolute', visibility: 'hidden', left: '-9999px', top: '0' });
    if (!measureCopy.isConnected) document.body.appendChild(measureCopy);
    const markAt = (before) => {
        measureCopy.textContent = before;
        const mark = document.createElement('span');
        mark.textContent = '\u200b';
        measureCopy.appendChild(mark);
        return mark.getBoundingClientRect().top;
    };
    const top = markAt(text.slice(0, pos)) - markAt('');
    measureCopy.textContent = '';
    return top;
}

function textTop(pos) {
    return textTopIn(editor.value, pos);
}

function lineHeightPx() {
    const px = parseFloat(getComputedStyle(editor).lineHeight);
    return px > 0 ? px : textTopIn('x\nx', 2);
}

const aboveCache = { text: null, key: '', top: 0 };
function textAbovePx(start) {
    const before = editor.value.slice(0, start);
    const cs = getComputedStyle(editor);
    const key = [editor.clientWidth, cs.fontFamily, cs.fontSize, cs.lineHeight, cs.paddingLeft, cs.paddingRight].join('|');
    if (before !== aboveCache.text || key !== aboveCache.key) {
        aboveCache.text = before;
        aboveCache.key = key;
        aboveCache.top = textTop(start);
    }
    return aboveCache.top;
}

function caretLineTopPx(caret) {
    const block = Editing.blockAt(editor.value, caret);
    return parseFloat(getComputedStyle(editor).paddingTop) + textAbovePx(block.start) +
        textTopIn(editor.value.slice(block.start, block.end), caret - block.start);
}

const CLEAR_LINES = 3;
function keepCaretClear() {
    if (!fitMQ.matches || document.body.classList.contains('focus-mode')) return;
    if (document.activeElement !== editor || editor.selectionStart !== editor.selectionEnd || editor.offsetParent === null) return;
    const lh = lineHeightPx();
    const room = Math.min(CLEAR_LINES * lh, editor.clientHeight / 4);
    const bottom = caretLineTopPx(editor.selectionEnd) + lh;
    if (bottom > editor.scrollTop + editor.clientHeight - room) editor.scrollTop = bottom + room - editor.clientHeight;
}

function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
}

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
    document.body.classList.toggle('kb-open', vv.height < window.innerHeight - 120);
    keepCaretClear();
}

tabWrite.addEventListener('click', () => setView('write'));
tabPreview.addEventListener('click', () => setView('preview'));

menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMenu(!document.body.classList.contains('menu-open'));
});
buttonGroup.addEventListener('click', () => setMenu(false));
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

editor.addEventListener('input', () => {
    keepCaretClear();
    syncPreviewToCaret();
});

renderTarget.addEventListener('click', (e) => {
    if (e.target.closest('.quick-edit')) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const at = e.target.closest('[data-line]');
    if (!at || !renderTarget.contains(at)) return;
    const line = Number(at.dataset.line);
    if (mobileMQ.matches && document.body.dataset.view === 'preview') {
        setView('write');
        jumpToLine(line);
        return;
    }
    if (!mobileMQ.matches && editor.value) {
        const para = Editing.paragraphAt(editor.value, line);
        const endLine = para.first + Math.max(0, editor.value.slice(para.start, para.end).split('\n').length - 1);
        if (typeof highlightScriptLines === 'function') highlightScriptLines(para.first, endLine);
        if (editor.offsetParent !== null) {
            const lineY = parseFloat(getComputedStyle(editor).paddingTop) + textTop(para.start);
            if (lineY < editor.scrollTop || lineY > editor.scrollTop + editor.clientHeight - lineHeightPx()) {
                syncingFromCanvas = true;
                editor.scrollTop = Math.max(0, Math.min(lineY - editor.clientHeight / 3, editor.scrollHeight - editor.clientHeight));
            }
        }
    }
});

editor.addEventListener('scroll', () => {
    if (syncingFromCanvas) { syncingFromCanvas = false; return; }
    const editorRange = editor.scrollHeight - editor.clientHeight;
    const renderRange = renderTarget.scrollHeight - renderTarget.clientHeight;
    if (editorRange <= 0 || renderRange <= 0) return;
    if (editor.scrollTop <= 2) { renderTarget.scrollTop = 0; return; }
    if (editor.scrollTop >= editorRange - 2) { renderTarget.scrollTop = renderRange; return; }
    const ratio = editor.scrollTop / editorRange;
    const lines = editor.value.split('\n');
    const approxLine = Math.min(lines.length - 1, Math.max(0, Math.round(ratio * (lines.length - 1))));
    const target = previewAnchorForLine(approxLine);
    if (target) {
        const top = target.getBoundingClientRect().top - renderTarget.getBoundingClientRect().top + renderTarget.scrollTop;
        renderTarget.scrollTop = Math.max(0, Math.min(renderRange, top - renderTarget.clientHeight * ratio));
    } else {
        renderTarget.scrollTop = ratio * renderRange;
    }
});
