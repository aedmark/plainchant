/*
 * Plainchant app script: safekeeping: asking the browser to keep the library for good (P4-12)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// A browser may clear a site's stored data when its disk runs low, least recently used site first, unless the site
// asked to keep it ("persistent storage") and the browser agreed (D-027). Chrome, Edge and Safari decide without a
// word to the writer, by how much the site is used and whether it is installed; Firefox asks the writer. So
// Plainchant asks once there is work to keep, at most once per page load, and after a no in this browser only again
// when running as an installed app (Firefox would otherwise ask on every visit). The Library says where things
// stand and has a button to ask again: a click, which is when a prompt makes sense.
const KEEP_KEY = 'plainchant_keep_asked'; // '1' once this browser has said no
const keepLine = document.getElementById('library-keep');
const keepText = document.getElementById('keepText');
const keepBtn = document.getElementById('keepBtn');

// Global on purpose: the e2e tests read them.
// null until known | 'kept' | 'at-risk' (not kept, not refused this time) | 'refused' | 'unsupported'
let keepState = null;
let keepAutoAsked = false; // the automatic request has been made on this page load
let keepStarted = null;    // the start-up check, never awaited by start(): Firefox's prompt waits for the writer

function storageManager() {
    const m = navigator.storage;
    return m && typeof m.persist === 'function' && typeof m.persisted === 'function' ? m : null;
}

function runningInstalled() {
    return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

const KEEP_WORDS = {
    'kept': 'This browser has agreed to keep your scripts, even when its disk runs low.',
    'at-risk': 'This browser may clear your scripts if its disk runs low.',
    'refused': 'This browser would not promise to keep your scripts. It decides by how much you use Plainchant; ' +
        'installing it usually helps.'
};

function drawKeepLine() {
    const words = KEEP_WORDS[keepState];
    keepLine.hidden = !words;
    if (!words) return;
    keepText.textContent = words + (keepState === 'kept' ? '' : ' Export keeps a copy of your own.');
    const hideBtn = keepState === 'kept';
    if (hideBtn && document.activeElement === keepBtn) librarySearch.focus(); // never leave focus on a hidden button
    keepBtn.hidden = hideBtn;
}

function setKeepState(state) {
    keepState = state;
    drawKeepLine();
    return state;
}

// What the browser says now, without asking for anything
async function checkKept(manager = storageManager()) {
    if (!manager || storageMode !== 'idb') return setKeepState('unsupported');
    let kept = false;
    try { kept = await manager.persisted(); } catch (e) { /* counted as not kept */ }
    return setKeepState(kept ? 'kept' : keepState === 'refused' ? 'refused' : 'at-risk');
}

// Ask. Firefox shows the writer a prompt; the others answer at once.
async function askToKeep(manager = storageManager()) {
    if (!manager || storageMode !== 'idb') return setKeepState('unsupported');
    let kept = false;
    try { kept = await manager.persist(); } catch (e) { /* counted as a no */ }
    if (!kept) { try { localStorage.setItem(KEEP_KEY, '1'); } catch (e) { /* asked again next time */ } }
    return setKeepState(kept ? 'kept' : 'refused');
}

// The automatic request: at start-up and after each save (persistence.js). Until the library holds a script it
// only looks; then it asks, once per page load. Global on purpose: the e2e tests call it with a stand-in manager.
async function keepWhenWorthIt(manager = storageManager(), installed = runningInstalled()) {
    if (keepAutoAsked) return keepState;
    if (storageMode !== 'idb' || !Library.active(getScripts()).length) return keepState || checkKept(manager);
    keepAutoAsked = true;
    if (await checkKept(manager) !== 'at-risk') return keepState;
    let refusedBefore = false;
    try { refusedBefore = localStorage.getItem(KEEP_KEY) === '1'; } catch (e) { /* storage unavailable */ }
    if (refusedBefore && !installed) return keepState;
    return askToKeep(manager);
}

function startSafekeeping() {
    keepStarted = keepWhenWorthIt();
}

// --- Wiring ---
keepBtn.addEventListener('click', () => askToKeep());
