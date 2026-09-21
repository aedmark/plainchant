/*
 * Plainchant app script: export: Export and Copy
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

const copyBtn = document.getElementById('copyBtn');
const exportBtn = document.getElementById('exportBtn');

// Generate physical text file export dynamically
exportBtn.addEventListener('click', () => {
    const rawText = editor.value;
    if (!rawText.trim()) return;

    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const title = lines.length > 0 ? lines[0].substring(0, 40).replace(/[^a-z0-9]/gi, '_').toLowerCase() : "untitled_script";

    const blob = new Blob([rawText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.txt`;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Copy functionality
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

    // Brief UI feedback
    const originalText = copyBtn.innerText;
    copyBtn.innerText = ok ? "Copied!" : "Copy failed";
    copyBtn.classList.toggle('success', ok);

    setTimeout(() => {
        copyBtn.innerText = originalText;
        copyBtn.classList.remove('success');
    }, 2000);
});
