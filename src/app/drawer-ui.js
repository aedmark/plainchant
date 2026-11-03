const canvasBody = document.getElementById('canvasBody');
const canvasDrawer = document.getElementById('canvasDrawer');
const drawerResizer = document.getElementById('drawerResizer');
const drawerDockBtn = document.getElementById('drawerDockBtn');
const drawerDockMenu = document.getElementById('drawerDockMenu');
const drawerCollapseBtn = document.getElementById('drawerCollapseBtn');
const drawerCloseBtn = document.getElementById('drawerCloseBtn');
const drawerOutlinePane = document.getElementById('drawerOutlinePane');
const drawerStatsPane = document.getElementById('drawerStatsPane');
const drawerOutlineFilter = document.getElementById('drawerOutlineFilter');
const drawerOutlineList = document.getElementById('drawerOutlineList');
const drawerStatsScenes = document.getElementById('drawerStatsScenes');
const drawerTabButtons = Array.from(canvasDrawer.querySelectorAll('[data-drawer-tab]'));
const outlineDockBtn = document.getElementById('outlineDockBtn');
const statsDockBtn = document.getElementById('statsDockBtn');

const DRAWER_MIN_WIDTH = 220;
const DRAWER_DOCK_LABELS = { right: 'Right', left: 'Left', bottom: 'Bottom', top: 'Top' };
const DRAWER_DELAY = 350;
let drawerCollapsed = false;
let drawerResizeDrag = null;
let drawerTimer = null;
let drawerOutlineItems = [];

function closeDrawerDockMenu() {
    drawerDockMenu.hidden = true;
    drawerDockBtn.setAttribute('aria-expanded', 'false');
}

function openDrawerDockMenu() {
    drawerDockMenu.querySelectorAll('[data-dock]').forEach((item) => {
        item.setAttribute('aria-checked', String(item.dataset.dock === settings.drawerDock));
    });
    drawerDockMenu.hidden = false;
    const anchor = drawerDockBtn.getBoundingClientRect();
    const width = drawerDockMenu.offsetWidth;
    const height = drawerDockMenu.offsetHeight;
    const left = Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8));
    const below = anchor.bottom + 4;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, anchor.top - height - 4) : below;
    drawerDockMenu.style.left = left + 'px';
    drawerDockMenu.style.top = top + 'px';
    drawerDockBtn.setAttribute('aria-expanded', 'true');
    const current = drawerDockMenu.querySelector('[aria-checked="true"]');
    if (current) current.focus();
}

function clampDrawerWidth(px) {
    const room = canvasBody.getBoundingClientRect().width || 600;
    const max = Math.max(DRAWER_MIN_WIDTH, Math.min(640, room - 200));
    return Math.round(Math.max(DRAWER_MIN_WIDTH, Math.min(max, px)));
}

function applyDrawerWidth(px) {
    canvasDrawer.style.setProperty('--drawer-w', clampDrawerWidth(px) + 'px');
}

function setDrawerCollapsed(collapsed) {
    drawerCollapsed = Boolean(collapsed);
    canvasDrawer.classList.toggle('collapsed', drawerCollapsed);
    drawerCollapseBtn.textContent = drawerCollapsed ? '\u25b4' : '\u25be';
    drawerCollapseBtn.title = drawerCollapsed ? 'Expand panel' : 'Collapse panel';
    drawerCollapseBtn.setAttribute('aria-label', drawerCollapsed ? 'Expand panel' : 'Collapse panel');
}

function setDrawerDock(dock, remember = true) {
    if (!DRAWER_DOCK_LABELS[dock]) return;
    canvasBody.dataset.dock = dock;
    Object.keys(DRAWER_DOCK_LABELS).forEach((d) => canvasDrawer.classList.toggle('dock-' + d, d === dock));
    const side = dock === 'left' || dock === 'right';
    drawerResizer.hidden = canvasDrawer.hidden || !side;
    drawerDockBtn.textContent = DRAWER_DOCK_LABELS[dock] + ' \u25be';
    if (side) applyDrawerWidth(settings.drawerWidth);
    if (remember) setSetting('drawerDock', dock);
}

