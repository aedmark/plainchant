(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Versions = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
    const AUTO_EVERY = 10 * MIN;

    function due(stored, latest, now, next) {
        if (!stored || stored.deletedAt || !String(stored.content || '').trim()) return false;
        if (next && next.content === stored.content) return false;
        if (!latest) return true;
        if (latest.content === stored.content) return false;
        return now - latest.takenAt >= AUTO_EVERY;
    }

    function make(script, id, now, extra) {
        const v = { id: id, scriptId: script.id, title: script.title, content: script.content, updatedAt: script.updatedAt, takenAt: now };
        const more = extra || {};
        if (more.name) v.name = String(more.name);
        if (more.note) v.note = String(more.note);
        return v;
    }

    function slot(v, now) {
        const age = now - v.takenAt;
        if (age < HOUR) return 'v' + v.id;
        if (age < DAY) return 'h' + Math.floor(v.takenAt / HOUR);
        if (age < 30 * DAY) return 'd' + Math.floor(v.takenAt / DAY);
        return 'm' + Math.floor(v.takenAt / (30 * DAY));
    }

    function prune(list, now) {
        const taken = {};
        const drop = [];
        list.filter((v) => !v.name).slice().sort((a, b) => b.takenAt - a.takenAt).forEach((v) => {
            const key = slot(v, now);
            if (taken[key]) drop.push(v.id);
            else taken[key] = true;
        });
        return drop;
    }

    return { AUTO_EVERY: AUTO_EVERY, due: due, make: make, prune: prune };
});
