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
        editor.blur();
        scrollPreviewToCaret();
    } else if (mobileMQ.matches) {
        editor.focus({ preventScroll: true });
    }
}

function scrollPreviewToCaret() {
    const line = caretLine();
    let target = null;
    for (const el of previewShown().querySelectorAll('[data-line]')) {
        if (Number(el.dataset.line) > line) break;
        target = el;
    }
    if (!target) { renderTarget.scrollTop = 0; return; }
    const top = target.getBoundingClientRect().top - renderTarget.getBoundingClientRect().top + renderTarget.scrollTop;
    renderTarget.scrollTop = Math.max(0, top - renderTarget.clientHeight / 3);
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

editor.addEventListener('input', keepCaretClear);

renderTarget.addEventListener('click', (e) => {
    if (!mobileMQ.matches || document.body.dataset.view !== 'preview') return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const at = e.target.closest('[data-line]');
    if (!at || !renderTarget.contains(at)) return;
    setView('write');
    jumpToLine(Number(at.dataset.line));
});

editor.addEventListener('scroll', () => {
    const editorRange = editor.scrollHeight - editor.clientHeight;
    const renderRange = renderTarget.scrollHeight - renderTarget.clientHeight;
    if (editorRange <= 0 || renderRange <= 0) return;
    renderTarget.scrollTop = (editor.scrollTop / editorRange) * renderRange;
});
