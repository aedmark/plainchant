/*
 * Plainchant app script: pageview: the preview as the printed pages, while writing (P3-12)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// The Page view switch in the preview's header shows the script as the sheets it prints on: the same layout
// (src/paginate.js) drawn by the same code as printing (printSheet, print.js), with page numbers and breaks, and
// scaled to fit the pane. The flowing preview (#page) goes on being drawn underneath, only hidden, so switching back
// is instant and drawPreview still owns it (D-043). The pages follow typing once it pauses, and only the sheets that
// changed are replaced. Every printed line carries its source line (data-line), so the scroll sync, the Outline's
// jump and tapping the preview work on the pages too. The switch is remembered with the Settings (D-054).
const pageViewBtn = document.getElementById('pageViewBtn');
const sheets = document.getElementById('sheets');
const PAGES_DELAY = 300;                       // ms after typing pauses
const SHEET_PX = { letter: 816, a4: 793.7 };  // the sheets' widths in CSS pixels: 8.5 in, 210 mm
let sheetKeys = [];      // what each drawn sheet shows (its lines without their source lines), to keep the same ones
let sheetLines = [];     // and the source lines on it, to renumber a kept sheet in place
let sheetsPaper = null;
let pagesTokens = null;  // the latest parse, waiting to be drawn
let pagesTimer = null;

// The element the preview is showing: the pages, or the flowing screenplay. layout.js looks for lines in it.
function previewShown() {
    return settings.pageView ? sheets : page;
}

// Draws the pages for `tokens` (by default the latest parse, or the editor's text). Global on purpose: the e2e tests call it.
function drawPages(tokens) {
    clearTimeout(pagesTimer);
    const t = tokens || pagesTokens || Fountain.parse(editor.value || editor.getAttribute('placeholder'));
    pagesTokens = null;
    const paper = paperChoice();
    const layout = Paginate.layout(t, { paper: paper });
    const want = (layout.titlePage ? [{ number: null, lines: layout.titlePage }] : []).concat(layout.pages);
    if (paper !== sheetsPaper) { sheets.textContent = ''; sheetKeys = []; sheetLines = []; sheetsPaper = paper; }
    want.forEach((p, i) => {
        const key = p.number + JSON.stringify(p.lines, (k, v) => (k === 'at' || k === 'source' ? undefined : v));
        const at = p.lines.filter((l) => l.at !== undefined).map((l) => l.at);
        if (sheetKeys[i] === key) { // the same lines: only where they come from may have moved (a line added above)
            if (sheetLines[i].join() !== at.join()) {
                sheets.children[i].querySelectorAll('[data-line]').forEach((el, k) => { el.dataset.line = at[k]; });
                sheetLines[i] = at;
            }
            return;
        }
        const sheet = printSheet(p.lines, p.number, paper);
        if (sheets.children[i]) sheets.replaceChild(sheet, sheets.children[i]);
        else sheets.appendChild(sheet);
        sheetKeys[i] = key;
        sheetLines[i] = at;
    });
    while (sheets.children.length > want.length) sheets.lastElementChild.remove();
    sheetKeys.length = sheetLines.length = want.length;
    fitSheets();
}

// Called by render() with its parse: the pages follow a moment after typing pauses, and at once for anything else
function schedulePages(tokens, typed) {
    if (!settings.pageView) return;
    pagesTokens = tokens;
    clearTimeout(pagesTimer);
    if (typed === true) pagesTimer = setTimeout(() => drawPages(), PAGES_DELAY);
    else drawPages(tokens);
}

// The sheets are paper-sized; they shrink to the pane (never grow past their real size)
function fitSheets() {
    if (!settings.pageView) return;
    const cs = getComputedStyle(renderTarget);
    const room = renderTarget.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (room <= 0) return; // the preview is hidden (writing, on a phone): fitted when it shows
    sheets.style.zoom = String(Math.min(1, room / SHEET_PX[sheetsPaper || paperChoice()]));
}

function showPageView() {
    renderTarget.classList.toggle('pages', settings.pageView);
    pageViewBtn.setAttribute('aria-pressed', String(settings.pageView));
}

// Global on purpose: the e2e tests call it
function setPageView(on) {
    setSetting('pageView', !!on);
    showPageView();
    if (settings.pageView) drawPages();
    scrollPreviewToCaret(); // the same place in the script, in the other view (layout.js)
}

// --- Wiring ---
pageViewBtn.addEventListener('click', () => setPageView(!settings.pageView));
new ResizeObserver(fitSheets).observe(renderTarget);
showPageView(); // drawn by the first render()
