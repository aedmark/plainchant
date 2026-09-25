/*
 * Plainchant app script: persistence: the library in IndexedDB, saving, restoring the last script, New, the trash purge, save on hide
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// Storage (D-018, D-020). The whole library lives in memory as { [id]: script } (the shape src/library.js works on)
// and each change writes only the scripts it touched, to IndexedDB (src/store.js). IndexedDB writes finish later, so
// every save also leaves its words in a small synchronous localStorage "emergency buffer" until the write has landed:
// words typed just before the tab closes survive even if the write never finishes. Without IndexedDB nothing can be
// stored, and the writer is told so.
const EMERGENCY_KEY = 'plainchant_emergency'; // { [id]: { id, title, content, updatedAt } } not yet confirmed in IndexedDB

const saveBtn = document.getElementById('saveBtn');
const newBtn = document.getElementById('newBtn');

let library = {};         // every script, in memory: the working model
let scriptDb = null;      // the IndexedDB connection
let storageMode = null;   // 'idb' | 'none' (this browser will not store anything) | null while starting up
const pendingWrites = new Set();
const libraryChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('plainchant-library') : null;

function getScripts() {
    return library;
}

// --- The emergency buffer ---
function readEmergency() {
    try {
        const data = JSON.parse(localStorage.getItem(EMERGENCY_KEY) || '{}');
        return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch (e) { return {}; }
}

function writeEmergency(entries) {
    try {
        if (Object.keys(entries).length) localStorage.setItem(EMERGENCY_KEY, JSON.stringify(entries));
        else localStorage.removeItem(EMERGENCY_KEY);
    } catch (e) { /* storage unavailable or full: the IndexedDB write still goes ahead */ }
}

// Once a write has landed, its words no longer need the buffer (unless newer words for that script arrived since)
function clearEmergency(id, upTo) {
    const entries = readEmergency();
    if (entries[id] && entries[id].updatedAt <= upTo) { delete entries[id]; writeEmergency(entries); }
}

// --- Writing ---
function track(promise) {
    pendingWrites.add(promise);
    promise.then(() => pendingWrites.delete(promise));
    return promise;
}

// Resolves once every write made so far has landed. Global on purpose: the e2e tests wait on it.
async function whenSaved() {
    while (pendingWrites.size) await Promise.all(Array.from(pendingWrites));
}

// Other tabs keep their own copy of the library in memory; tell them what changed so theirs does not go stale
function announce(change) {
    if (libraryChannel && ((change.put && change.put.length) || (change.remove && change.remove.length))) {
        try { libraryChannel.postMessage({ put: change.put || [], remove: change.remove || [] }); } catch (e) { /* never block a save */ }
    }
}

// Writes one change ({ put, remove, meta }) and resolves true once it is stored, false if the browser refused
function persist(change) {
    if (storageMode !== 'idb') return Promise.resolve(false);
    let written;
    try { written = Store.write(scriptDb, change); } catch (e) { written = Promise.reject(e); }
    return track(written.then(() => { announce(change); return true; }, (e) => { console.error('Save error:', e); return false; }));
}

// Replace the library with `next` (from src/library.js) and store the difference. Resolves true once stored. If the
// browser refuses (full), what could not be stored is taken back out of memory, unless something changed it since.
function putScripts(next) {
    const before = library;
    const change = Store.diff(before, next);
    library = next;
    return persist(change).then((ok) => {
        if (ok) return true;
        const back = Object.assign({}, library);
        change.put.forEach((s) => {
            if (library[s.id] !== s) return;
            if (before[s.id]) back[s.id] = before[s.id]; else delete back[s.id];
        });
        change.remove.forEach((id) => { if (!(id in library) && before[id]) back[id] = before[id]; });
        library = back;
        return false;
    });
}

function rememberCurrent() {
    persist({ meta: { currentScriptId: currentScriptId } });
}

// --- Starting up ---
function receiveLibraryChange(e) {
    const change = e.data || {};
    const next = Object.assign({}, library);
    (change.put || []).forEach((s) => { if (s && s.id) next[s.id] = s; });
    (change.remove || []).forEach((id) => { delete next[id]; });
    library = next;
}

// Open storage and load the library into memory; resolves the id of the script that was open last (or null).
// Without IndexedDB (site data blocked, a very old browser) nothing can be kept: the writer is told, and can still
// write and Export. `factory` is the IDBFactory; left out, it is the page's own (reading it can throw).
async function openStorage(factory) {
    let pointer = null;
    try {
        const db = await Store.open(factory === undefined ? window.indexedDB : factory);
        const all = await Store.loadAll(db);
        scriptDb = db;
        storageMode = 'idb';
        library = all.scripts;
        pointer = typeof all.meta.currentScriptId === 'string' ? all.meta.currentScriptId : null;
    } catch (e) {
        console.error('IndexedDB is unavailable, so nothing can be saved.', e);
        storageMode = 'none';
        library = {};
        showNotice('This browser is not letting Plainchant save anything, so your scripts will not be kept here. ' +
            'Use Export to keep what you write.', true);
        return null; // the emergency buffer is left alone, for when storage works again
    }
    if (libraryChannel) libraryChannel.onmessage = receiveLibraryChange;

    // Words that were typed as the page went away last time, and never reached storage: put them back
    const buffered = readEmergency();
    const found = Store.reconcile(library, Object.values(buffered), newId);
    if (found.restored.length) {
        if (!(await putScripts(found.scripts))) return pointer; // not stored: the buffer keeps them for next time
        pointer = found.currentId;
        await persist({ meta: { currentScriptId: pointer } });
    }
    const left = readEmergency(); // everything read is now stored (or stale); keep only what changed since
    Object.keys(buffered).forEach((id) => { if (!left[id] || !buffered[id] || left[id].updatedAt === buffered[id].updatedAt) delete left[id]; });
    writeEmergency(left);
    return pointer;
}

