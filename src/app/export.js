/*
 * Plainchant app script: export: Export and Copy
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

// Export: the whole script as a .fountain file named after its title (P3-01). Fountain is plain text, so any text
// editor opens the file too, and screenwriting apps that read Fountain open it as a script.
function exportScript() {
    const text = editor.value;
    if (!text.trim()) { flashButton(exportBtn, 'Nothing to export', false); return; }
    downloadText(Fountain.fileName(text), text.replace(/\n*$/, '\n')); // a text file ends with exactly one newline
    flashButton(exportBtn, 'Exported!');
}

exportBtn.addEventListener('click', exportScript);

// The async Clipboard API works even while the textarea is hidden (previewing on a phone) but needs a secure
// context; fall back to selecting the textarea and execCommand elsewhere (e.g. plain http on a LAN).
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        editor.select();
        return document.execCommand('copy');
    }
}

copyBtn.addEventListener('click', async () => {
    const ok = await copyText(editor.value);
    flashButton(copyBtn, ok ? 'Copied!' : 'Copy failed', ok);
});
