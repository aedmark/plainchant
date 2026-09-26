/*
 * Plainchant app script: stats-ui: the live page count in the preview's header, and the Script stats window (P4-04, P4-13)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// The numbers come from src/stats.js, which paginates the script exactly as it prints. That takes a few
// milliseconds on a long script, so the header's count waits until typing pauses.
const statsBtn = document.getElementById('statsBtn');
const statsModal = document.getElementById('stats-modal');
const statsScenes = document.getElementById('statsScenes');
const STATS_DELAY = 600;
let statsTimer = null;

function pagesLabel(n) { return n + (n === 1 ? ' page' : ' pages'); }

// Global on purpose: the e2e tests call it to skip the wait
function updateStatsBadge() {
    clearTimeout(statsTimer);
    const s = Stats.of(editor.value, { paper: paperChoice() });
    statsBtn.textContent = s.pages ? pagesLabel(s.pages) + ' · ~' + s.minutes + ' min' : 'No pages yet';
    statsBtn.setAttribute('aria-label', s.pages ? pagesLabel(s.pages) + ', ' + Stats.duration(s.minutes) + ' of screen time. Open script stats' : 'Script stats');
}

// Called by render() on every change, typed or loaded
function scheduleStats() {
    clearTimeout(statsTimer);
    statsTimer = setTimeout(updateStatsBadge, STATS_DELAY);
}

function statsCell(tag, text) {
    const cell = document.createElement(tag);
    cell.textContent = text; // character names are the writer's text: text only, never markup
    return cell;
}

function openStats() {
    const paper = paperChoice();
    const s = Stats.of(editor.value, { paper: paper });
    const title = Fountain.fullTitle(editor.value);
    document.getElementById('statsFor').textContent = title ? '“' + title + '”' : 'This script';
    document.getElementById('statPages').textContent = s.pages;
    document.getElementById('statTime').textContent = Stats.duration(s.minutes).replace(/^about /, '~');
    document.getElementById('statScenes').textContent = s.scenes;
    document.getElementById('statWords').textContent = s.words.toLocaleString();
    document.getElementById('statsPaper').textContent = paper === 'a4' ? 'A4' : 'US Letter';

    const body = document.getElementById('statsCharacters');
    body.textContent = '';
    if (!s.characters.length) emptyRow(body, 'Nobody speaks yet.', 4);
    s.characters.forEach((c) => {
        const row = document.createElement('tr');
        row.appendChild(statsCell('th', c.name)).scope = 'row';
        row.appendChild(statsCell('td', c.speeches));
        row.appendChild(statsCell('td', c.words.toLocaleString()));
        row.appendChild(statsCell('td', c.share + '%'));
        body.appendChild(row);
    });
    drawSceneList(s.sceneList);
    updateStatsBadge();
    openModal(statsModal);
}

function emptyRow(body, text, span) {
    const row = document.createElement('tr');
    const cell = statsCell('td', text);
    cell.colSpan = span;
    row.appendChild(cell);
    body.appendChild(row);
}

// Every scene, with its page, its length and who speaks in it (P4-13). Choosing one goes there, as the Outline does.
function drawSceneList(list) {
    statsScenes.textContent = '';
    if (!list.length) emptyRow(statsScenes, 'No scenes yet.', 3);
    list.forEach((sc) => {
        const row = document.createElement('tr');
        const head = row.appendChild(statsCell('th', ''));
        head.scope = 'row';
        const go = head.appendChild(document.createElement('button'));
        go.type = 'button';
        go.className = 'stats-jump';
        go.dataset.line = sc.line;
        if (sc.number) go.appendChild(statsCell('span', sc.number)).className = 'stats-num';
        go.appendChild(document.createTextNode(sc.text || 'Scene'));
        if (sc.characters.length) head.appendChild(statsCell('div', sc.characters.join(', '))).className = 'stats-who';
        row.appendChild(statsCell('td', sc.page));
        row.appendChild(statsCell('td', Stats.eighths(sc.eighths)));
        statsScenes.appendChild(row);
    });
}

// --- Wiring ---
statsBtn.addEventListener('click', openStats);
statsScenes.addEventListener('click', (e) => {
    const go = e.target.closest('.stats-jump');
    if (!go) return;
    closeModal(statsModal);
    jumpToLine(Number(go.dataset.line));
});
