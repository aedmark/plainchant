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
        e.preventDefault();
        if (!openModals.length) openHelp('start');
    }
});
