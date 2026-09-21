/*
 * Tiny test harness that runs unchanged in a browser (test/index.html) and in Node (test/run.js).
 * No dependencies. Exposes: test(name, fn), assert, runTests() -> [{ name, ok, error }].
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const registry = [];

    function test(name, fn) { registry.push({ name: name, fn: fn }); }

    function fail(message, actual, expected) {
        const err = new Error(message);
        err.actual = actual;
        err.expected = expected;
        throw err;
    }

    const show = function (v) { return JSON.stringify(v); };

    const assert = {
        ok: function (v, msg) { if (!v) fail(msg || 'expected truthy, got ' + show(v)); },
        equal: function (a, b, msg) {
            if (a !== b) fail((msg ? msg + ': ' : '') + 'expected ' + show(b) + ' but got ' + show(a), a, b);
        },
        deepEqual: function (a, b, msg) {
            if (show(a) !== show(b)) fail((msg ? msg + ': ' : '') + 'expected ' + show(b) + ' but got ' + show(a), a, b);
        },
        includes: function (hay, needle, msg) {
            if (String(hay).indexOf(needle) === -1) fail((msg ? msg + ': ' : '') + show(hay) + ' does not contain ' + show(needle));
        },
        excludes: function (hay, needle, msg) {
            if (String(hay).indexOf(needle) !== -1) fail((msg ? msg + ': ' : '') + show(hay) + ' unexpectedly contains ' + show(needle));
        }
    };

    function runTests() {
        return registry.map(function (t) {
            try { t.fn(); return { name: t.name, ok: true }; }
            catch (e) { return { name: t.name, ok: false, error: e.message }; }
        });
    }

    return { test: test, assert: assert, runTests: runTests };
});
