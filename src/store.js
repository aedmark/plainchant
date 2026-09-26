/*
 * Script storage in IndexedDB (P4-10, D-018): the pure rules plus a thin layer over the browser's IndexedDB.
 *
 * One record per script in the `scripts` store, keyed by id: { id, title, content, updatedAt, deletedAt? }, the same
 * shape the library has always had (D-013), a `meta` store for the open-script pointer, and a `versions` store of
 * kept copies of scripts (P4-05, D-034; src/versions.js decides when), found by script through the `byScript` index.
 * The page keeps the whole library in memory as { [id]: script } and writes only what changed.
 *
 * The pure half (diff, guardSave, reconcile) never touches a browser API and is
 * unit-tested under Node. The IndexedDB half takes the database (or the IDBFactory) as an argument and never reads
 * window, so the page decides which one to use. Every write creates its transaction synchronously, before
 * returning: IndexedDB runs read-write transactions in the order they were created, so writes land in the order they
 * were made, and one made while the page is being hidden is already queued before the page can go away.
 * Loads as window.Store in the browser and via require() in Node. (Not "Storage": that name is the browser's own.)
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Store = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const DB_NAME = 'plainchant';
    const DB_VERSION = 2; // 2: the versions store
    const SCRIPTS = 'scripts';
    const META = 'meta';
    const VERSIONS = 'versions';
    const BY_SCRIPT = 'byScript'; // [scriptId, takenAt]: a script's versions, oldest first
    const ofScript = (id) => IDBKeyRange.bound([id, -Infinity], [id, Infinity]);

    const isRecord = (s) => !!s && typeof s === 'object' && typeof s.id === 'string' && s.id !== '' && typeof s.content === 'string';

    // --- Pure rules ---

    /** What to write to turn `before` into `after`: records that are new or replaced, and ids that are gone. */
    function diff(before, after) {
        const put = [];
        const remove = [];
        Object.keys(after).forEach((id) => { if (after[id] !== before[id]) put.push(after[id]); });
        Object.keys(before).forEach((id) => { if (!Object.prototype.hasOwnProperty.call(after, id)) remove.push(id); });
        return { put: put, remove: remove };
    }

    /**
     * The record a save should really write, given what storage holds under that id now. Words are never written
     * into a deleted script (that would quietly bring it back): they go to a new script under freshId instead.
     */
    function guardSave(existing, record, freshId) {
        if (!existing || !existing.deletedAt) return record;
        const moved = Object.assign({}, record, { id: freshId });
        delete moved.deletedAt;
        return moved;
    }

    /**
     * Put back words from the emergency buffer (entries { id, title, content, updatedAt } written synchronously as
     * the page was hidden) when storage did not get them. An entry is used only when it is newer than the stored
     * script and says something different; one for a deleted script becomes a new script (makeId()), like any save.
     * Returns { scripts, restored: [records written], currentId: where the newest restored entry went, or null }.
     */
    function reconcile(scripts, entries, makeId) {
        const next = Object.assign({}, scripts);
        const restored = [];
        let currentId = null;
        let newest = -Infinity;
        (Array.isArray(entries) ? entries : []).forEach((e) => {
            if (!isRecord(e) || typeof e.updatedAt !== 'number') return;
            const have = next[e.id];
            if (have && !have.deletedAt && ((have.updatedAt || 0) >= e.updatedAt || have.content === e.content)) return;
            const base = have && !have.deletedAt ? have : {};
            const record = guardSave(have, Object.assign({}, base, {
                id: e.id, title: typeof e.title === 'string' ? e.title : (base.title || ''), content: e.content, updatedAt: e.updatedAt
            }), have && have.deletedAt ? makeId() : e.id);
            next[record.id] = record;
            restored.push(record);
            if (e.updatedAt > newest) { newest = e.updatedAt; currentId = record.id; }
        });
        return { scripts: next, restored: restored, currentId: currentId };
    }

    // --- IndexedDB ---

    const promised = (request) => new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    const finished = (tx) => new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('The write was abandoned.'));
    });

    /** Opens (creating on first use) the database. Rejects when the browser will not give us one. */
    function open(factory) {
        return new Promise((resolve, reject) => {
            if (!factory || typeof factory.open !== 'function') { reject(new Error('IndexedDB is not available.')); return; }
            let request;
            try { request = factory.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(SCRIPTS)) db.createObjectStore(SCRIPTS, { keyPath: 'id' });
                if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' });
                if (!db.objectStoreNames.contains(VERSIONS)) {
                    db.createObjectStore(VERSIONS, { keyPath: 'id' }).createIndex(BY_SCRIPT, ['scriptId', 'takenAt']);
                }
            };
            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => db.close(); // a newer version of the app, in another tab, needs to upgrade
                resolve(db);
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab.'));
        });
    }

    /** Everything stored: { scripts: { [id]: script }, meta: { [key]: value } }. */
    function loadAll(db) {
        const tx = db.transaction([SCRIPTS, META], 'readonly');
        const scripts = promised(tx.objectStore(SCRIPTS).getAll());
        const meta = promised(tx.objectStore(META).getAll());
        return Promise.all([scripts, meta]).then(([list, pairs]) => {
            const out = { scripts: {}, meta: {} };
            list.forEach((s) => { out.scripts[s.id] = s; });
            pairs.forEach((p) => { out.meta[p.key] = p.value; });
            return out;
        });
    }

    function putMeta(store, meta) {
        Object.keys(meta || {}).forEach((key) => {
            if (meta[key] === null || meta[key] === undefined) store.delete(key);
            else store.put({ key: key, value: meta[key] });
        });
    }

    // Deletes every version of the script `id`, inside the transaction `versions` belongs to
    function dropVersionsOf(versions, id) {
        const keys = versions.index(BY_SCRIPT).getAllKeys(ofScript(id));
        keys.onsuccess = () => keys.result.forEach((key) => versions.delete(key));
    }

    // Keeps `version` and lets go of whatever `rules.prune` says, among that script's versions
    function keepVersion(versions, version, rules, now) {
        if (version) versions.put(version);
        const all = versions.index(BY_SCRIPT).getAll(ofScript(version.scriptId));
        all.onsuccess = () => rules.prune(all.result, now).forEach((id) => versions.delete(id));
    }

    /**
     * One transaction: remove ids, put records, set meta keys (null removes one). All of it lands, or none. A script
     * removed for good takes its versions with it.
     */
    function write(db, change) {
        const removing = (change.remove || []).length > 0;
        const tx = db.transaction(removing ? [SCRIPTS, META, VERSIONS] : [SCRIPTS, META], 'readwrite');
        const scripts = tx.objectStore(SCRIPTS);
        (change.remove || []).forEach((id) => { scripts.delete(id); dropVersionsOf(tx.objectStore(VERSIONS), id); });
        (change.put || []).forEach((s) => scripts.put(s));
        putMeta(tx.objectStore(META), change.meta);
        return finished(tx);
    }

    /**
     * Saves one script and points `currentScriptId` at it, in one transaction that first re-reads what is stored:
     * another tab may have deleted the script since this one loaded it (guardSave). Resolves { record, deleted }:
     * the record written, whose id differs from the one asked for when the words had to go to a new script, and in
     * that case the deleted script as it is stored (untouched).
     * With `versions` ({ rules: Versions, now, makeId }), the script as it was stored is first kept as a version when
     * the rules say it is due (P4-05), in the same transaction: nothing is lost between the read and the write, and
     * two tabs cannot both keep the same text.
     */
    function saveScript(db, record, freshId, versions) {
        const tx = db.transaction(versions ? [SCRIPTS, META, VERSIONS] : [SCRIPTS, META], 'readwrite');
        const scripts = tx.objectStore(SCRIPTS);
        let written = record;
        let deleted = null;
        const read = scripts.get(record.id);
        read.onsuccess = () => {
            const stored = read.result;
            written = guardSave(stored, record, freshId);
            if (written !== record) deleted = stored;
            scripts.put(written);
            putMeta(tx.objectStore(META), { currentScriptId: written.id });
            if (!versions || !stored) return; // (a deleted script, whose words went elsewhere, is never due)
            const store = tx.objectStore(VERSIONS);
            const last = store.index(BY_SCRIPT).openCursor(ofScript(stored.id), 'prev');
            last.onsuccess = () => {
                const latest = last.result ? last.result.value : null;
                if (versions.rules.due(stored, latest, versions.now, record)) {
                    keepVersion(store, versions.rules.make(stored, versions.makeId(), versions.now), versions.rules, versions.now);
                }
            };
        };
        return finished(tx).then(() => ({ record: written, deleted: deleted }));
    }

    /** Keeps one version (a named one, or the text before going back to another) and prunes that script's versions. */
    function addVersion(db, version, rules, now) {
        const tx = db.transaction([VERSIONS], 'readwrite');
        keepVersion(tx.objectStore(VERSIONS), version, rules, now);
        return finished(tx);
    }

    /** A script's versions, newest first. */
    function loadVersions(db, scriptId) {
        const tx = db.transaction([VERSIONS], 'readonly');
        return promised(tx.objectStore(VERSIONS).index(BY_SCRIPT).getAll(ofScript(scriptId))).then((list) => list.reverse());
    }

    function removeVersion(db, id) {
        const tx = db.transaction([VERSIONS], 'readwrite');
        tx.objectStore(VERSIONS).delete(id);
        return finished(tx);
    }

    return {
        DB_NAME: DB_NAME,
        diff: diff, guardSave: guardSave, reconcile: reconcile,
        open: open, loadAll: loadAll, write: write, saveScript: saveScript,
        addVersion: addVersion, loadVersions: loadVersions, removeVersion: removeVersion
    };
});
