/*
 * Plainchant app script: main: start-up, once the page is ready
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

let startup = null;

// Reopen the last script (or show the placeholder example on a blank editor). Loading the library is asynchronous
// (IndexedDB, D-018), so the page is drawn once it is in.
async function start() {
    fitToViewport();
    await restoreLastScript();
    render();
    syncElementState();
    restoreFocusMode();
    maybeShowTour();
}

// Resolves once the app has started. Global on purpose: the e2e tests wait on it after every page load.
function whenReady() {
    return startup || Promise.resolve();
}

window.addEventListener('DOMContentLoaded', () => { startup = start(); });