function setDrawerTab(tab, remember = true) {
    if (tab !== 'outline' && tab !== 'stats') return;
    drawerTabButtons.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.drawerTab === tab)));
    drawerOutlinePane.hidden = tab !== 'outline';
    drawerStatsPane.hidden = tab !== 'stats';
    if (remember) setSetting('drawerTab', tab);
    refreshDrawer();
}

function toggleDrawer(force, tab) {
    const next = typeof force === 'boolean' ? force : canvasDrawer.hidden;
    if (tab) setDrawerTab(tab, true);
    canvasDrawer.hidden = !next;
    if (next && drawerCollapsed) setDrawerCollapsed(false);
    setSetting('drawer', next);
    setDrawerDock(settings.drawerDock, false);
    if (next) {
        if (!mobileMQ.matches && typeof panesShown === 'function' && panesShown() === 'write') setPanes('both');
        refreshDrawer();
    } else {
        closeDrawerDockMenu();
    }
}

function renderDrawerOutlineList() {
    const query = drawerOutlineFilter.value.trim().toLowerCase();
    const here = Outline.current(drawerOutlineItems, caretLine());
    drawerOutlineList.textContent = '';
    let shown = 0;
    drawerOutlineItems.forEach((item, i) => {
        if (query && (item.text + ' ' + (item.synopsis || '')).toLowerCase().indexOf(query) === -1) return;
        const row = outlineRow(item, i);
        if (i === here) row.setAttribute('aria-current', 'location');
        else row.removeAttribute('aria-current');
        drawerOutlineList.appendChild(row);
        shown++;
    });
    if (!shown) {
        const note = document.createElement('p');
        note.className = 'library-note';
        note.textContent = query ? 'Nothing matches “' + drawerOutlineFilter.value.trim() + '”.'
            : 'No scenes or sections yet. Scene headings (INT. / EXT.) and sections (# Act One) appear here.';
        drawerOutlineList.appendChild(note);
    }
}

function syncDrawerOutlineCurrent() {
    if (canvasDrawer.hidden || settings.drawerTab !== 'outline' || !drawerOutlineItems.length) return;
    const here = Outline.current(drawerOutlineItems, caretLine());
    drawerOutlineList.querySelectorAll('.outline-item').forEach((row) => {
        if (Number(row.dataset.index) === here) row.setAttribute('aria-current', 'location');
        else row.removeAttribute('aria-current');
    });
}

function renderDrawerStats() {
    const s = Stats.of(editor.value, { paper: paperChoice() });
    document.getElementById('drawerStatPages').textContent = s.pages;
    document.getElementById('drawerStatTime').textContent = Stats.duration(s.minutes).replace(/^about /, '~');
    document.getElementById('drawerStatScenes').textContent = s.scenes;
    document.getElementById('drawerStatWords').textContent = s.words.toLocaleString();
    document.getElementById('drawerStatAloud').textContent = '~' + Narration.clock(narrationOf(editor.value).seconds);

    const charBody = document.getElementById('drawerStatsCharacters');
    charBody.textContent = '';
    if (!s.characters.length) emptyRow(charBody, 'Nobody speaks yet.', 4);
    s.characters.forEach((c) => {
        const row = document.createElement('tr');
        row.appendChild(statsCell('th', c.name)).scope = 'row';
        row.appendChild(statsCell('td', c.speeches));
        row.appendChild(statsCell('td', c.words.toLocaleString()));
        row.appendChild(statsCell('td', c.share + '%'));
        charBody.appendChild(row);
    });

    drawerStatsScenes.textContent = '';
    if (!s.sceneList.length) emptyRow(drawerStatsScenes, 'No scenes yet.', 3);
    s.sceneList.forEach((sc) => {
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
        drawerStatsScenes.appendChild(row);
    });
}

function refreshDrawer() {
    clearTimeout(drawerTimer);
    if (canvasDrawer.hidden) return;
    if (settings.drawerTab === 'stats') {
        renderDrawerStats();
    } else {
        drawerOutlineItems = Outline.of(editor.value, { paper: paperChoice() }).items;
        renderDrawerOutlineList();
    }
}

