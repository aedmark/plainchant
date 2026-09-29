const versionsModal = document.getElementById('versions-modal');
const versionsList = document.getElementById('versions-list');
const versionsStatus = document.getElementById('versions-status');
const versionForm = document.getElementById('versionForm');
const versionName = document.getElementById('versionName');

let versionsOf = null;
let versionsShown = [];
let armedVersion = null;
let armedVersionTimer = null;

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
            h('button', { type: 'button', class: 'mini', 'data-action': 'compare', 'aria-label': 'Compare the version of ' + when + ' with the text now, scene by scene',
                text: 'Compare' }),
            h('button', { type: 'button', class: 'mini', 'data-action': 'go-back', 'aria-label': 'Go back to the version of ' + when, text: 'Go back' }),
            h('button', { type: 'button', class: 'mini', 'data-action': 'copy-version', 'aria-label': 'Copy the version of ' + when + ' as a new script', text: 'Copy' }),
            h('button', { type: 'button', class: 'mini danger' + (armed ? ' armed' : ''), 'data-action': 'delete-version',
                'aria-label': armed ? 'Really delete the version of ' + when + '?' : 'Delete the version of ' + when, text: armed ? 'Really delete?' : 'Delete' })
        ])
    ].filter(Boolean));
}

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
    versionsList.appendChild(h('p', { class: 'library-note versions-note', text: 'Plainchant keeps versions by itself while you write: ' +
        'all of the last hour, one an hour for a day, one a day for a month, then one a month. Named versions stay until you ' +
        'delete them. Going back keeps the text you had as a version too.' }));
}

async function reloadVersions() {
    versionsShown = await Store.loadVersions(scriptDb, versionsOf);
    renderVersions();
}

async function openVersions(id) {
    if (id === currentScriptId) flushSave();
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

async function replaceScriptText(id, text, note) {
    const isOpen = id === currentScriptId;
    if (isOpen) flushSave();
    await whenSaved();
    const script = getScripts()[id];
    if (!script || script.deletedAt || script.content === text) return false;
    const now = Date.now();
    const kept = await Store.loadVersions(scriptDb, id);
    if (!kept.some((k) => k.content === script.content)) {
        await Store.addVersion(scriptDb, Versions.make(script, newId(), now, { note: note }), Versions, now);
    }
    if (isOpen) {
        applyEdit(Editing.diffEdit(editor.value, text, editor.selectionStart, editor.selectionEnd), { keepFocus: true });
        flushSave();
    } else {
        putScripts(Object.assign({}, getScripts(), {
            [id]: Object.assign({}, script, { content: text, title: Fountain.extractTitle(text), updatedAt: now })
        }));
    }
    await whenSaved();
    renderLibrary();
    return true;
}

async function goBackTo(v) {
    const when = versionWhen(v.updatedAt, Date.now());
    if (!await replaceScriptText(v.scriptId, v.content, 'Before going back to ' + when)) {
        const script = getScripts()[v.scriptId];
        if (script && script.content === v.content) versionsSay('That version is the same as the text now.');
        return;
    }
    await reloadVersions();
    versionsSay('Back to the version of ' + when + '. The text you had is kept as a version too.');
}

function copyVersion(v) {
    const now = Date.now();
    const base = Fountain.fullTitle(v.content) || 'Untitled Script';
    const content = Fountain.setTitle(v.content, base + ' (' + versionWhen(v.updatedAt, now) + ')');
    const id = newId();
    putScripts(Object.assign({}, getScripts(), { [id]: { id: id, title: Fountain.extractTitle(content), content: content, updatedAt: now } }));
    renderLibrary();
    versionsSay('Copied as “' + Fountain.extractTitle(content) + '”, in the Library.');
}

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

versionForm.addEventListener('submit', (e) => { e.preventDefault(); keepNamedVersion(); });
versionsList.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    const row = button && button.closest('.version-item');
    const v = row && versionsShown.find((x) => x.id === row.dataset.id);
    if (!v) return;
    if (button.dataset.action === 'compare') openCompare(v);
    else if (button.dataset.action === 'go-back') goBackTo(v);
    else if (button.dataset.action === 'copy-version') copyVersion(v);
    else if (button.dataset.action === 'delete-version') deleteVersion(v);
});
