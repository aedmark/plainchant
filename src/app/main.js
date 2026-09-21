/*
 * Plainchant app script: main: start-up, once the page is ready
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// Reopen the last script (or show the placeholder example on a blank editor)
window.addEventListener('DOMContentLoaded', () => {
    restoreLastScript();
    render();
    fitToViewport();
    syncElementState();
    maybeShowTour();
});
