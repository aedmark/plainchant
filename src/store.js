(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Store = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const DB_NAME = 'plainchant';
    const DB_VERSION = 3;
    const SCRIPTS = 'scripts';
    const META = 'meta';
    const VERSIONS = 'versions';
    const FILES = 'files';
    const BY_SCRIPT = 'byScript';
    const ofScript = (id) => IDBKeyRange.bound([id, -Infinity], [id, Infinity]);

    const isRecord = (s) => !!s && typeof s === 'object' && typeof s.id === 'string' && s.id !== '' && typeof s.content === 'string';

    function diff(before, after) {
        const put = [];
        const remove = [];
        Object.keys(after).forEach((id) => { if (after[id] !== before[id]) put.push(after[id]); });
        Object.keys(before).forEach((id) => { if (!Object.prototype.hasOwnProperty.call(after, id)) remove.push(id); });
        return { put: put, remove: remove };
    }

    function guardSave(existing, record, freshId) {
        if (!existing || !existing.deletedAt) return record;
        const moved = Object.assign({}, record, { id: freshId });
        delete moved.deletedAt;
        return moved;
    }

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

    const promised = (request) => new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    const finished = (tx) => new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('The write was abandoned.'));
    });

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
                if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: 'scriptId' });
            };
            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => db.close();
                resolve(db);
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab.'));
        });
    }

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

    function dropVersionsOf(versions, id) {
        const keys = versions.index(BY_SCRIPT).getAllKeys(ofScript(id));
        keys.onsuccess = () => keys.result.forEach((key) => versions.delete(key));
    }

    function keepVersion(versions, version, rules, now) {
        if (version) versions.put(version);
        const all = versions.index(BY_SCRIPT).getAll(ofScript(version.scriptId));
        all.onsuccess = () => rules.prune(all.result, now).forEach((id) => versions.delete(id));
    }

    function write(db, change) {
        const removing = (change.remove || []).length > 0;
        const tx = db.transaction(removing ? [SCRIPTS, META, VERSIONS, FILES] : [SCRIPTS, META], 'readwrite');
        const scripts = tx.objectStore(SCRIPTS);
        (change.remove || []).forEach((id) => {
            scripts.delete(id);
            dropVersionsOf(tx.objectStore(VERSIONS), id);
            tx.objectStore(FILES).delete(id);
        });
        (change.put || []).forEach((s) => scripts.put(s));
        putMeta(tx.objectStore(META), change.meta);
        return finished(tx);
    }

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
            if (!versions || !stored) return;
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

    function addVersion(db, version, rules, now) {
        const tx = db.transaction([VERSIONS], 'readwrite');
        keepVersion(tx.objectStore(VERSIONS), version, rules, now);
        return finished(tx);
    }

    function loadVersions(db, scriptId) {
        const tx = db.transaction([VERSIONS], 'readonly');
        return promised(tx.objectStore(VERSIONS).index(BY_SCRIPT).getAll(ofScript(scriptId))).then((list) => list.reverse());
    }

    function removeVersion(db, id) {
        const tx = db.transaction([VERSIONS], 'readwrite');
        tx.objectStore(VERSIONS).delete(id);
        return finished(tx);
    }

    function putLink(db, link) {
        const tx = db.transaction([FILES], 'readwrite');
        tx.objectStore(FILES).put(link);
        return finished(tx);
    }

    function loadLinks(db) {
        const tx = db.transaction([FILES], 'readonly');
        return promised(tx.objectStore(FILES).getAll()).then((list) => {
            const out = {};
            list.forEach((l) => { out[l.scriptId] = l; });
            return out;
        });
    }

    function removeLink(db, scriptId) {
        const tx = db.transaction([FILES], 'readwrite');
        tx.objectStore(FILES).delete(scriptId);
        return finished(tx);
    }

    return {
        DB_NAME: DB_NAME,
        diff: diff, guardSave: guardSave, reconcile: reconcile,
        open: open, loadAll: loadAll, write: write, saveScript: saveScript,
        addVersion: addVersion, loadVersions: loadVersions, removeVersion: removeVersion,
        putLink: putLink, loadLinks: loadLinks, removeLink: removeLink
    };
});
