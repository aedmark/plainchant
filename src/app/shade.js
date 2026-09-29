const shadeLayer = document.createElement('div');
shadeLayer.className = 'editor-shade';
shadeLayer.setAttribute('aria-hidden', 'true');
editor.before(shadeLayer);

let shadeBase = [];
let shadeKeys = [];
let shadeText = null;
let shadeCaret = -1;
let shadeBroken = false;

function shadeLine(line, last) {
    const el = document.createElement('span');
    el.className = 'sh-' + line.kind;
    line.runs.forEach((r, i) => {
        let text = r.text;
        if (i === line.runs.length - 1) text += (line.runs.some((x) => x.text) ? '' : '\u200b') + (last ? '' : '\n');
        if (!r.mark) { el.appendChild(document.createTextNode(text)); return; }
        const m = el.appendChild(document.createElement('span'));
        m.className = 'sh-' + r.mark;
        m.textContent = text;
    });
    return el;
}

function lineKey(line) {
    return line.kind + '\u0001' + line.runs.map((r) => (r.mark || '') + '\u0002' + r.text).join('\u0003');
}

function drawShade(tokens) {
    if (shadeBroken || !settings.colours) return;
    try {
        const text = editor.value;
        shadeBase = Fountain.shade(text, text ? tokens : undefined);
        shadeText = text;
        paintShade();
    } catch (e) {
        stopShade('the colour hints could not be drawn', e);
    }
}

function paintShade() {
    const lines = shadeBase.slice();
    const at = caretLine();
    shadeCaret = at;
    const here = lines[at];
    if (here && here.kind !== 'blank' && here.runs.some((r) => r.text.trim())) {
        const kind = Editing.kindAt(shadeText, at);
        if (kind !== 'blank' && kind !== here.kind) lines[at] = Object.assign({}, here, { kind: kind });
    }
    const keys = lines.map(lineKey);
    keys[keys.length - 1] += '\u0004';
    let head = 0;
    while (head < keys.length && head < shadeKeys.length && keys[head] === shadeKeys[head]) head++;
    let tail = 0;
    while (tail < keys.length - head && tail < shadeKeys.length - head &&
        keys[keys.length - 1 - tail] === shadeKeys[shadeKeys.length - 1 - tail]) tail++;
    const old = shadeLayer.children;
    for (let k = shadeKeys.length - tail - 1; k >= head; k--) old[k].remove();
    const fresh = document.createDocumentFragment();
    for (let k = head; k < keys.length - tail; k++) fresh.appendChild(shadeLine(lines[k], k === keys.length - 1));
    shadeLayer.insertBefore(fresh, old[head] || null);
    shadeKeys = keys;
    placeShade();
    checkShade();
}

function placeShade() {
    if (shadeBroken || shadeText === null || editor.offsetParent === null) return;
    copyEditorType(shadeLayer);
    Object.assign(shadeLayer.style, { top: editor.offsetTop + 'px', left: editor.offsetLeft + 'px', height: editor.clientHeight + 'px' });
    shadeLayer.scrollTop = editor.scrollTop;
    document.body.classList.add('shaded');
}

function checkShade() {
    if (shadeText === null || editor.offsetParent === null || editor.scrollHeight <= editor.clientHeight + 1) return;
    const cs = getComputedStyle(editor);
    const padTop = parseFloat(cs.paddingTop), padBottom = parseFloat(cs.paddingBottom);
    const layer = getComputedStyle(shadeLayer);
    const textHeight = shadeLayer.scrollHeight - parseFloat(layer.paddingTop) - parseFloat(layer.paddingBottom) -
        parseFloat(getComputedStyle(shadeLayer, '::after').height);
    const rest = editor.scrollHeight - padTop - textHeight;
    if (Math.abs(rest - padBottom) > 2 && Math.abs(rest) > 2) stopShade('the colour hints wrap differently from the editor', rest - padBottom);
}

function setShadeOn(on) {
    if (on) { drawShade(); return; }
    document.body.classList.remove('shaded');
    shadeLayer.textContent = '';
    shadeBase = [];
    shadeKeys = [];
    shadeText = null;
}

function stopShade(why, detail) {
    shadeBroken = true;
    document.body.classList.remove('shaded');
    shadeLayer.textContent = '';
    shadeKeys = [];
    shadeText = null;
    console.warn('Plainchant: ' + why + ', so they are off until the page is reloaded.', detail);
}

editor.addEventListener('scroll', () => { shadeLayer.scrollTop = editor.scrollTop; });
document.addEventListener('selectionchange', () => {
    if (document.activeElement !== editor || shadeBroken || shadeText === null) return;
    try {
        if (editor.value !== shadeText) drawShade();
        else if (caretLine() !== shadeCaret) paintShade();
    } catch (e) { stopShade('the colour hints could not be drawn', e); }
});
if (typeof ResizeObserver === 'function') new ResizeObserver(() => { placeShade(); checkShade(); }).observe(editor);
window.addEventListener('resize', placeShade);
