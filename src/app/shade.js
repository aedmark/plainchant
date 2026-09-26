/*
 * Plainchant app script: shade: the editor's colour hints (P2-08), a coloured copy of the text behind the textarea
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// A textarea cannot colour part of its text (Q-001), so the colours are drawn on a copy of the text laid exactly
// behind it, and the textarea's own text is made transparent (D-031). The textarea still does everything else:
// typing, the caret, selection, undo, IME and the on-screen keyboard. Each line is coloured by its kind
// (Fountain.shade); the line being typed takes the kind the element bar shows (Editing.kindAt), so a cue is a cue
// before its speech is written. Only the lines that changed are redrawn. If the copy ever wraps differently from the
// textarea, the hints are switched off for the rest of the visit and the textarea shows its own text again.
const shadeLayer = document.createElement('div');
shadeLayer.className = 'editor-shade';
shadeLayer.setAttribute('aria-hidden', 'true');
editor.before(shadeLayer);

let shadeBase = [];       // Fountain.shade() of the text last drawn: its lines as the parser sees them
let shadeKeys = [];       // what each drawn line is: kind, marks and text
let shadeText = null;     // the text last drawn
let shadeCaret = -1;      // the line drawn as "being typed"
let shadeBroken = false;  // the copy wrapped differently once: hints off until the page is reloaded

function shadeLine(line, last) {
    const el = document.createElement('span');
    el.className = 'sh-' + line.kind;
    line.runs.forEach((r, i) => {
        // each line is a block of its own (the stylesheet): an empty one gets a zero-width space, for its height, and
        // every line but the last keeps its line break, so the layer's text is exactly the editor's
        let text = r.text;
        if (i === line.runs.length - 1) text += (line.runs.some((x) => x.text) ? '' : '\u200b') + (last ? '' : '\n');
        if (!r.mark) { el.appendChild(document.createTextNode(text)); return; }
        const m = el.appendChild(document.createElement('span'));
        m.className = 'sh-' + r.mark;
        m.textContent = text; // the writer's text: text only, never markup
    });
    return el;
}

function lineKey(line) {
    return line.kind + '\u0001' + line.runs.map((r) => (r.mark || '') + '\u0002' + r.text).join('\u0003');
}

// Draws the text's colours, given the tokens render() has just parsed from it. Global on purpose: render() calls it,
// and the e2e tests call it.
function drawShade(tokens) {
    if (shadeBroken) return;
    try {
        const text = editor.value;
        shadeBase = Fountain.shade(text, text ? tokens : undefined);
        shadeText = text;
        paintShade();
    } catch (e) {
        stopShade('the colour hints could not be drawn', e);
    }
}

// Puts the lines on the layer, redrawing only those that changed. The line being typed takes the kind the element
// bar shows, since the parser cannot know what it is until the next line exists (a cue before its speech).
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
    keys[keys.length - 1] += '\u0004'; // the last line is drawn differently (no line break)
    // Keep the lines that did not change at either end; redraw the ones between
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

// Lay the layer exactly over the textarea's box, with its type and padding, scrolled as it is
function placeShade() {
    if (shadeBroken || editor.offsetParent === null) return;
    copyEditorType(shadeLayer);
    // (the stylesheet adds room after the text, so the layer can always scroll as far as the textarea does)
    Object.assign(shadeLayer.style, { top: editor.offsetTop + 'px', left: editor.offsetLeft + 'px', height: editor.clientHeight + 'px' });
    shadeLayer.scrollTop = editor.scrollTop;
    document.body.classList.add('shaded');
}

// The copy must wrap exactly as the textarea does, or the colours would sit on the wrong letters. When the text
// overflows, the textarea's scroll height is the text's height plus its padding (Firefox has left out the bottom
// padding): anything else means the lines wrap differently.
function checkShade() {
    if (editor.offsetParent === null || editor.scrollHeight <= editor.clientHeight + 1) return;
    const cs = getComputedStyle(editor);
    const padTop = parseFloat(cs.paddingTop), padBottom = parseFloat(cs.paddingBottom);
    const layer = getComputedStyle(shadeLayer);
    const textHeight = shadeLayer.scrollHeight - parseFloat(layer.paddingTop) - parseFloat(layer.paddingBottom) -
        parseFloat(getComputedStyle(shadeLayer, '::after').height);
    const rest = editor.scrollHeight - padTop - textHeight;
    if (Math.abs(rest - padBottom) > 2 && Math.abs(rest) > 2) stopShade('the colour hints wrap differently from the editor', rest - padBottom);
}

function stopShade(why, detail) {
    shadeBroken = true;
    document.body.classList.remove('shaded');
    shadeLayer.textContent = '';
    shadeKeys = [];
    console.warn('Plainchant: ' + why + ', so they are off until the page is reloaded.', detail);
}

// --- Wiring ---
editor.addEventListener('scroll', () => { shadeLayer.scrollTop = editor.scrollTop; });
// The caret moving to another line changes which line is "being typed"; a change that did not come through render()
// (there should be none) is caught here too, so the layer never shows old text
document.addEventListener('selectionchange', () => {
    if (document.activeElement !== editor || shadeBroken || shadeText === null) return;
    try {
        if (editor.value !== shadeText) drawShade();
        else if (caretLine() !== shadeCaret) paintShade();
    } catch (e) { stopShade('the colour hints could not be drawn', e); }
});
if (typeof ResizeObserver === 'function') new ResizeObserver(() => { placeShade(); checkShade(); }).observe(editor);
window.addEventListener('resize', placeShade);
