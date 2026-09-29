const copyBtn = document.getElementById('copyBtn');
const exportBtn = document.getElementById('exportBtn');

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

function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const exportModal = document.getElementById('export-modal');

function openExport() {
    if (!editor.value.trim()) { flashButton(exportBtn, 'Nothing to export', false); return; }
    preparePrintChoice();
    prepareChapters();
    prepareFileChoice();
    openModal(exportModal, { focus: '#exportFountain' });
}

function exportScript() {
    const text = editor.value;
    closeModal(exportModal);
    if (!text.trim()) { flashButton(exportBtn, 'Nothing to export', false); return; }
    downloadText(Fountain.fileName(text), text.replace(/\n*$/, '\n'));
    flashButton(exportBtn, 'Exported!');
}

function exportFdx() {
    const text = editor.value;
    closeModal(exportModal);
    if (!text.trim()) { flashButton(exportBtn, 'Nothing to export', false); return; }
    downloadText(Fountain.fileName(text, 'fdx'), Fdx.of(text));
    flashButton(exportBtn, 'Exported!');
}

exportBtn.addEventListener('click', openExport);
document.getElementById('exportFdx').addEventListener('click', exportFdx);
document.getElementById('exportFountain').addEventListener('click', exportScript);

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
        try { ok = document.execCommand('copy'); } catch (err) {
        }
        scratch.remove();
        if (back && back.focus) back.focus({ preventScroll: true });
        return ok;
    }
}

copyBtn.addEventListener('click', async () => {
    const ok = await copyText(editor.value);
    flashButton(copyBtn, ok ? 'Copied!' : 'Copy failed', ok);
});
