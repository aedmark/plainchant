/*
 * Plainchant app script: settings: the writer's choices (P2-15, P4-06): theme, text size, colours in the editor, blank lines on Enter, capitals as you type
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// Each setting has a default and is remembered per browser in one localStorage key, which holds only what differs
// from the defaults (D-032). The rules they switch live elsewhere: Editing.enter / Editing.autoCase take them as
// options (typing.js passes them), the colour layer (shade.js) is drawn or cleared, and the theme and text size are
// on the page's root element (D-035). The theme is applied as this file loads, before the page is first drawn.
const SETTINGS_KEY = 'plainchant_settings';
const SETTING_DEFAULTS = { theme: 'dark', size: 'normal', colours: true, paragraphs: true, capitals: true };
const SETTING_CHOICES = { theme: ['dark', 'light', 'system'], size: ['small', 'normal', 'large', 'larger'] };
const TEXT_SCALE = { small: 0.875, normal: 1, large: 1.15, larger: 1.3 }; // of the editor's own size (14px; 16px on phones)
const settingsModal = document.getElementById('settings-modal');
const settingBoxes = {
    colours: document.getElementById('setColours'),
    paragraphs: document.getElementById('setParagraphs'),
    capitals: document.getElementById('setCapitals')
};
const systemLight = window.matchMedia('(prefers-color-scheme: light)');

function validSetting(name, value) {
    if (!(name in SETTING_DEFAULTS)) return false;
    if (SETTING_CHOICES[name]) return SETTING_CHOICES[name].indexOf(value) !== -1;
    return typeof value === typeof SETTING_DEFAULTS[name];
}

function readSettings() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { /* unreadable: defaults */ }
    const out = Object.assign({}, SETTING_DEFAULTS);
    Object.keys(SETTING_DEFAULTS).forEach((k) => { if (validSetting(k, saved[k])) out[k] = saved[k]; });
    return out;
}

// Global on purpose: typing.js and shade.js read it, and the e2e tests too
let settings = readSettings();

// The theme actually showing: the chosen one, or the system's for "Match the system"
function themeShown() {
    if (settings.theme === 'system') return systemLight.matches ? 'light' : 'dark';
    return settings.theme;
}

// Puts the theme and the text size on the page's root element (the stylesheet does the rest)
function applyLook() {
    const root = document.documentElement;
    root.dataset.theme = themeShown();
    root.style.setProperty('--editor-scale', String(TEXT_SCALE[settings.size]));
    const bar = document.querySelector('meta[name="theme-color"]'); // the browser's own bar, where it has one
    if (bar) bar.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg-void').trim() || '#0f1115');
}

// Global on purpose: the e2e tests call it
function setSetting(name, value) {
    if (!validSetting(name, value)) return;
    settings = Object.assign({}, settings, { [name]: value });
    const differs = {};
    Object.keys(settings).forEach((k) => { if (settings[k] !== SETTING_DEFAULTS[k]) differs[k] = settings[k]; });
    try {
        if (Object.keys(differs).length) localStorage.setItem(SETTINGS_KEY, JSON.stringify(differs));
        else localStorage.removeItem(SETTINGS_KEY);
    } catch (e) { /* not remembered, but still in effect for this visit */ }
    showSettings();
    if (name === 'colours') setShadeOn(settings.colours);
    if (name === 'theme' || name === 'size') applyLook();
    if (name === 'size') { // the editor's text changed size inside the same box: the layers that follow it must too
        placeShade();
        checkShade();
        updateFocus(true);
    }
}

// The window's controls show the settings as they are
function showSettings() {
    Object.keys(settingBoxes).forEach((k) => { settingBoxes[k].checked = settings[k]; });
    settingsModal.querySelectorAll('input[type="radio"]').forEach((r) => { r.checked = settings[r.name] === r.value; });
}

function openSettings() {
    showSettings();
    openModal(settingsModal);
}

applyLook();

// --- Wiring ---
document.getElementById('settingsBtn').addEventListener('click', openSettings);
Object.keys(settingBoxes).forEach((k) => settingBoxes[k].addEventListener('change', () => setSetting(k, settingBoxes[k].checked)));
settingsModal.querySelectorAll('input[type="radio"]').forEach((r) => r.addEventListener('change', () => { if (r.checked) setSetting(r.name, r.value); }));
systemLight.addEventListener('change', () => { if (settings.theme === 'system') applyLook(); });
