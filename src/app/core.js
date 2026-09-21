/*
 * Plainchant app script: core: the shared editor references, ids and the render step
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

const editor = document.getElementById('editor');
const renderTarget = document.getElementById('render-target'); // scroll container
const page = document.getElementById('page');                  // where the screenplay is rendered

// crypto.randomUUID is unavailable on plain-http origins (e.g. testing from a phone on the LAN)
function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

let currentScriptId = newId();
let autoSaveTimer;

function render() {
    page.innerHTML = Fountain.toHTML(Fountain.parse(editor.value || editor.getAttribute('placeholder')));
}
