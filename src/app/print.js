/*
 * Plainchant app script: print: screenplay pages for printing and Save as PDF (P3-03, D-021)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// The pages come from src/paginate.js (a grid of lines). Here each one becomes a sheet exactly the size of the paper,
// every line placed where the grid says, and the print stylesheet shows only those sheets. The browser's print
// window then prints them or saves a PDF. Ctrl/Cmd+P works too: the pages are rebuilt just before any print.
const PAPER_KEY = 'plainchant_paper';     // 'letter' (default) or 'a4', remembered per browser
const SHEETS = { letter: 'letter', a4: 'A4' };
const PT = { top: 72, left: 108, col: 7.2, row: 12 }; // 1 in top margin, 1.5 in left; 10 characters and 6 lines an inch

const printChoice = document.getElementById('export-modal'); // the "PDF or paper" half of the Export dialog
const printRoot = document.getElementById('print-root');
const printSummary = document.getElementById('printSummary');
const pageRule = document.createElement('style'); // @page size follows the chosen paper
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
    l.runs.forEach((r) => { // the writer's text only ever becomes text nodes
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
    if (number) sheet.appendChild(marginText(number + '.', -3, PT.left, 60 * PT.col, 'right', 'print-num')); // half an inch from the top
    lines.forEach((l) => {
        sheet.appendChild(printLine(l));
        if (l.number) { // scene numbers sit in both margins
            sheet.appendChild(marginText(l.number, l.row, PT.left - 7 * PT.col, 5 * PT.col, 'right', 'print-margin'));
            sheet.appendChild(marginText(l.number, l.row, PT.left + 62 * PT.col, 5 * PT.col, 'left', 'print-margin'));
        }
    });
    return sheet;
}

// Draws the pages for what is in the editor now. Global on purpose: the e2e tests call it.
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

// Called as the Export dialog opens: the remembered paper, and how many pages that makes
function preparePrintChoice() {
    const paper = paperChoice();
    printChoice.querySelectorAll('input[name="paper"]').forEach((r) => { r.checked = r.value === paper; });
    printSummary.textContent = describePages(paper);
}

// The font the pages are measured in (Courier Prime; plain Courier has the same widths) should be ready first
function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const faces = ['12pt "Courier Prime"', 'bold 12pt "Courier Prime"', 'italic 12pt "Courier Prime"'];
    return Promise.race([
        Promise.all(faces.map((f) => document.fonts.load(f))).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 2000))
    ]);
}

// Global on purpose: the e2e tests replace window.print in the page under test and call this
async function printScript() {
    const paper = chosenPaper();
    try { localStorage.setItem(PAPER_KEY, paper); } catch (e) { /* remembered for this print only */ }
    updateStatsBadge(); // the page count in the preview's header is for this paper now
    closeModal(printChoice);
    await fontsReady();
    buildPrintPages(paper);
    window.print();
}

// --- Wiring ---
document.getElementById('printGo').addEventListener('click', printScript);
printChoice.addEventListener('change', (e) => {
    if (e.target.name === 'paper') printSummary.textContent = describePages(chosenPaper());
});
window.addEventListener('beforeprint', () => buildPrintPages());
