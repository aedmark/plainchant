/*
 * Real files on disk (P5-01): what to do when a script is linked to a file. Pure: no DOM, no window.
 *
 *   FileSync.canon(text)    -> the text as it is written to a file: \n line endings, exactly one newline at the end
 *   FileSync.decide(state)  -> 'same' | 'write' | 'load' | 'conflict' | 'none'
 *       state: { text: the script's text now, synced: the text the file and the script last agreed on,
 *                modified: the file's lastModified then, disk: { text, modified }: the file now }
 *   FileSync.TYPES          -> the file types to offer in the browser's open and save windows
 *
 * The rule (D-046): whoever changed since the two last agreed wins; if both did, the writer is asked. A file that
 * already says what the script says is simply agreed on ('same'), whoever wrote it (another tab, or the writer
 * saving the same words from a text editor). A file is never written over when it changed outside Plainchant since
 * they last agreed: that is 'conflict' when the script changed too, and 'load' when it did not.
 * Loads as window.FileSync and via require() in Node.
 */
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