function scheduleDrawer(typed) {
    if (canvasDrawer.hidden) return;
    clearTimeout(drawerTimer);
    if (typed === true) drawerTimer = setTimeout(refreshDrawer, DRAWER_DELAY);
    else refreshDrawer();
}

drawerTabButtons.forEach((b) => b.addEventListener('click', () => setDrawerTab(b.dataset.drawerTab)));
drawerCollapseBtn.addEventListener('click', () => setDrawerCollapsed(!drawerCollapsed));
drawerCloseBtn.addEventListener('click', () => toggleDrawer(false));

if (outlineDockBtn) {
    outlineDockBtn.addEventListener('click', () => {
        closeModal(outlineModal);
        toggleDrawer(true, 'outline');
    });
}
if (statsDockBtn) {
    statsDockBtn.addEventListener('click', () => {
        closeModal(statsModal);
        toggleDrawer(true, 'stats');
    });
}

drawerOutlineFilter.addEventListener('input', renderDrawerOutlineList);
drawerOutlineFilter.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const first = drawerOutlineList.querySelector('.outline-item');
    if (first && drawerOutlineItems[Number(first.dataset.index)]) {
        jumpToLine(drawerOutlineItems[Number(first.dataset.index)].line);
    }
});
drawerOutlineList.addEventListener('click', (e) => {
    const row = e.target.closest('.outline-item');
    if (row && drawerOutlineItems[Number(row.dataset.index)]) {
        jumpToLine(drawerOutlineItems[Number(row.dataset.index)].line);
    }
});
drawerStatsScenes.addEventListener('click', (e) => {
    const go = e.target.closest('.stats-jump');
    if (go) jumpToLine(Number(go.dataset.line));
});

drawerDockBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (drawerDockMenu.hidden) openDrawerDockMenu();
    else closeDrawerDockMenu();
});
drawerDockMenu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-dock]');
    if (!item) return;
    closeDrawerDockMenu();
    setDrawerDock(item.dataset.dock);
});
drawerDockMenu.addEventListener('keydown', (e) => {
    const items = Array.from(drawerDockMenu.querySelectorAll('[data-dock]'));
    const at = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        items[(at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDrawerDockMenu();
        drawerDockBtn.focus();
    }
});
document.addEventListener('click', (e) => {
    if (!drawerDockMenu.hidden && !drawerDockMenu.contains(e.target)) closeDrawerDockMenu();
});
window.addEventListener('resize', () => {
    closeDrawerDockMenu();
    if (!canvasDrawer.hidden && (settings.drawerDock === 'left' || settings.drawerDock === 'right')) {
        applyDrawerWidth(settings.drawerWidth);
    }
});

drawerResizer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    drawerResizeDrag = { startX: e.clientX, startWidth: canvasDrawer.getBoundingClientRect().width };
    drawerResizer.setPointerCapture(e.pointerId);
});
drawerResizer.addEventListener('pointermove', (e) => {
    if (!drawerResizeDrag) return;
    const delta = e.clientX - drawerResizeDrag.startX;
    applyDrawerWidth(drawerResizeDrag.startWidth + (settings.drawerDock === 'left' ? delta : -delta));
});
['pointerup', 'pointercancel'].forEach((type) => drawerResizer.addEventListener(type, () => {
    if (!drawerResizeDrag) return;
    drawerResizeDrag = null;
    setSetting('drawerWidth', Math.round(canvasDrawer.getBoundingClientRect().width));
}));
drawerResizer.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const grow = (e.key === 'ArrowRight') === (settings.drawerDock === 'left');
    applyDrawerWidth(canvasDrawer.getBoundingClientRect().width + (grow ? 16 : -16));
    setSetting('drawerWidth', Math.round(canvasDrawer.getBoundingClientRect().width));
});

document.addEventListener('selectionchange', () => {
    if (document.activeElement === editor) syncDrawerOutlineCurrent();
});

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.code === 'KeyO') {
        e.preventDefault();
        toggleDrawer();
    }
});

setDrawerTab(settings.drawerTab, false);
setDrawerDock(settings.drawerDock, false);
applyDrawerWidth(settings.drawerWidth);
toggleDrawer(settings.drawer === true);
