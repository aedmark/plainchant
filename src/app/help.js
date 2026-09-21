/*
 * Plainchant app script: help: the Help window and its shortcuts
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// --- Help ---
const helpModal = document.getElementById('help-modal');
const helpBody = helpModal.querySelector('.modal-body');
const helpSections = Array.from(helpModal.querySelectorAll('.help-section'));
const helpTabs = Array.from(helpModal.querySelectorAll('.help-nav [data-section]'));

function showHelpSection(name) {
    helpSections.forEach((s) => { s.hidden = s.dataset.section !== name; });
    helpTabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.section === name)));
    helpBody.scrollTop = 0;
}

function openHelp(section) {
    showHelpSection(section || 'start');
    openModal(helpModal, { focus: '.help-nav [aria-pressed="true"]' });
}

helpTabs.forEach((t) => t.addEventListener('click', () => showHelpSection(t.dataset.section)));
document.getElementById('helpBtn').addEventListener('click', () => openHelp('start'));
document.querySelector('.el-help').addEventListener('click', () => openHelp('elements'));
document.addEventListener('keydown', (e) => {
    if (e.key === 'F1' || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
        e.preventDefault(); // F1 would otherwise open the browser's own help
        if (!openModals.length) openHelp('start');
    }
});
