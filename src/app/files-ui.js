/*
 * Plainchant app script: files-ui: scripts linked to real files on disk (P5-01): open a file, save to a file, and keep them in step
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// Where the browser has the File System Access API (Chrome, Edge and other Chromium browsers; not Firefox), a script
// can be linked to a real .fountain file (D-046). The Library's "Open a file..." opens one and stays linked to it;
// Export's "Save to a file..." links the open script to a new one. From then on every save also writes the file,
// and the file is read again when the script is opened and when the window comes back into view. The rule for
// who wins is src/filesync.js: never write over changes made to the file elsewhere. The script itself still lives in
// the Library (IndexedDB) as always; the link (the file's handle, and the text and time they last agreed on) is in
// the `files` store. The browser asks the writer again for permission after a reload: a bar above the editor asks.
const fileSupport = typeof window.showOpenFilePicker === 'function' && typeof window.showSaveFilePicker === 'function';
const fileBar = document.getElementById('file-bar');
const fileBarText = document.getElementById('fileBarText');
let fileLinks = {};             // { [scriptId]: { scriptId, handle, name, synced, modified } }
let fileWork = Promise.resolve(); // file reads and writes, one at a time, in order
let fileBarState = null;        // null | { kind: 'allow' | 'conflict', id, disk }

// Global on purpose: the e2e tests wait for it
function whenFilesSynced() {
    return fileWork.then(() => undefined);
}

function queueFileWork(job) {
    fileWork = fileWork.then(job).catch((e) => console.error('Plainchant: a file could not be read or written.', e));
    return fileWork;
}

async function fileAllowed(link, ask) {
    const opts = { mode: 'readwrite' };
    try {
        if (await link.handle.queryPermission(opts) === 'granted') return true;
        return ask ? await link.handle.requestPermission(opts) === 'granted' : false;
    } catch (e) { return false; }
}

async function keepLink(link) {
    fileLinks = Object.assign({}, fileLinks, { [link.scriptId]: link });
    await Store.putLink(scriptDb, link);
}

async function writeLinkedFile(link, text) {
    const out = FileSync.canon(text);
    const w = await link.handle.createWritable();
    await w.write(out);
    await w.close();
    const file = await link.handle.getFile();
    await keepLink(Object.assign({}, link, { synced: out, modified: file.lastModified }));
}

async function readLinkedFile(link) {
    const file = await link.handle.getFile();
    const read = Importing.readText(new Uint8Array(await file.arrayBuffer()));
    if (!read.ok) throw new Error(read.reason);
    return { text: read.text, modified: file.lastModified };
}

// The file changed outside Plainchant: the script takes its text, and what it had is kept as a version (versions-ui.js)
async function loadLinkedFile(id, link, disk) {
    await replaceScriptText(id, disk.text, 'Before loading changes to ' + link.name + ' made outside Plainchant');
    await keepLink(Object.assign({}, link, { synced: FileSync.canon(disk.text), modified: disk.modified }));
    showNotice('Loaded ' + link.name + ': it was changed outside Plainchant. The text you had is kept in Versions.');
}

function showFileBar(state) {
    fileBarState = state;
    fileBar.hidden = !state;
    fileBar.dataset.kind = state ? state.kind : '';
    if (!state) { fileBarText.textContent = ''; return; }
    const name = fileLinks[state.id] ? fileLinks[state.id].name : 'the file';
    fileBarText.textContent = state.kind === 'allow'
        ? 'To keep saving to ' + name + ', Plainchant needs your permission again.'
        : name + ' was changed outside Plainchant, and so was the script here. Which should both become?';
}

// Brings the script `id` and its file into step, when both can be read. Global on purpose: the e2e tests call it.
function syncFile(id) {
    return queueFileWork(async () => {
        const link = fileLinks[id];
        const script = getScripts()[id];
        if (!link || !script || script.deletedAt || !scriptDb) return;
        if (!await fileAllowed(link, false)) {
            if (id === currentScriptId) showFileBar({ kind: 'allow', id: id });
            return;
        }
        let disk;
        try { disk = await readLinkedFile(link); } catch (e) {
            await forgetFile(id);
            showNotice(link.name + ' can no longer be read (moved or deleted?), so Plainchant has stopped saving to it. The script is safe in the Library.', true);
            return;
        }
        const action = FileSync.decide({ text: script.content, synced: link.synced, modified: link.modified, disk: disk });
        if (fileBarState && fileBarState.id === id && action !== 'conflict') showFileBar(null);
        if (action === 'same') await keepLink(Object.assign({}, link, { synced: FileSync.canon(script.content), modified: disk.modified }));
        else if (action === 'write') await writeLinkedFile(link, script.content);
        else if (action === 'load') await loadLinkedFile(id, link, disk);
        else if (action === 'conflict' && id === currentScriptId) showFileBar({ kind: 'conflict', id: id, disk: disk });
    });
}

// After any save: the linked scripts whose text is no longer what their file last agreed on. Called by
// persistence.js; reads nothing from disk for a script that has not changed.
function syncLinkedFiles() {
    if (!fileSupport) return;
    const scripts = getScripts();
    Object.keys(fileLinks).forEach((id) => {
        const s = scripts[id];
        if (s && !s.deletedAt && FileSync.canon(s.content) !== fileLinks[id].synced) syncFile(id);
    });
}

async function forgetFile(id) {
    const next = Object.assign({}, fileLinks);
    delete next[id];
    fileLinks = next;
    if (fileBarState && fileBarState.id === id) showFileBar(null);
    await Store.removeLink(scriptDb, id);
}

// A file already linked to one of the scripts, if `handle` is it
async function scriptOfFile(handle) {
    for (const id of Object.keys(fileLinks)) {
        try { if (await fileLinks[id].handle.isSameEntry(handle)) return id; } catch (e) { /* a handle gone stale */ }
    }
    return null;
}

