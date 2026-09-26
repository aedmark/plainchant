/*
 * Plainchant app script: library: search, open, rename, duplicate, delete with Recently deleted (the rules are in src/library.js)
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

const libraryBtn = document.getElementById('libraryBtn');
const libraryModal = document.getElementById('library-modal');
const libraryList = document.getElementById('library-list');

// --- Library (P3-07): search, open, rename, duplicate, delete with Recently deleted ---
// The data rules live in src/library.js (pure, unit-tested); this draws the list and applies the results.
// Deleting is soft: a deleted script waits in "Recently deleted" for 30 days and can be restored.
// Renaming rewrites the script's own Title: line, so the name travels with the text.
const librarySearch = document.getElementById('librarySearch');
const libViewScripts = document.getElementById('libViewScripts');
const libViewTrash = document.getElementById('libViewTrash');
const libraryStatus = document.getElementById('library-status');
let libraryView = 'scripts';   // 'scripts' | 'trash'
let libraryQuery = '';
let renamingId = null;         // the script whose title is being edited in place
let armedId = null;            // "Delete forever" waiting for its confirming second click ('*' = all of them)
let armedTimer = null;
let toastTimer = null;

// Build elements without innerHTML: script titles and text are the writer's, so they only ever become text
function h(tag, props, kids) {
    const node = document.createElement(tag);
    Object.keys(props || {}).forEach((k) => {
        if (k === 'text') node.textContent = props[k];
        else if (k === 'class') node.className = props[k];
        else node.setAttribute(k, props[k]);
    });
    (kids || []).forEach((c) => node.appendChild(c));
    return node;
}

// The first lines of the script's body, skipping the title page (which the title already shows)
function previewOf(content) {
    const head = String(content || '').slice(0, 2000);
    const kinds = Fountain.classifyLines(head);
    const lines = head.split('\n');
    const at = kinds.findIndex((k) => k !== 'title_page' && k !== 'blank');
    return at === -1 ? '' : lines.slice(at, at + 3).join(' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function libraryTitleOf(script) {
    return Fountain.fullTitle(script.content) || script.title || 'Untitled Script';
}

function showToast(message, undo) {
    clearTimeout(toastTimer);
    libraryStatus.textContent = '';
    const bar = h('div', { class: 'library-toast' }, [h('span', { text: message })]);
    if (undo) {
        const undoBtn = h('button', { type: 'button', class: 'chip', text: 'Undo' });
        undoBtn.addEventListener('click', () => { clearTimeout(toastTimer); libraryStatus.textContent = ''; undo(); renderLibrary(); });
        bar.appendChild(undoBtn);
    }
    libraryStatus.appendChild(bar);
    toastTimer = setTimeout(() => { libraryStatus.textContent = ''; }, 8000);
}

function focusIn(selector) {
    const node = libraryList.querySelector(selector);
    if (node) node.focus({ preventScroll: true });
    return !!node;
}

function scriptRow(script, now) {
    const title = libraryTitleOf(script);
    const item = h('div', { class: 'script-item', 'data-id': script.id });

    if (renamingId === script.id) {
        const input = h('input', { type: 'text', maxlength: '120', 'aria-label': 'New title', 'data-esc-local': '' });
        input.value = title;
        const form = h('form', { class: 'rename-form' }, [
            input,
            h('button', { type: 'submit', class: 'btn primary', text: 'Save' }),
            h('button', { type: 'button', class: 'btn', 'data-action': 'cancel-rename', text: 'Cancel' })
        ]);
        form.addEventListener('submit', (e) => { e.preventDefault(); commitRename(script.id, input.value, input); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelRename(script.id); }
        });
        item.appendChild(form);
    } else {
        const words = Library.wordCount(script.content);
        item.appendChild(h('button', { type: 'button', class: 'script-open', 'data-action': 'open' }, [
            h('div', { class: 'script-title', text: title }),
            h('div', { class: 'script-preview', text: previewOf(script.content) }),
            h('div', { class: 'script-meta', text: 'Edited ' + Library.relativeTime(script.updatedAt, now) + ' · ' + words + (words === 1 ? ' word' : ' words') })
        ]));
    }
    if (renamingId === script.id) return item; // while renaming, the form is the only thing on the row
    const label = (verb) => verb + ' “' + title + '”';
    item.appendChild(h('div', { class: 'script-actions' }, [
        h('button', { type: 'button', class: 'mini', 'data-action': 'rename', 'aria-label': label('Rename'), text: 'Rename' }),
        h('button', { type: 'button', class: 'mini', 'data-action': 'duplicate', 'aria-label': label('Duplicate'), text: 'Duplicate' }),
        storageMode === 'idb' ? h('button', { type: 'button', class: 'mini', 'data-action': 'versions', 'aria-label': 'Versions of “' + title + '”', text: 'Versions' }) : null,
        h('button', { type: 'button', class: 'mini danger', 'data-action': 'delete', 'aria-label': label('Delete'), text: 'Delete' })
    ].filter(Boolean)));
    return item;
}

function trashRow(script, now) {
    const title = libraryTitleOf(script);
    const left = Library.daysLeft(script, now);
    const armed = armedId === script.id;
    return h('div', { class: 'script-item', 'data-id': script.id }, [
        h('div', { class: 'script-title', text: title }),
        h('div', { class: 'script-preview', text: previewOf(script.content) }),
        h('div', { class: 'script-meta', text: 'Deleted ' + Library.relativeTime(script.deletedAt, now) + ' · removed for good in ' + left + (left === 1 ? ' day' : ' days') }),
        h('div', { class: 'script-actions' }, [
            h('button', { type: 'button', class: 'mini', 'data-action': 'restore', 'aria-label': 'Restore “' + title + '”', text: 'Restore' }),
            h('button', { type: 'button', class: 'mini danger' + (armed ? ' armed' : ''), 'data-action': 'purge',
                'aria-label': (armed ? 'Really delete “' : 'Delete forever “') + title + '”', text: armed ? 'Really delete?' : 'Delete forever' })
        ])
    ]);
}

function renderLibrary() {
    const scripts = getScripts();
    const now = Date.now();
    const live = Library.active(scripts);
    const gone = Library.trashed(scripts);
    const inTrash = libraryView === 'trash';

    libViewScripts.setAttribute('aria-pressed', String(!inTrash));
    libViewTrash.setAttribute('aria-pressed', String(inTrash));
    libViewTrash.textContent = gone.length ? 'Recently deleted (' + gone.length + ')' : 'Recently deleted';

    libraryList.textContent = '';
    if (inTrash && gone.length) {
        const armedAll = armedId === '*';
        libraryList.appendChild(h('p', { class: 'library-note' }, [
            document.createTextNode('Deleted scripts are kept for ' + Library.TRASH_DAYS + ' days, then removed for good.'),
            h('button', { type: 'button', class: 'mini danger' + (armedAll ? ' armed' : ''), 'data-action': 'purge-all', text: armedAll ? 'Really delete all?' : 'Delete all forever' })
        ]));
    }

    const shown = Library.search(inTrash ? gone : live, libraryQuery);
    if (!shown.length) {
        let message;
        if (libraryQuery.trim()) message = 'No scripts match “' + libraryQuery.trim() + '”.';
        else if (inTrash) message = 'Nothing has been deleted.';
        else message = 'No saved scripts yet. Start writing and your script appears here.';
        libraryList.appendChild(h('p', { class: 'library-note', text: message }));
        return;
    }
    shown.forEach((s) => libraryList.appendChild(inTrash ? trashRow(s, now) : scriptRow(s, now)));
}

function openScriptById(id) {
    const script = getScripts()[id];
    if (!script || script.deletedAt) return;
    flushSave();
    currentScriptId = id;
    editor.value = script.content;
    elementMode = null;
    rememberCurrent();
    render();
    syncElementState();
    closeModal(libraryModal);
}

function cancelRename(id) {
    renamingId = null;
    renderLibrary();
    focusIn('[data-id="' + id + '"] [data-action="rename"]');
}

// The open script is edited through applyEdit (so its undo history and the cursor survive); the others are
// rewritten in storage. Either way it is the script's own Title: line that changes.
function commitRename(id, value, input) {
    const title = value.replace(/\s+/g, ' ').trim();
    if (!title) { input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    if (id === currentScriptId) {
        const oldText = editor.value;
        const newText = Fountain.setTitle(oldText, title);
        if (newText !== oldText) {
            applyEdit(Editing.diffEdit(oldText, newText, editor.selectionStart, editor.selectionEnd), { keepFocus: true });
        }
        flushSave();
    } else {
        const result = Library.rename(getScripts(), id, title, Date.now());
        if (!result) return;
        putScripts(result.scripts);
    }
    renamingId = null;
    renderLibrary();
    focusIn('[data-id="' + id + '"] [data-action="rename"]');
}

function duplicateScript(id) {
    flushSave(); // the copy should include the latest words
    const result = Library.duplicate(getScripts(), id, newId(), Date.now());
    if (!result) return;
    putScripts(result.scripts);
    renderLibrary();
    showToast('Duplicated as “' + libraryTitleOf(result.scripts[result.id]) + '”');
    focusIn('[data-id="' + result.id + '"] [data-action="open"]');
}

function deleteScript(id) {
    const wasOpen = id === currentScriptId;
    if (wasOpen) flushSave(); // whatever was typed in the last moments goes into the copy that can be restored
    const scripts = getScripts();
    const script = scripts[id];
    if (!script) return;
    const title = libraryTitleOf(script);
    putScripts(Library.softDelete(scripts, id, Date.now()));
    if (wasOpen) { // leave the writer on a blank page; nothing will autosave into the deleted script
        clearTimeout(autoSaveTimer);
        currentScriptId = newId();
        editor.value = '';
        elementMode = null;
        rememberCurrent();
        render();
        syncElementState();
    }
    renderLibrary();
    showToast('Deleted “' + title + '”', () => {
        putScripts(Library.restore(getScripts(), id));
        if (wasOpen && !editor.value.trim()) { // put it back on the page if nothing else has been started
            currentScriptId = id;
            editor.value = getScripts()[id].content;
            rememberCurrent();
            render();
            syncElementState();
        }
    });
    if (!focusIn('.script-open')) librarySearch.focus({ preventScroll: true });
}

function restoreScript(id) {
    const script = getScripts()[id];
    if (!script) return;
    putScripts(Library.restore(getScripts(), id));
    renderLibrary();
    showToast('Restored “' + libraryTitleOf(script) + '”');
    if (!focusIn('.script-open')) libViewScripts.focus({ preventScroll: true });
}

function disarm() { armedId = null; clearTimeout(armedTimer); }

// Deleting for good needs two deliberate clicks: the first turns the button red and asks "Really delete?"
function purgeScript(id) {
    if (armedId !== id) {
        disarm();
        armedId = id;
        armedTimer = setTimeout(() => { armedId = null; renderLibrary(); }, 4000);
        renderLibrary();
        focusIn(id === '*' ? '[data-action="purge-all"]' : '[data-id="' + id + '"] [data-action="purge"]');
        return;
    }
    disarm();
    const scripts = getScripts();
    let next = scripts;
    if (id === '*') Library.trashed(scripts).forEach((s) => { next = Library.removeForever(next, s.id); });
    else next = Library.removeForever(scripts, id);
    putScripts(next);
    renderLibrary();
    showToast('Removed for good');
    if (!focusIn('.script-open, [data-action="restore"]')) libViewScripts.focus({ preventScroll: true });
}

function setLibraryView(view) {
    libraryView = view;
    renamingId = null;
    disarm();
    renderLibrary();
}

function openLibrary() {
    flushSave(); // so the list shows the latest words of the script that is open
    libraryQuery = '';
    librarySearch.value = '';
    libraryView = 'scripts';
    renamingId = null;
    disarm();
    libraryStatus.textContent = '';
    renderLibrary();
    openModal(libraryModal, { focus: '#library-list .script-open' });
}

libraryList.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const item = button.closest('.script-item');
    const id = item ? item.dataset.id : null;
    switch (button.dataset.action) {
        case 'open': openScriptById(id); break;
        case 'rename':
            renamingId = id;
            renderLibrary();
            { const input = libraryList.querySelector('.rename-form input'); if (input) { input.focus(); input.select(); } }
            break;
        case 'cancel-rename': cancelRename(id); break;
        case 'duplicate': duplicateScript(id); break;
        case 'versions': openVersions(id); break; // versions-ui.js
        case 'delete': deleteScript(id); break;
        case 'restore': restoreScript(id); break;
        case 'purge': purgeScript(id); break;
        case 'purge-all': purgeScript('*'); break;
    }
});
librarySearch.addEventListener('input', () => { libraryQuery = librarySearch.value; renamingId = null; disarm(); renderLibrary(); });
libViewScripts.addEventListener('click', () => setLibraryView('scripts'));
libViewTrash.addEventListener('click', () => setLibraryView('trash'));

// --- Wiring ---
libraryBtn.addEventListener('click', openLibrary);
