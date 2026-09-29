const importInput = document.getElementById('importInput');
const dropHint = document.getElementById('dropHint');
let importBusy = false;

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
            readable.forEach((text, i) => {
                const added = Library.add(scripts, newId(), text, now - i);
                scripts = added.scripts;
                ids.push(added.id);
            });
            if (await putScripts(scripts)) {
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

document.getElementById('libImport').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', () => {
    importFiles(importInput.files);
    importInput.value = '';
});

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
