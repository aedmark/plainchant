const SETTINGS_KEY = 'plainchant_settings';
const SETTING_DEFAULTS = {
    theme: 'dark', size: 'normal', colours: true, paragraphs: true, capitals: true, cues: true,
    pace: Narration.PACE, aloud: 'dialogue', pageView: false, panes: 'both'
};
const SETTING_CHOICES = { panes: ['both', 'write', 'preview'], theme: ['dark', 'light', 'retro', 'system'], size: ['small', 'normal', 'large', 'larger'], aloud: ['dialogue', 'all'] };
const SETTING_RANGES = { pace: [80, 300] };
const TEXT_SCALE = { small: 0.875, normal: 1, large: 1.15, larger: 1.3 };
const settingsModal = document.getElementById('settings-modal');
const settingBoxes = {
    colours: document.getElementById('setColours'),
    paragraphs: document.getElementById('setParagraphs'),
    capitals: document.getElementById('setCapitals'),
    cues: document.getElementById('setCues')
};
const paceBox = document.getElementById('setPace');
const systemLight = window.matchMedia('(prefers-color-scheme: light)');

function validSetting(name, value) {
    if (!(name in SETTING_DEFAULTS)) return false;
    if (SETTING_CHOICES[name]) return SETTING_CHOICES[name].indexOf(value) !== -1;
    if (SETTING_RANGES[name]) return Number.isInteger(value) && value >= SETTING_RANGES[name][0] && value <= SETTING_RANGES[name][1];
    return typeof value === typeof SETTING_DEFAULTS[name];
}

function readSettings() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) {
    }
    const out = Object.assign({}, SETTING_DEFAULTS);
    Object.keys(SETTING_DEFAULTS).forEach((k) => { if (validSetting(k, saved[k])) out[k] = saved[k]; });
    return out;
}

let settings = readSettings();

function themeShown() {
    if (settings.theme === 'system') return systemLight.matches ? 'light' : 'dark';
    return settings.theme;
}

function applyLook() {
    const root = document.documentElement;
    root.dataset.theme = themeShown();
    root.style.setProperty('--editor-scale', String(TEXT_SCALE[settings.size]));
    const bar = document.querySelector('meta[name="theme-color"]');
    if (bar) bar.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg-void').trim() || '#0f1115');
}

function setSetting(name, value) {
    if (!validSetting(name, value)) return;
    settings = Object.assign({}, settings, { [name]: value });
    const differs = {};
    Object.keys(settings).forEach((k) => { if (settings[k] !== SETTING_DEFAULTS[k]) differs[k] = settings[k]; });
    try {
        if (Object.keys(differs).length) localStorage.setItem(SETTINGS_KEY, JSON.stringify(differs));
        else localStorage.removeItem(SETTINGS_KEY);
    } catch (e) {
    }
    showSettings();
    if (name === 'colours') setShadeOn(settings.colours);
    if (name === 'theme' || name === 'size') applyLook();
    if (name === 'size') {
        placeShade();
        checkShade();
        updateFocus(true);
    }
}

function showSettings() {
    Object.keys(settingBoxes).forEach((k) => { settingBoxes[k].checked = settings[k]; });
    paceBox.value = settings.pace;
    settingsModal.querySelectorAll('input[type="radio"]').forEach((r) => { r.checked = settings[r.name] === r.value; });
}

function openSettings() {
    showSettings();
    openModal(settingsModal);
}

applyLook();

document.getElementById('settingsBtn').addEventListener('click', openSettings);
Object.keys(settingBoxes).forEach((k) => settingBoxes[k].addEventListener('change', () => setSetting(k, settingBoxes[k].checked)));
settingsModal.querySelectorAll('input[type="radio"]').forEach((r) => r.addEventListener('change', () => { if (r.checked) setSetting(r.name, r.value); }));
paceBox.addEventListener('change', () => {
    const n = Math.round(Number(paceBox.value));
    const [low, high] = SETTING_RANGES.pace;
    if (paceBox.value.trim() && Number.isFinite(n)) setSetting('pace', Math.min(high, Math.max(low, n)));
    showSettings();
});
systemLight.addEventListener('change', () => { if (settings.theme === 'system') applyLook(); });
