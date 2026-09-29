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

const NARRATION_EXAMPLE = [
    'Title: Inside the Broom Closet: How the Odyssey Still Works',
    'Credit: A video essay by',
    'Author: Your Name Here',
    '',
    '= A narrated video: what is said is dialogue under NARRATOR, what is shown is action. Script stats says how long it takes to read aloud, and Export turns the # parts into YouTube chapters.',
    '',
    'NARRATOR',
    'Some games age badly. Some age like milk left on a spaceship. And then there is Space Odyssey, a game about a custodian that somehow still works, forty years later.',
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
    '~Thanks for watching, and don\'t forget your towel! (oh wait... wrong game!)',
    '',
    'NARRATOR',
    'I will see you next time.',
    '',
    '> THE END <',
    ''
].join('\n');

function loadExampleScript(text = EXAMPLE_SCRIPT) {
    flushSave();
    currentScriptId = newId();
    editor.value = text;
    elementMode = null;
    rememberCurrent();
    render();
    saveScript(true);
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
