const statsBtn = document.getElementById('statsBtn');
const statsModal = document.getElementById('stats-modal');
const statsScenes = document.getElementById('statsScenes');
const STATS_DELAY = 600;
let statsTimer = null;

function pagesLabel(n) { return n + (n === 1 ? ' page' : ' pages'); }

function updateStatsBadge() {
    clearTimeout(statsTimer);
    const s = Stats.of(editor.value, { paper: paperChoice() });
    statsBtn.textContent = s.pages ? pagesLabel(s.pages) + ' · ~' + s.minutes + ' min' : 'No pages yet';
    statsBtn.setAttribute('aria-label', s.pages ? pagesLabel(s.pages) + ', ' + Stats.duration(s.minutes) + ' of screen time. Open script stats' : 'Script stats');
}

function scheduleStats() {
    clearTimeout(statsTimer);
    statsTimer = setTimeout(updateStatsBadge, STATS_DELAY);
}

function statsCell(tag, text) {
    const cell = document.createElement(tag);
    cell.textContent = text;
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
    document.getElementById('statAloud').textContent = '~' + Narration.clock(narrationOf(editor.value).seconds);
    document.getElementById('statsAloudHow').textContent = narrationHow();
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
    drawSceneMix(s);
    drawLocations(s.locations);
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

function drawSceneMix(s) {
    const n = s.settings;
    const parts = [['INT.', n.int], ['EXT.', n.ext], ['INT./EXT.', n.both], ['Other', n.other]]
        .filter(([, count], i) => count || i < 2).map(([label, count]) => label + ' ' + count);
    const scenes = n.int + n.ext + n.both + n.other;
    document.getElementById('statsSettings').textContent = scenes ? parts.join(' · ') : 'No scenes yet.';
    const times = s.times.map((t) => t.name + ' ' + t.scenes);
    if (s.untimed && scenes) times.push('no time of day ' + s.untimed);
    document.getElementById('statsTimes').textContent = times.join(' · ');
}

function drawLocations(list) {
    const body = document.getElementById('statsLocations');
    body.textContent = '';
    if (!list.length) emptyRow(body, 'No locations yet.', 3);
    list.forEach((place) => {
        const row = document.createElement('tr');
        row.appendChild(statsCell('th', place.name)).scope = 'row';
        row.appendChild(statsCell('td', place.scenes));
        row.appendChild(statsCell('td', Stats.eighths(place.eighths)));
        body.appendChild(row);
    });
}

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

statsBtn.addEventListener('click', openStats);
statsScenes.addEventListener('click', (e) => {
    const go = e.target.closest('.stats-jump');
    if (!go) return;
    closeModal(statsModal);
    jumpToLine(Number(go.dataset.line));
});
