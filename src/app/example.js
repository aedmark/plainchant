/*
 * Plainchant app script: example: the example script, which teaches by example
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// --- Example script: teaches by example, and every element in it is real ---
const EXAMPLE_SCRIPT = [
    'Title: The Last Coffee',
    'Credit: Written by',
    'Author: Your Name Here',
    '',
    'FADE IN:',
    '',
    'INT. COFFEE SHOP - DAY',
    '',
    'Rain hits the window. The cafe is empty except for MARA (30s), who glares at a blinking cursor. [[A note to yourself: it shows highlighted here and never in the finished script.]]',
    '',
    'MARA',
    '(to herself)',
    'Just type. Don\'t think.',
    '',
    'The door BURSTS open. DEV (30s, soaked) stands there holding two coffees.',
    '',
    'DEV',
    'You\'ve been here all night?',
    '',
    'MARA',
    'I\'ve been here all *week*.',
    '',
    'DEV ^',
    'Same.',
    '',
    'CUT TO:',
    '',
    'EXT. ROOFTOP - LATER',
    '',
    'They sit on the edge and share the coffees. The city hums below.',
    '',
    '> THE END <',
    ''
].join('\n');

function loadExampleScript() {
    flushSave();
    currentScriptId = newId();
    editor.value = EXAMPLE_SCRIPT;
    elementMode = null;
    rememberCurrent();
    render();
    saveScript(true); // straight into the Library, so it is a real script from now on
    editor.setSelectionRange(0, 0);
    editor.scrollTop = 0;
    renderTarget.scrollTop = 0;
    syncElementState();
    openModals.slice().forEach((m) => closeModal(m.overlay));
    if (mobileMQ.matches) setView('write');
}

document.getElementById('helpLoadExample').addEventListener('click', loadExampleScript);
document.getElementById('tourExample').addEventListener('click', loadExampleScript);
