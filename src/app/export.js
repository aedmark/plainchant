/*
 * Plainchant app script: export: the Export dialog, the .fountain download, and Copy (the chapters are in chapters-ui.js)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

const copyBtn = document.getElementById('copyBtn');
const exportBtn = document.getElementById('exportBtn');

// Brief confirmation on a button ("Copied!", "Exported!"). The original label is remembered once, so clicking again
// before it reverts cannot leave the button stuck on the confirmation.
const flashTimers = new WeakMap();
function flashButton(button, label, ok = true) {
    if (!button.dataset.label) button.dataset.label = button.innerText;
    button.innerText = label;
    button.classList.toggle('success', ok);
    clearTimeout(flashTimers.get(button));
    flashTimers.set(button, setTimeout(() => {
        button.innerText = button.dataset.label;
        button.classList.remove('success');
    }, 2000));
}

// Hands `text` to the browser as a file download. Global on purpose: the e2e tests replace it to capture exports.
function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); // some browsers only honour the click on a link that is in the page
    a.click();
    document.body.removeChild(a);

    // Some browsers (iOS Safari) start the download just after click() returns, so don't revoke at once
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const exportModal = document.getElementById('export-modal');

// Export opens a choice: the .fountain file, or screenplay pages to print / save as PDF (src/app/print.js)
function openExport() {
    if (!editor.value.trim()) { flashButton(exportBtn, 'Nothing to export', false); return; }
    preparePrintChoice();
    prepareChapters();
    openModal(exportModal, { focus: '#exportFountain' });
}

// Export: the whole script as a .fountain file named after its title (P3-01). Fountain is plain text, so any text
// editor opens the file too, and screenwriting apps that read Fountain open it as a script.
function exportScript() {
    const text = editor.value;
    closeModal(exportModal);
    if (!text.trim()) { flashButton(exportBtn, 'Nothing to export', false); return; }
    downloadText(Fountain.fileName(text), text.replace(/\n*$/, '\n')); // a text file ends with exactly one newline
    flashButton(exportBtn, 'Exported!');
}

exportBtn.addEventListener('click', openExport);
document.getElementById('exportFountain').addEventListener('click', exportScript);

// The async Clipboard API works even while the editor is hidden (previewing on a phone) but needs a secure context;
// elsewhere (e.g. plain http on a LAN) the text goes through a hidden copy and execCommand, leaving the editor's own
// selection and the focus where they were. Global on purpose: chapters-ui.js copies with it too.
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        const back = document.activeElement;
        const scratch = document.body.appendChild(document.createElement('textarea'));
        scratch.value = text;
        scratch.setAttribute('readonly', '');
        scratch.className = 'sr-only';
        scratch.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { /* not copied */ }
        scratch.remove();
        if (back && back.focus) back.focus({ preventScroll: true });
        return ok;
    }
}

copyBtn.addEventListener('click', async () => {
    const ok = await copyText(editor.value);
    flashButton(copyBtn, ok ? 'Copied!' : 'Copy failed', ok);
});
