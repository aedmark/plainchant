(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'));
    else root.Library = factory(root.Fountain);
})(typeof self !== 'undefined' ? self : this, function (Fountain) {
    'use strict';

    const TRASH_DAYS = 30;
    const DAY = 24 * 60 * 60 * 1000;

    function scriptsOf(scripts) {
        return Object.keys(scripts || {}).map(function (k) { return scripts[k]; }).filter(Boolean);
    }

    function active(scripts) {
        return scriptsOf(scripts).filter(function (s) { return !s.deletedAt; })
            .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    }

    function trashed(scripts) {
        return scriptsOf(scripts).filter(function (s) { return !!s.deletedAt; })
            .sort(function (a, b) { return b.deletedAt - a.deletedAt; });
    }

    function search(list, query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return list.slice();
        return list.filter(function (s) {
            return String(s.title || '').toLowerCase().indexOf(q) !== -1 ||
                String(s.content || '').toLowerCase().indexOf(q) !== -1;
        });
    }

    function copyWith(scripts, id, patch) {
        const next = Object.assign({}, scripts);
        next[id] = Object.assign({}, scripts[id], patch);
        return next;
    }

    function softDelete(scripts, id, now) {
        if (!scripts[id] || scripts[id].deletedAt) return scripts;
        return copyWith(scripts, id, { deletedAt: now });
    }

    function restore(scripts, id) {
        if (!scripts[id] || !scripts[id].deletedAt) return scripts;
        const next = Object.assign({}, scripts);
        const s = Object.assign({}, scripts[id]);
        delete s.deletedAt;
        next[id] = s;
        return next;
    }

    function removeForever(scripts, id) {
        if (!scripts[id]) return scripts;
        const next = Object.assign({}, scripts);
        delete next[id];
        return next;
    }

    function purgeExpired(scripts, now, days) {
        const limit = (days === undefined ? TRASH_DAYS : days) * DAY;
        const next = {};
        const removed = [];
        Object.keys(scripts || {}).forEach(function (id) {
            const s = scripts[id];
            if (s && s.deletedAt && now - s.deletedAt >= limit) removed.push(id);
            else next[id] = s;
        });
        return { scripts: removed.length ? next : scripts, removed: removed };
    }

    function add(scripts, newId, content, now) {
        if (Object.prototype.hasOwnProperty.call(scripts, newId)) return null;
        const next = Object.assign({}, scripts);
        next[newId] = { id: newId, title: Fountain.extractTitle(content), content: content, updatedAt: now };
        return { scripts: next, id: newId };
    }

    function duplicate(scripts, id, newId, now) {
        const src = scripts[id];
        if (!src || src.deletedAt) return null;
        const base = Fountain.fullTitle(src.content) || 'Untitled Script';
        const content = Fountain.setTitle(src.content, base + ' (copy)');
        const next = Object.assign({}, scripts);
        next[newId] = { id: newId, title: Fountain.extractTitle(content), content: content, updatedAt: now };
        return { scripts: next, id: newId };
    }

    function rename(scripts, id, title, now) {
        const t = String(title == null ? '' : title).replace(/\s+/g, ' ').trim();
        if (!t || !scripts[id] || scripts[id].deletedAt) return null;
        const content = Fountain.setTitle(scripts[id].content, t);
        return {
            scripts: copyWith(scripts, id, { content: content, title: Fountain.extractTitle(content), updatedAt: now }),
            content: content
        };
    }

    function wordCount(content) {
        return (String(content || '').match(/\S+/g) || []).length;
    }

    function relativeTime(ts, now) {
        const s = Math.max(0, Math.floor((now - ts) / 1000));
        if (s < 60) return 'just now';
        if (s < 3600) return Math.floor(s / 60) + ' min ago';
        if (s < 86400) return Math.floor(s / 3600) + ' h ago';
        if (s < 7 * 86400) {
            const d = Math.floor(s / 86400);
            return d + (d === 1 ? ' day ago' : ' days ago');
        }
        return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function daysLeft(script, now, days) {
        const total = days === undefined ? TRASH_DAYS : days;
        return Math.max(0, total - Math.floor((now - script.deletedAt) / DAY));
    }

    return {
        TRASH_DAYS: TRASH_DAYS, active: active, trashed: trashed, search: search,
        softDelete: softDelete, restore: restore, removeForever: removeForever, purgeExpired: purgeExpired,
        add: add, duplicate: duplicate, rename: rename, wordCount: wordCount, relativeTime: relativeTime, daysLeft: daysLeft
    };
});
