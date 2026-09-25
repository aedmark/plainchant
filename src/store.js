/*
 * Script storage in IndexedDB (P4-10, D-018): the pure rules plus a thin layer over the browser's IndexedDB.
 *
 * One record per script in the `scripts` store, keyed by id: { id, title, content, updatedAt, deletedAt? }, the same
 * shape the library has always had (D-013), and a `meta` store for the open-script pointer and the migration flag.
 * The page keeps the whole library in memory as { [id]: script } and writes only what changed.
 *
 * The pure half (parseLegacy, diff, mergeLegacy, guardSave, reconcile) never touches a browser API and is
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
    const DB_VERSION = 1;
    const SCRIPTS = 'scripts';
    const META = 'meta';
    const SCHEMA_VERSION = 1;

    const isRecord = (s) => !!s && typeof s === 'object' && typeof s.id === 'string' && s.id !== '' && typeof s.content === 'string';

    // --- Pure rules ---

    /** The old localStorage library (a JSON string, or null) as { [id]: script }. Anything unreadable is left out. */
    function parseLegacy(json) {
        let data;
        try { data = JSON.parse(json); } catch (e) { return {}; }
        const out = {};
        if (!data || typeof data !== 'object' || Array.isArray(data)) return out;
        Object.keys(data).forEach((key) => {
            const s = data[key];
            if (!s || typeof s !== 'object' || typeof s.content !== 'string') return;
            const record = Object.assign({}, s, { id: typeof s.id === 'string' && s.id ? s.id : key });
            if (!(typeof record.updatedAt === 'number')) record.updatedAt = 0;
            out[record.id] = record;
        });
        return out;
    }

    /** What to write to turn `before` into `after`: records that are new or replaced, and ids that are gone. */
    function diff(before, after) {
        const put = [];
        const remove = [];
        Object.keys(after).forEach((id) => { if (after[id] !== before[id]) put.push(after[id]); });
        Object.keys(before).forEach((id) => { if (!Object.prototype.hasOwnProperty.call(after, id)) remove.push(id); });
        return { put: put, remove: remove };
    }

    /** The old scripts worth copying into IndexedDB: those it lacks, or holds an older version of. Never a newer one. */
    function mergeLegacy(existing, legacy) {
        return Object.keys(legacy).map((id) => legacy[id]).filter((s) => {
            const have = existing[s.id];
            return !have || (have.updatedAt || 0) < (s.updatedAt || 0);
        });
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

    /** One transaction: remove ids, put records, set meta keys (null removes one). All of it lands, or none. */
    function write(db, change) {
        const tx = db.transaction([SCRIPTS, META], 'readwrite');
        const scripts = tx.objectStore(SCRIPTS);
        (change.remove || []).forEach((id) => scripts.delete(id));
        (change.put || []).forEach((s) => scripts.put(s));
        putMeta(tx.objectStore(META), change.meta);
        return finished(tx);
    }

    /**
     * Saves one script and points `currentScriptId` at it, in one transaction that first re-reads what is stored:
     * another tab may have deleted the script since this one loaded it (guardSave). Resolves { record, deleted }:
     * the record written, whose id differs from the one asked for when the words had to go to a new script, and in
     * that case the deleted script as it is stored (untouched).
     */
    function saveScript(db, record, freshId) {
        const tx = db.transaction([SCRIPTS, META], 'readwrite');
        const scripts = tx.objectStore(SCRIPTS);
        let written = record;
        let deleted = null;
        const read = scripts.get(record.id);
        read.onsuccess = () => {
            written = guardSave(read.result, record, freshId);
            if (written !== record) deleted = read.result;
            scripts.put(written);
            putMeta(tx.objectStore(META), { currentScriptId: written.id });
        };
        return finished(tx).then(() => ({ record: written, deleted: deleted }));
    }

    /**
     * The one-time copy of the old localStorage library into IndexedDB (legacy: { scripts: JSON or null,
     * current: id or null }). One transaction that checks the `migrated` flag first, so two tabs opening at once
     * cannot both run it, and an interrupted run leaves nothing half-done. The old keys are not touched (D-018).
     * Resolves the number of scripts copied (0 when it had already run).
     */
    function migrate(db, legacy) {
        const tx = db.transaction([SCRIPTS, META], 'readwrite');
        const scripts = tx.objectStore(SCRIPTS);
        const meta = tx.objectStore(META);
        let copied = 0;
        meta.get('migrated').onsuccess = (flag) => {
            if (flag.target.result && flag.target.result.value === '1') return;
            scripts.getAll().onsuccess = (all) => {
                const existing = {};
                all.target.result.forEach((s) => { existing[s.id] = s; });
                const toCopy = mergeLegacy(existing, parseLegacy(legacy && legacy.scripts));
                toCopy.forEach((s) => scripts.put(s));
                copied = toCopy.length;
                meta.get('currentScriptId').onsuccess = (cur) => {
                    const pointer = legacy && typeof legacy.current === 'string' && legacy.current ? legacy.current : null;
                    const values = { migrated: '1', schemaVersion: SCHEMA_VERSION };
                    if (pointer && !cur.target.result) values.currentScriptId = pointer;
                    putMeta(meta, values);
                };
            };
        };
        return finished(tx).then(() => copied);
    }

    return {
        DB_NAME: DB_NAME,
        parseLegacy: parseLegacy, diff: diff, mergeLegacy: mergeLegacy, guardSave: guardSave, reconcile: reconcile,
        open: open, loadAll: loadAll, write: write, saveScript: saveScript, migrate: migrate
    };
});
