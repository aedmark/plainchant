/*
 * Plainchant app script: settings: the writer's choices (P2-15): colours in the editor, blank lines on Enter, capitals as you type
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// Each setting is on by default and remembered per browser in one localStorage key, which holds only what differs
// from the defaults (D-032). The rules they switch live elsewhere: Editing.enter / Editing.autoCase take them as
// options (typing.js passes them), and the colour layer (shade.js) is drawn or cleared.
const SETTINGS_KEY = 'plainchant_settings';
const SETTING_DEFAULTS = { colours: true, paragraphs: true, capitals: true };
const settingsModal = document.getElementById('settings-modal');
const settingBoxes = {
    colours: document.getElementById('setColours'),
    paragraphs: document.getElementById('setParagraphs'),
    capitals: document.getElementById('setCapitals')
};

function readSettings() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { /* unreadable: defaults */ }
    const out = Object.assign({}, SETTING_DEFAULTS);
    Object.keys(SETTING_DEFAULTS).forEach((k) => { if (typeof saved[k] === 'boolean') out[k] = saved[k]; });
    return out;
}

// Global on purpose: typing.js and shade.js read it, and the e2e tests too
let settings = readSettings();

// Global on purpose: the e2e tests call it
function setSetting(name, on) {
    if (!(name in SETTING_DEFAULTS)) return;
    settings = Object.assign({}, settings, { [name]: !!on });
    const differs = {};
    Object.keys(settings).forEach((k) => { if (settings[k] !== SETTING_DEFAULTS[k]) differs[k] = settings[k]; });
    try {
        if (Object.keys(differs).length) localStorage.setItem(SETTINGS_KEY, JSON.stringify(differs));
        else localStorage.removeItem(SETTINGS_KEY);
    } catch (e) { /* not remembered, but still in effect for this visit */ }
    settingBoxes[name].checked = settings[name];
    if (name === 'colours') setShadeOn(settings.colours);
}

function openSettings() {
    Object.keys(settingBoxes).forEach((k) => { settingBoxes[k].checked = settings[k]; });
    openModal(settingsModal);
}

// --- Wiring ---
document.getElementById('settingsBtn').addEventListener('click', openSettings);
Object.keys(settingBoxes).forEach((k) => settingBoxes[k].addEventListener('change', () => setSetting(k, settingBoxes[k].checked)));