// Reopen whatever was open last. With no pointer at all, fall back to the most recently saved script. A pointer to a script that was never saved means the
// writer had just hit New, so start blank.
// A pointer to a deleted script means the writer deleted the script that was open: start blank, and never reuse
// its id, or the next autosave would write into the Recently deleted copy.
// Takes the IndexedDB factory so the e2e tests can start it without one (null: no storage at all).
async function restoreLastScript(factory) {
    const pointer = await openStorage(factory);
    purgeTrash();
    const scripts = getScripts();

    let script = pointer ? scripts[pointer] : null;
    const pointerDeleted = !!(script && script.deletedAt);
    if (pointerDeleted) script = null;
    if (!pointer) script = Library.active(scripts)[0] || null;

    if (script) {
        currentScriptId = script.id;
        editor.value = script.content;
    } else if (pointer && !pointerDeleted) {
        currentScriptId = pointer;
    }
    rememberCurrent();
}

// Scripts deleted 30 days ago or more are removed for good (Library.TRASH_DAYS)
function purgeTrash() {
    const result = Library.purgeExpired(getScripts(), Date.now());
    if (result.removed.length) putScripts(result.scripts);
}

function startNewScript() {
    flushSave();
    currentScriptId = newId();
    editor.value = '';
    elementMode = null;
    rememberCurrent();
    render();
    syncElementState();
    // In one-pane mode the writer may be looking at the preview: bring them back to the blank page
    if (mobileMQ.matches) setView('write');
    else editor.focus();
}

// Save immediately, skipping the autosave delay. Used when the page is about to go away.
function flushSave() {
    clearTimeout(autoSaveTimer);
    if (editor.value.trim()) saveScript(true);
}

function saveScript(isAuto = false) {
    const rawText = editor.value;
    if (!rawText.trim()) return;
    if (!storageMode) return; // still starting up: nothing has been loaded, so there is nothing to save over yet

    const title = Fountain.extractTitle(rawText);

    const originalText = saveBtn.innerText;
    if (!isAuto) {
        saveBtn.innerText = "Saving...";
    }
    const finish = (ok) => {
        if (isAuto) return;
        saveBtn.innerText = ok ? "Saved!" : "Error";
        if (ok) saveBtn.classList.add('success');
        setTimeout(() => {
            saveBtn.innerText = originalText;
            saveBtn.classList.remove('success');
        }, 2000);
    };

    if (storageMode === 'none') { finish(false); return; } // nowhere to keep it (the writer was told at start-up)

    const scripts = getScripts();
    // Never write into a script that has been deleted (it would quietly bring it back); if this id has been deleted,
    // the words in the editor are saved as a new script instead. Store.saveScript checks again as it writes, for a
    // delete in another tab that this one has not heard about.
    if (scripts[currentScriptId] && scripts[currentScriptId].deletedAt) currentScriptId = newId();
    const record = Object.assign({}, scripts[currentScriptId], {
        id: currentScriptId,
        title: title,
        content: rawText,
        updatedAt: Date.now()
    });
    library = Object.assign({}, scripts, { [record.id]: record });

    // First, synchronously, the words go into the emergency buffer: the page may be gone before IndexedDB is done
    const entries = readEmergency();
    entries[record.id] = { id: record.id, title: record.title, content: record.content, updatedAt: record.updatedAt };
    writeEmergency(entries);

    let written;
    try { written = Store.saveScript(scriptDb, record, newId()); } catch (e) { written = Promise.reject(e); }
    track(written.then(({ record: stored, deleted }) => {
        clearEmergency(record.id, record.updatedAt);
        if (deleted) { // another tab had deleted it: the words went to a new script, and this tab now knows
            library = Object.assign({}, library, { [deleted.id]: deleted, [stored.id]: stored });
            if (currentScriptId === record.id) currentScriptId = stored.id;
        }
        announce({ put: [stored] });
        finish(true);
    }, (e) => {
        console.error("Save error:", e);
        finish(false);
    }));
}

// --- Wiring ---
saveBtn.addEventListener('click', () => saveScript(false));
newBtn.addEventListener('click', startNewScript);

// The last 2 s of typing would otherwise be lost if the tab closes or the phone backgrounds the page
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
});
window.addEventListener('pagehide', flushSave);