// Library: "Open a file..." Global on purpose: the e2e tests call it.
async function openFromDisk() {
    let handle;
    try { [handle] = await window.showOpenFilePicker({ types: FileSync.TYPES, multiple: false }); } catch (e) { return; } // cancelled
    const known = await scriptOfFile(handle);
    if (known && getScripts()[known] && !getScripts()[known].deletedAt) {
        openScriptById(known);
        await syncFile(known);
        showNotice('Opened ' + fileLinks[known].name + ', which is already in the Library.');
        return;
    }
    if (known) await forgetFile(known); // linked to a deleted script: link it to a new one instead
    const file = await handle.getFile();
    const verdict = Importing.checkFile(file.name, file.size);
    let read = verdict.ok ? Importing.readText(new Uint8Array(await file.arrayBuffer())) : verdict;
    if (!read.ok) { showNotice('“' + file.name + '”: ' + read.reason, true); return; }
    flushSave();
    const added = Library.add(getScripts(), newId(), read.text, Date.now());
    if (!await putScripts(added.scripts)) { showNotice('There is not enough room left in this browser to open that file.', true); return; }
    await keepLink({ scriptId: added.id, handle: handle, name: handle.name, synced: FileSync.canon(read.text), modified: file.lastModified });
    openScriptById(added.id);
    editor.setSelectionRange(0, 0);
    editor.scrollTop = 0;
    if (mobileMQ.matches) setView('write');
    showNotice('Opened ' + handle.name + '. Plainchant saves to it as you write.');
}

