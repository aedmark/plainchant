const KEEP_KEY = 'plainchant_keep_asked';
const keepLine = document.getElementById('library-keep');
const keepText = document.getElementById('keepText');
const keepBtn = document.getElementById('keepBtn');

let keepState = null;
let keepAutoAsked = false;
let keepStarted = null;

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
    if (hideBtn && document.activeElement === keepBtn) librarySearch.focus();
    keepBtn.hidden = hideBtn;
}

function setKeepState(state) {
    keepState = state;
    drawKeepLine();
    return state;
}

async function checkKept(manager = storageManager()) {
    if (!manager || storageMode !== 'idb') return setKeepState('unsupported');
    let kept = false;
    try { kept = await manager.persisted(); } catch (e) {
    }
    return setKeepState(kept ? 'kept' : keepState === 'refused' ? 'refused' : 'at-risk');
}

async function askToKeep(manager = storageManager()) {
    if (!manager || storageMode !== 'idb') return setKeepState('unsupported');
    let kept = false;
    try { kept = await manager.persist(); } catch (e) {
    }
    if (!kept) { try { localStorage.setItem(KEEP_KEY, '1'); } catch (e) {
    } }
    return setKeepState(kept ? 'kept' : 'refused');
}

async function keepWhenWorthIt(manager = storageManager(), installed = runningInstalled()) {
    if (keepAutoAsked) return keepState;
    if (storageMode !== 'idb' || !Library.active(getScripts()).length) return keepState || checkKept(manager);
    keepAutoAsked = true;
    if (await checkKept(manager) !== 'at-risk') return keepState;
    let refusedBefore = false;
    try { refusedBefore = localStorage.getItem(KEEP_KEY) === '1'; } catch (e) {
    }
    if (refusedBefore && !installed) return keepState;
    return askToKeep(manager);
}

function startSafekeeping() {
    keepStarted = keepWhenWorthIt();
}

keepBtn.addEventListener('click', () => askToKeep());
