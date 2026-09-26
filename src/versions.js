/*
 * Versions of a script (P4-05): when to keep one, and which to let go. Pure: no DOM, no window, no IndexedDB.
 *
 *   Versions.due(stored, latest, now, next) -> true if `stored` (the script as storage holds it, about to be
 *                                              overwritten by the save of `next`) should be kept first. `latest` is
 *                                              its newest kept version, or null. A save that changes nothing keeps
 *                                              nothing.
 *   Versions.make(script, id, now, extra)   -> { id, scriptId, title, content, updatedAt, takenAt, name?, note? }
 *   Versions.prune(list, now)               -> ids of versions to let go
 *
 * A version is the script as it was *before* a save changed it, so "how it was before I started" is always there:
 * the first save of a visit to a script keeps the old text, then at most one every AUTO_EVERY while it keeps
 * changing. Kept versions thin out with age (D-034): all of the last hour, then the newest of each clock hour for a
 * day, of each day for thirty days, then of each thirty days for good. A version the writer named is never thinned.
 * Loads as window.Versions in the browser and via require() in Node.
 */
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

    // Which age band a version is in, and so which "slot" it competes for (the newest in each slot stays)
    function slot(v, now) {
        const age = now - v.takenAt;
        if (age < HOUR) return 'v' + v.id;                               // the last hour: every one
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
