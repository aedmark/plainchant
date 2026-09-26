/*
 * Plainchant app script: offline: the service worker and the web app manifest, when served over http(s) (P4-02)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// Served over http(s), the app registers sw.js (a copy of the app that works with no connection) and links the
// manifest (so it can be installed). Opened from disk there is nothing to do: browsers run no service workers for
// file:// pages, and a manifest link there only produces a console error. The fonts are local either way (fonts/).
// Global on purpose: the e2e tests read it. 'file' | 'unsupported' | 'pending' | 'registered' | 'failed'
let offlineState = 'pending';

function setUpOffline() {
    if (!/^https?:$/.test(location.protocol)) { offlineState = 'file'; return; }
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = 'manifest.webmanifest';
    document.head.appendChild(manifest);
    if (!('serviceWorker' in navigator)) { offlineState = 'unsupported'; return; }
    navigator.serviceWorker.register('sw.js').then(
        () => { offlineState = 'registered'; },
        (e) => { offlineState = 'failed'; console.warn('The offline copy could not be set up:', e); });
}

// --- Wiring ---
window.addEventListener('load', setUpOffline); // after the page has everything it needs, so this never slows start-up
