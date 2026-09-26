/*
 * Plainchant app script: versions-ui: a script's kept versions (P4-05): go back to one, copy one, name one, delete one
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// Versions are kept by the saves themselves (persistence.js hands Store.saveScript the rules in src/versions.js);
// this window lists them, from the script's row in the Library (D-034). Versions live in their own IndexedDB store
// and are read only here, so they go to Store directly; the scripts themselves still change only through
// putScripts / saveScript. Going back first keeps the text there now as a version, so it can be undone.
const versionsModal = document.getElementById('versions-modal');
const versionsList = document.getElementById('versions-list');
const versionsStatus = document.getElementById('versions-status');
const versionForm = document.getElementById('versionForm');
const versionName = document.getElementById('versionName');

let versionsOf = null;   // the id of the script whose versions are showing
let versionsShown = [];  // its versions, newest first
let armedVersion = null; // a version whose Delete has been pressed once
let armedVersionTimer = null;

// "Today 14:32", "Yesterday 09:10", "12 Sep 17:05", "3 Mar 2025 11:00"
function versionWhen(ts, now) {
    const d = new Date(ts), today = new Date(now), yesterday = new Date(now - 24 * 60 * 60 * 1000);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === today.toDateString()) return 'Today ' + time;
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday ' + time;
    const opts = { day: 'numeric', month: 'short' };
    if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString([], opts) + ' ' + time;
}

function versionsSay(message) {
    versionsStatus.textContent = message;
}

function disarmVersion() { armedVersion = null; clearTimeout(armedVersionTimer); }

function versionRow(v, script, now) {
    const words = Library.wordCount(v.content);
    const diff = words - Library.wordCount(script.content);
    const change = v.content === script.content ? 'the same as now'
        : diff === 0 ? 'as many words as now' : Math.abs(diff).toLocaleString() + (diff > 0 ? ' more' : ' fewer') + ' than now';
    const when = versionWhen(v.updatedAt, now);
    const armed = armedVersion === v.id;
    return h('div', { class: 'version-item', 'data-id': v.id }, [
        h('div', { class: 'version-when', text: when }),
        v.name ? h('div', { class: 'version-name', text: v.name }) : v.note ? h('div', { class: 'version-note', text: v.note }) : null,
        h('div', { class: 'script-meta', text: words.toLocaleString() + (words === 1 ? ' word' : ' words') + ' · ' + change +
            (v.title && v.title !== script.title ? ' · titled “' + v.title + '”' : '') }),
        h('div', { class: 'script-actions' }, [
            h('button', { type: 'button', class: 'mini', 'data-action': 'go-back', 'aria-label': 'Go back to the version of ' + when, text: 'Go back' }),
            h('button', { type: 'button', class: 'mini', 'data-action': 'copy-version', 'aria-label': 'Copy the version of ' + when + ' as a new script', text: 'Copy' }),
            h('button', { type: 'button', class: 'mini danger' + (armed ? ' armed' : ''), 'data-action': 'delete-version',
                'aria-label': armed ? 'Really delete the version of ' + when + '?' : 'Delete the version of ' + when, text: armed ? 'Really delete?' : 'Delete' })
        ])
    ].filter(Boolean));
}

// Global on purpose: the e2e tests read what it drew
function renderVersions() {
    const script = getScripts()[versionsOf];
    if (!script) return;
    document.getElementById('versionsFor').textContent = '“' + libraryTitleOf(script) + '”';
    versionsList.textContent = '';
    if (!versionsShown.length) {
        versionsList.appendChild(h('p', { class: 'library-note', text: 'No versions yet. One is kept by itself the next time this script changes, or name one above.' }));
    }
    const now = Date.now();
    versionsShown.forEach((v) => versionsList.appendChild(versionRow(v, script, now)));
    // Below the list, so on a phone it scrolls away rather than taking half the window
    versionsList.appendChild(h('p', { class: 'library-note versions-note', text: 'Plainchant keeps versions by itself while you write: ' +
        'all of the last hour, one an hour for a day, one a day for a month, then one a month. Named versions stay until you ' +
        'delete them. Going back keeps the text you had as a version too.' }));
}

async function reloadVersions() {
    versionsShown = await Store.loadVersions(scriptDb, versionsOf);
    renderVersions();
}

// Global on purpose: the Library's row button calls it, and so do the e2e tests
async function openVersions(id) {
    if (id === currentScriptId) flushSave(); // the list compares with the latest words
    await whenSaved();
    const script = getScripts()[id];
    if (!script || script.deletedAt || !scriptDb) return;
    versionsOf = id;
    versionName.value = '';
    versionName.removeAttribute('aria-invalid');
    versionsSay('');
    disarmVersion();
    await reloadVersions();
    openModal(versionsModal, { focus: '#versionName' });
}

// The script's text becomes the version's; the text there now is kept as a version first (unless one already has
// it). The open script changes through applyEdit, so Ctrl/Cmd+Z undoes it too.
async function goBackTo(v) {
    const id = v.scriptId;
    const isOpen = id === currentScriptId;
    if (isOpen) flushSave();
    await whenSaved();
    const script = getScripts()[id];
    if (!script || script.deletedAt) return;
    const now = Date.now(), when = versionWhen(v.updatedAt, now);
    if (script.content === v.content) { versionsSay('That version is the same as the text now.'); return; }
    const kept = await Store.loadVersions(scriptDb, id);
    if (!kept.some((k) => k.content === script.content)) {
        await Store.addVersion(scriptDb, Versions.make(script, newId(), now, { note: 'Before going back to ' + when }), Versions, now);
    }
    if (isOpen) {
        applyEdit(Editing.diffEdit(editor.value, v.content, editor.selectionStart, editor.selectionEnd), { keepFocus: true });
        flushSave();
    } else {
        putScripts(Object.assign({}, getScripts(), {
            [id]: Object.assign({}, script, { content: v.content, title: Fountain.extractTitle(v.content), updatedAt: now })
        }));
    }
    await whenSaved();
    await reloadVersions();
    renderLibrary();
    versionsSay('Back to the version of ' + when + '. The text you had is kept as a version too.');
}

// A new script holding the version's text, titled after it, so a scene can be taken from it
function copyVersion(v) {
    const now = Date.now();
    const base = Fountain.fullTitle(v.content) || 'Untitled Script';
    const content = Fountain.setTitle(v.content, base + ' (' + versionWhen(v.updatedAt, now) + ')');
    const id = newId();
    putScripts(Object.assign({}, getScripts(), { [id]: { id: id, title: Fountain.extractTitle(content), content: content, updatedAt: now } }));
    renderLibrary();
    versionsSay('Copied as “' + Fountain.extractTitle(content) + '”, in the Library.');
}

// Two deliberate clicks, like deleting a script for good
async function deleteVersion(v) {
    if (armedVersion !== v.id) {
        disarmVersion();
        armedVersion = v.id;
        armedVersionTimer = setTimeout(() => { armedVersion = null; renderVersions(); }, 4000);
        renderVersions();
        const again = versionsList.querySelector('[data-id="' + v.id + '"] [data-action="delete-version"]');
        if (again) again.focus();
        return;
    }
    disarmVersion();
    await Store.removeVersion(scriptDb, v.id);
    await reloadVersions();
    versionsSay('Deleted the version of ' + versionWhen(v.updatedAt, Date.now()) + '.');
    versionName.focus();
}

async function keepNamedVersion() {
    const name = versionName.value.replace(/\s+/g, ' ').trim();
    if (!name) { versionName.setAttribute('aria-invalid', 'true'); versionsSay('Give the version a name first.'); versionName.focus(); return; }
    versionName.removeAttribute('aria-invalid');
    if (versionsOf === currentScriptId) flushSave();
    await whenSaved();
    const script = getScripts()[versionsOf];
    if (!script) return;
    const now = Date.now();
    await Store.addVersion(scriptDb, Versions.make(script, newId(), now, { name: name }), Versions, now);
    versionName.value = '';
    await reloadVersions();
    versionsSay('Kept the script as it is now, as “' + name + '”.');
}

// --- Wiring ---
versionForm.addEventListener('submit', (e) => { e.preventDefault(); keepNamedVersion(); });
versionsList.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    const row = button && button.closest('.version-item');
    const v = row && versionsShown.find((x) => x.id === row.dataset.id);
    if (!v) return;
    if (button.dataset.action === 'go-back') goBackTo(v);
    else if (button.dataset.action === 'copy-version') copyVersion(v);
    else if (button.dataset.action === 'delete-version') deleteVersion(v);
});