// Export: "Save to a file..." Global on purpose: the e2e tests call it.
async function saveToDisk() {
    flushSave();
    await whenSaved();
    const id = currentScriptId;
    const script = getScripts()[id];
    if (!script) return;
    let handle;
    try { handle = await window.showSaveFilePicker({ suggestedName: Fountain.fileName(script.content), types: FileSync.TYPES }); } catch (e) { return; }
    const other = await scriptOfFile(handle); // one file, one script: an older link to it goes
    if (other && other !== id) await forgetFile(other);
    await queueFileWork(() => writeLinkedFile({ scriptId: id, handle: handle, name: handle.name, synced: null, modified: null }, script.content));
    prepareFileChoice();
    showNotice('Saved to ' + handle.name + '. Plainchant keeps saving to it as you write.');
}

async function stopSavingToFile() {
    const link = fileLinks[currentScriptId];
    if (!link) return;
    await forgetFile(currentScriptId);
    prepareFileChoice();
    showNotice('No longer saving to ' + link.name + '. The script stays in the Library.');
}

// The Export dialog's "File on disk" section, as it is for the open script. Called by openExport (export.js).
function prepareFileChoice() {
    const section = document.getElementById('fileChoice');
    section.hidden = !fileSupport;
    if (!fileSupport) return;
    const link = fileLinks[currentScriptId];
    document.getElementById('fileChoiceSays').textContent = link
        ? 'This script is saved to ' + link.name + ' as you write, as well as in the Library.'
        : 'Keep this script in a .fountain file of your own as well: every save writes it too.';
    document.getElementById('saveFileBtn').hidden = !!link;
    document.getElementById('unlinkFileBtn').hidden = !link;
}

// Another script is open now (persistence.js, rememberCurrent): the bar was about the last one; read this one's file
function fileScriptOpened() {
    if (fileBarState && fileBarState.id !== currentScriptId) showFileBar(null);
    if (fileLinks[currentScriptId]) syncFile(currentScriptId);
}

// At start-up, after the Library has loaded (main.js)
async function startFiles() {
    document.getElementById('libOpenFile').hidden = !fileSupport;
    if (!fileSupport || !scriptDb) return;
    await queueFileWork(async () => {
        try { fileLinks = await Store.loadLinks(scriptDb); } catch (e) { fileLinks = {}; }
    });
    if (fileLinks[currentScriptId]) syncFile(currentScriptId);
}

// --- Wiring ---
document.getElementById('libOpenFile').addEventListener('click', openFromDisk);
document.getElementById('saveFileBtn').addEventListener('click', saveToDisk);
document.getElementById('unlinkFileBtn').addEventListener('click', stopSavingToFile);
document.getElementById('fileAllowBtn').addEventListener('click', async () => {
    const state = fileBarState, link = state && fileLinks[state.id];
    if (!link) return;
    if (await fileAllowed(link, true)) { showFileBar(null); syncFile(state.id); }
});
document.getElementById('fileLoadBtn').addEventListener('click', () => {
    const state = fileBarState, link = state && fileLinks[state.id];
    if (!link || !state.disk) return;
    showFileBar(null);
    queueFileWork(() => loadLinkedFile(state.id, link, state.disk));
});
document.getElementById('fileKeepBtn').addEventListener('click', () => {
    const state = fileBarState, link = state && fileLinks[state.id];
    if (!link || !state.disk) return;
    showFileBar(null);
    queueFileWork(async () => { // the file's words are kept as a version before they are written over
        const now = Date.now();
        const script = getScripts()[state.id];
        await Store.addVersion(scriptDb, Versions.make(Object.assign({}, script, { content: state.disk.text, updatedAt: state.disk.modified }),
            newId(), now, { note: link.name + ' as it was on disk, before Plainchant saved over it' }), Versions, now);
        await writeLinkedFile(link, script.content);
        showNotice('Saved the script here to ' + link.name + '. What the file said is kept in Versions.');
    });
});
// A script opened, or the window back in view: the file may have changed in another program meanwhile
window.addEventListener('focus', () => { if (fileLinks[currentScriptId]) syncFile(currentScriptId); });
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && fileLinks[currentScriptId]) syncFile(currentScriptId);
});
