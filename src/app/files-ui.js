const fileSupport = typeof window.showOpenFilePicker === 'function' && typeof window.showSaveFilePicker === 'function';
const fileBar = document.getElementById('file-bar');
const fileBarText = document.getElementById('fileBarText');
let fileLinks = {};
let fileWork = Promise.resolve();
let fileBarState = null;

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
        ? 'To keep syncing with ' + name + ', Plainchant needs your permission again.'
        : name + ' was changed outside Plainchant, and so was the script here. Which should both become?';
}

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
            showNotice(link.name + ' can no longer be read (moved or deleted?), so Plainchant has stopped syncing with it. The script is safe in the Library.', true);
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

async function scriptOfFile(handle) {
    for (const id of Object.keys(fileLinks)) {
        try { if (await fileLinks[id].handle.isSameEntry(handle)) return id; } catch (e) {
        }
    }
    return null;
}

async function openFromDisk() {
    let handle;
    try { [handle] = await window.showOpenFilePicker({ types: FileSync.TYPES, multiple: false }); } catch (e) { return; }
    const known = await scriptOfFile(handle);
    if (known && getScripts()[known] && !getScripts()[known].deletedAt) {
        openScriptById(known);
        await syncFile(known);
        showNotice('Opened ' + fileLinks[known].name + ', which is already in the Library.');
        return;
    }
    if (known) await forgetFile(known);
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
    showNotice('Opened ' + handle.name + '. It stays in sync: every save writes it.');
}

async function saveToDisk() {
    flushSave();
    await whenSaved();
    const id = currentScriptId;
    const script = getScripts()[id];
    if (!script) return;
    let handle;
    try { handle = await window.showSaveFilePicker({ suggestedName: Fountain.fileName(script.content), types: FileSync.TYPES }); } catch (e) { return; }
    const other = await scriptOfFile(handle);
    if (other && other !== id) await forgetFile(other);
    await queueFileWork(() => writeLinkedFile({ scriptId: id, handle: handle, name: handle.name, synced: null, modified: null }, script.content));
    prepareFileChoice();
    showNotice('Synced with ' + handle.name + ': every save writes it from now on.');
}

async function stopSavingToFile() {
    const link = fileLinks[currentScriptId];
    if (!link) return;
    await forgetFile(currentScriptId);
    prepareFileChoice();
    showNotice('No longer syncing with ' + link.name + '. The script stays in the Library, and the file stays as it is.');
}

function prepareFileChoice() {
    const section = document.getElementById('fileChoice');
    section.hidden = !fileSupport;
    if (!fileSupport) return;
    const link = fileLinks[currentScriptId];
    document.getElementById('fileChoiceSays').textContent = link
        ? 'This script is synced with ' + link.name + ': every save writes it, and changes made to the file elsewhere come back here.'
        : 'Keep this script in a .fountain file wherever you like. Every save writes it, and changes made to the file elsewhere come back here.';
    document.getElementById('saveFileBtn').hidden = !!link;
    document.getElementById('unlinkFileBtn').hidden = !link;
}

function fileScriptOpened() {
    if (fileBarState && fileBarState.id !== currentScriptId) showFileBar(null);
    if (fileLinks[currentScriptId]) syncFile(currentScriptId);
}

async function startFiles() {
    document.getElementById('libOpenFile').hidden = !fileSupport;
    if (!fileSupport || !scriptDb) return;
    await queueFileWork(async () => {
        try { fileLinks = await Store.loadLinks(scriptDb); } catch (e) { fileLinks = {}; }
    });
    if (fileLinks[currentScriptId]) syncFile(currentScriptId);
}

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
    queueFileWork(async () => {
        const now = Date.now();
        const script = getScripts()[state.id];
        await Store.addVersion(scriptDb, Versions.make(Object.assign({}, script, { content: state.disk.text, updatedAt: state.disk.modified }),
            newId(), now, { note: link.name + ' as it was on disk, before Plainchant saved over it' }), Versions, now);
        await writeLinkedFile(link, script.content);
        showNotice('Saved the script here to ' + link.name + '. What the file said is kept in Versions.');
    });
});
window.addEventListener('focus', () => { if (fileLinks[currentScriptId]) syncFile(currentScriptId); });
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && fileLinks[currentScriptId]) syncFile(currentScriptId);
});
