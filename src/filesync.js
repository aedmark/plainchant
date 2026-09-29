(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.FileSync = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const TYPES = [{ description: 'Fountain screenplay', accept: { 'text/plain': ['.fountain', '.txt', '.md'] } }];

    function canon(text) {
        return String(text || '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
    }

    function decide(state) {
        const text = canon(state.text);
        const disk = canon(state.disk.text);
        if (disk === text) return 'same';
        const scriptChanged = text !== state.synced;
        const fileChanged = disk !== state.synced && state.disk.modified !== state.modified;
        if (fileChanged) return scriptChanged ? 'conflict' : 'load';
        return scriptChanged ? 'write' : 'none';
    }

    return { canon: canon, decide: decide, TYPES: TYPES };
});
