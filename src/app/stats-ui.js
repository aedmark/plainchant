/*
 * Plainchant app script: stats-ui: the live page count in the preview's header, and the Script stats window (P4-04)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// The numbers come from src/stats.js, which paginates the script exactly as it prints. That takes a few
// milliseconds on a long script, so the header's count waits until typing pauses.
const statsBtn = document.getElementById('statsBtn');
const statsModal = document.getElementById('stats-modal');
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
    if (!s.characters.length) {
        const row = document.createElement('tr');
        const cell = statsCell('td', 'Nobody speaks yet.');
        cell.colSpan = 4;
        row.appendChild(cell);
        body.appendChild(row);
    }
    s.characters.forEach((c) => {
        const row = document.createElement('tr');
        row.appendChild(statsCell('th', c.name)).scope = 'row';
        row.appendChild(statsCell('td', c.speeches));
        row.appendChild(statsCell('td', c.words.toLocaleString()));
        row.appendChild(statsCell('td', c.share + '%'));
        body.appendChild(row);
    });
    updateStatsBadge();
    openModal(statsModal);
}

// --- Wiring ---
statsBtn.addEventListener('click', openStats);
