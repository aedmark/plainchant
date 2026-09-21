/*
 * Plainchant app script: persistence: saving, restoring the last script, New, the trash purge
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

const SCRIPTS_KEY = 'frictionless_scripts';   // legacy prefix kept on purpose (D-005)
const CURRENT_KEY = 'frictionless_current';   // id of the script that was open last

const saveBtn = document.getElementById('saveBtn');
const newBtn = document.getElementById('newBtn');

function getScripts() {
    try {
        const data = localStorage.getItem(SCRIPTS_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error("Failed to parse local storage", e);
        return {};
    }
}

function rememberCurrent() {
    try { localStorage.setItem(CURRENT_KEY, currentScriptId); } catch (e) { /* storage unavailable */ }
}

// Reopen whatever was open last. With no pointer at all (first run after upgrading from the prototype)
// fall back to the most recently saved script. A pointer to a script that was never saved means the
// writer had just hit New, so start blank.
// A pointer to a deleted script means the writer deleted the script that was open: start blank, and never reuse
// its id, or the next autosave would write into the Recently deleted copy.
function restoreLastScript() {
    purgeTrash();
    let pointer = null;
    try { pointer = localStorage.getItem(CURRENT_KEY); } catch (e) { /* storage unavailable */ }
    const scripts = getScripts();

    let script = pointer ? scripts[pointer] : null;
    const pointerDeleted = !!(script && script.deletedAt);
    if (pointerDeleted) script = null;
    if (!pointer) script = Library.active(scripts)[0] || null;

    if (script) {
        currentScriptId = script.id;
        editor.value = script.content;
    } else if (pointer && !pointerDeleted) {
        currentScriptId = pointer;
    }
    rememberCurrent();
}

function putScripts(scripts) {
    try { localStorage.setItem(SCRIPTS_KEY, JSON.stringify(scripts)); return true; }
    catch (e) { console.error('Save error:', e); return false; }
}

// Scripts deleted 30 days ago or more are removed for good (Library.TRASH_DAYS)
function purgeTrash() {
    const result = Library.purgeExpired(getScripts(), Date.now());
    if (result.removed.length) putScripts(result.scripts);
}

function startNewScript() {
    flushSave();
    currentScriptId = newId();
    editor.value = '';
    elementMode = null;
    rememberCurrent();
    render();
    syncElementState();
    // In one-pane mode the writer may be looking at the preview: bring them back to the blank page
    if (mobileMQ.matches) setView('write');
    else editor.focus();
}

// Save immediately, skipping the autosave delay. Used when the page is about to go away.
function flushSave() {
    clearTimeout(autoSaveTimer);
    if (editor.value.trim()) saveScript(true);
}

function saveScript(isAuto = false) {
    const rawText = editor.value;
    if (!rawText.trim()) return;

    const title = Fountain.extractTitle(rawText);

    const originalText = saveBtn.innerText;
    if (!isAuto) {
        saveBtn.innerText = "Saving...";
    }

    try {
        const scripts = getScripts();
        // Never write into a script that has been deleted (it would quietly bring it back); if this id has
        // been deleted, the words in the editor are saved as a new script instead.
        if (scripts[currentScriptId] && scripts[currentScriptId].deletedAt) currentScriptId = newId();
        scripts[currentScriptId] = Object.assign({}, scripts[currentScriptId], {
            id: currentScriptId,
            title: title,
            content: rawText,
            updatedAt: Date.now()
        });
        localStorage.setItem(SCRIPTS_KEY, JSON.stringify(scripts));
        rememberCurrent();

        if (!isAuto) {
            saveBtn.innerText = "Saved!";
            saveBtn.classList.add('success');
        }
    } catch (e) {
        console.error("Save error:", e);
        if (!isAuto) saveBtn.innerText = "Error";
    }

    if (!isAuto) {
        setTimeout(() => {
            saveBtn.innerText = originalText;
            saveBtn.classList.remove('success');
        }, 2000);
    }
}

// --- Wiring ---
saveBtn.addEventListener('click', () => saveScript(false));
newBtn.addEventListener('click', startNewScript);

// The last 2 s of typing would otherwise be lost if the tab closes or the phone backgrounds the page
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
});
window.addEventListener('pagehide', flushSave);
