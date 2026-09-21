/*
 * Plainchant app script: import: bring a .fountain / .txt file in as a new script (P3-02)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

const importInput = document.getElementById('importInput');
const dropHint = document.getElementById('dropHint');
let importBusy = false;

// Reads each file, adds every readable one to the Library as a NEW script (nothing is ever overwritten; what was
// being written is saved first), then opens the first. Files that cannot be imported are named with the reason.
// Global on purpose: the e2e tests call it with File objects.
async function importFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length || importBusy) return;
    importBusy = true;
    try {
        const problems = [];
        const readable = [];
        for (const file of files) {
            const verdict = Importing.checkFile(file.name, file.size);
            if (!verdict.ok) { problems.push('“' + file.name + '”: ' + verdict.reason); continue; }
            let read;
            try { read = Importing.readText(new Uint8Array(await file.arrayBuffer())); }
            catch (e) { read = { ok: false, reason: 'That file could not be read.' }; }
            if (!read.ok) { problems.push('“' + file.name + '”: ' + read.reason); continue; }
            readable.push(read.text);
        }

        let opened = null;
        if (readable.length) {
            flushSave();
            let scripts = getScripts();
            const ids = [];
            const now = Date.now();
            readable.forEach((text, i) => { // the first file gets the newest time, so it stays on top of the list
                const added = Library.add(scripts, newId(), text, now - i);
                scripts = added.scripts;
                ids.push(added.id);
            });
            if (putScripts(scripts)) {
                opened = scripts[ids[0]];
                openScriptById(ids[0]);
                editor.setSelectionRange(0, 0);
                editor.scrollTop = 0;
                renderTarget.scrollTop = 0;
                if (mobileMQ.matches) setView('write');
            } else {
                problems.push('There is not enough room left in this browser to keep ' + (readable.length === 1 ? 'that script' : 'those scripts') +
                    '. Export or delete some scripts first.');
            }
        }

        const parts = [];
        if (opened) {
            parts.push(readable.length === 1
                ? 'Imported “' + libraryTitleOf(opened) + '”.'
                : 'Imported ' + readable.length + ' scripts and opened “' + libraryTitleOf(opened) + '”. The others are in your Library.');
        }
        showNotice(parts.concat(problems).join(' '), problems.length > 0);
    } finally {
        importBusy = false;
    }
}

// --- Wiring ---
document.getElementById('libImport').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', () => {
    importFiles(importInput.files);
    importInput.value = ''; // so choosing the same file again still fires "change"
});

// Drag a file anywhere onto the page. Without this the browser would open the dropped file in place of the app.
// Only file drags are handled, so dragging selected text around inside the editor is untouched.
const carriesFiles = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') !== -1;
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    dropHint.hidden = false;
});
window.addEventListener('dragover', (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
});
window.addEventListener('dragleave', (e) => {
    if (!carriesFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropHint.hidden = true;
});
window.addEventListener('drop', (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    dropHint.hidden = true;
    importFiles(e.dataTransfer.files);
});
