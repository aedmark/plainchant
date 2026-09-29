const PAPER_KEY = 'plainchant_paper';
const SHEETS = { letter: 'letter', a4: 'A4' };
const PT = { top: 72, left: 108, col: 7.2, row: 12 };

const printChoice = document.getElementById('export-modal');
const printRoot = document.getElementById('print-root');
const printSummary = document.getElementById('printSummary');
const pageRule = document.createElement('style');
document.head.appendChild(pageRule);

function paperChoice() {
    try { return localStorage.getItem(PAPER_KEY) === 'a4' ? 'a4' : 'letter'; } catch (e) { return 'letter'; }
}

function printLine(l) {
    const div = document.createElement('div');
    div.className = 'print-line';
    div.style.top = (PT.top + l.row * PT.row) + 'pt';
    div.style.left = (PT.left + l.col * PT.col) + 'pt';
    div.style.width = (l.width * PT.col) + 'pt';
    div.style.textAlign = l.align;
    if (l.at !== undefined) div.dataset.line = l.at;
    l.runs.forEach((r) => {
        if (!r.bold && !r.italic && !r.underline) { div.appendChild(document.createTextNode(r.text)); return; }
        const span = document.createElement('span');
        span.className = (r.bold ? ' pr-b' : '') + (r.italic ? ' pr-i' : '') + (r.underline ? ' pr-u' : '');
        span.textContent = r.text;
        div.appendChild(span);
    });
    return div;
}

function marginText(text, row, left, width, align, cls) {
    const div = document.createElement('div');
    div.className = 'print-line ' + cls;
    div.style.top = (PT.top + row * PT.row) + 'pt';
    div.style.left = left + 'pt';
    div.style.width = width + 'pt';
    div.style.textAlign = align;
    div.textContent = text;
    return div;
}

function printSheet(lines, number, paper) {
    const sheet = document.createElement('div');
    sheet.className = 'print-page ' + paper;
    if (number) sheet.appendChild(marginText(number + '.', -3, PT.left, 60 * PT.col, 'right', 'print-num'));
    lines.forEach((l) => {
        sheet.appendChild(printLine(l));
        if (l.number) {
            sheet.appendChild(marginText(l.number, l.row, PT.left - 7 * PT.col, 5 * PT.col, 'right', 'print-margin'));
            sheet.appendChild(marginText(l.number, l.row, PT.left + 62 * PT.col, 5 * PT.col, 'left', 'print-margin'));
        }
    });
    return sheet;
}

function buildPrintPages(paper = paperChoice()) {
    const layout = Paginate.layout(Fountain.parse(editor.value), { paper: paper });
    printRoot.textContent = '';
    if (layout.titlePage) printRoot.appendChild(printSheet(layout.titlePage, null, paper));
    layout.pages.forEach((p) => printRoot.appendChild(printSheet(p.lines, p.number, paper)));
    printRoot.dataset.paper = paper;
    pageRule.textContent = '@page { size: ' + SHEETS[paper] + '; margin: 0; }';
    return layout;
}

function describePages(paper) {
    const layout = Paginate.layout(Fountain.parse(editor.value), { paper: paper });
    const n = layout.pages.length;
    const title = Fountain.fullTitle(editor.value);
    return (title ? '“' + title + '”: ' : '') + n + (n === 1 ? ' page' : ' pages') + (layout.titlePage ? ', plus a title page.' : '.');
}

function chosenPaper() {
    const picked = printChoice.querySelector('input[name="paper"]:checked');
    return picked && picked.value === 'a4' ? 'a4' : 'letter';
}

function preparePrintChoice() {
    const paper = paperChoice();
    printChoice.querySelectorAll('input[name="paper"]').forEach((r) => { r.checked = r.value === paper; });
    printSummary.textContent = describePages(paper);
}

function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const faces = ['12pt "Courier Prime"', 'bold 12pt "Courier Prime"', 'italic 12pt "Courier Prime"'];
    return Promise.race([
        Promise.all(faces.map((f) => document.fonts.load(f))).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 2000))
    ]);
}

async function printScript() {
    const paper = chosenPaper();
    try { localStorage.setItem(PAPER_KEY, paper); } catch (e) {
    }
    updateStatsBadge();
    if (settings.pageView) drawPages();
    closeModal(printChoice);
    await fontsReady();
    buildPrintPages(paper);
    window.print();
}

document.getElementById('printGo').addEventListener('click', printScript);
printChoice.addEventListener('change', (e) => {
    if (e.target.name === 'paper') printSummary.textContent = describePages(chosenPaper());
});
window.addEventListener('beforeprint', () => buildPrintPages());
