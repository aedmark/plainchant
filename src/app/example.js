/*
 * Plainchant app script: example: the example scripts (a screenplay, and a narrated video), which teach by example
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

// --- The narration example (P4-21): a narrated video, for the read-aloud time and the video chapters (D-038). Its
// notes explain what counts; its chapters keep YouTube's rules, read either way ("Dialogue only" or "and action").
const NARRATION_EXAMPLE = [
    'Title: Why Broom Closet Odyssey Still Works',
    'Credit: A video essay by',
    'Author: Your Name Here',
    '',
    '= A narrated video: what is said is dialogue under NARRATOR, what is shown is action. Script stats says how long it takes to read aloud, and Export turns the # parts into YouTube chapters.',
    '',
    'NARRATOR',
    'Some games age badly. Some age like milk left on a spaceship. And then there is Broom Closet Odyssey, a game about a janitor that somehow still works, forty years later.',
    '',
    'Title card over the opening screen. [[Action is what the viewer sees. The read-aloud time counts only dialogue, unless Settings says to count the action too.]]',
    '',
    '# The setup',
    '',
    '[[Each line starting with # is a chapter. The words read aloud before it decide its timestamp; the words above the first one become the Intro.]]',
    '',
    'A slow pan across the empty ship.',
    '',
    'NARRATOR',
    'You wake up in a broom closet, halfway through a nap, and the whole crew is gone. Nobody told you anything. Nobody left a note. Honestly, that tracks.',
    '',
    '# The puzzles',
    '',
    '## The vending machine',
    '',
    '[[A ## part sits inside its chapter: only the top level becomes a YouTube chapter.]]',
    '',
    'Gameplay: the vending machine swallows a coin.',
    '',
    'NARRATOR',
    '(quietly)',
    'The puzzles are fair, mostly. Mostly. There is one moment involving a vending machine that I need to talk about, because it haunts me to this day.',
    '',
    'SHIP COMPUTER (V.O.)',
    'Thank you for your purchase. Please do not kick the machine.',
    '',
    '[[Any dialogue is read aloud, a clip of the game\'s own voice included. Parentheticals like (quietly) are not.]]',
    '',
    '# Final thoughts',
    '',
    'NARRATOR',
    'So, is it worth playing today? Absolutely. Just save often, save in different slots, and never, ever trust a vending machine.',
    '',
    '~Thanks for watching, and don\'t forget to mop!',
    '',
    'NARRATOR',
    'I will see you next time.',
    '',
    '> THE END <',
    ''
].join('\n');

// Opens an example as a new script, saved at once. Global on purpose: the e2e tests call it.
function loadExampleScript(text = EXAMPLE_SCRIPT) {
    flushSave();
    currentScriptId = newId();
    editor.value = text;
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

document.getElementById('helpLoadExample').addEventListener('click', () => loadExampleScript());
document.getElementById('tourExample').addEventListener('click', () => loadExampleScript());
document.querySelectorAll('[data-narration-example]').forEach((b) => b.addEventListener('click', () => loadExampleScript(NARRATION_EXAMPLE)));
