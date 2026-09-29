const pageViewBtn = document.getElementById('pageViewBtn');
const sheets = document.getElementById('sheets');
const PAGES_DELAY = 300;
const SHEET_PX = { letter: 816, a4: 793.7 };
let sheetKeys = [];
let sheetLines = [];
let sheetsPaper = null;
let pagesTokens = null;
let pagesTimer = null;

function previewShown() {
    return settings.pageView ? sheets : page;
}

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
        if (sheetKeys[i] === key) {
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

function schedulePages(tokens, typed) {
    if (!settings.pageView || panesShown() === 'write') return;
    pagesTokens = tokens;
    clearTimeout(pagesTimer);
    if (typed === true) pagesTimer = setTimeout(() => drawPages(), PAGES_DELAY);
    else drawPages(tokens);
}

function fitSheets() {
    if (!settings.pageView) return;
    const cs = getComputedStyle(renderTarget);
    const room = renderTarget.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (room <= 0) return;
    sheets.style.zoom = String(Math.min(1, room / SHEET_PX[sheetsPaper || paperChoice()]));
}

function showPageView() {
    renderTarget.classList.toggle('pages', settings.pageView);
    pageViewBtn.setAttribute('aria-pressed', String(settings.pageView));
}

function setPageView(on) {
    setSetting('pageView', !!on);
    showPageView();
    if (settings.pageView) drawPages();
    scrollPreviewToCaret();
}

pageViewBtn.addEventListener('click', () => setPageView(!settings.pageView));
new ResizeObserver(fitSheets).observe(renderTarget);
showPageView();
