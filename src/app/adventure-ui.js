function adventureFacts(text, lineNo) {
    const s = Stats.of(text, { paper: paperChoice() });
    let scene = null;
    s.sceneList.forEach((sc) => { if (sc.line <= lineNo) scene = sc; });
    return {
        scene: scene ? scene.text : null,
        characters: scene ? scene.characters : [],
        words: s.words,
        scripts: Library.active(getScripts()).length,
        pages: s.pages
    };
}

function adventureReplyFor(e) {
    if (e.target !== editor || applyingEdit || e.isComposing || shiftDown) return null;
    if (e.inputType !== 'insertLineBreak' && e.inputType !== 'insertParagraph') return null;
    if (themeShown() !== 'retro' || (elementMode && elementMode !== 'action')) return null;
    const text = editor.value, at = editor.selectionStart;
    if (at !== editor.selectionEnd) return null;
    const start = text.lastIndexOf('\n', at - 1) + 1;
    const end = text.indexOf('\n', at) === -1 ? text.length : text.indexOf('\n', at);
    if (text.slice(at, end).trim()) return null;
    const key = Adventure.command(text.slice(start, end));
    if (!key) return null;
    if (start > 0 && text.slice(text.lastIndexOf('\n', start - 2) + 1, start - 1).trim()) return null;
    const typed = text.slice(start, end).trim().toUpperCase();
    if (Suggest.names(text).indexOf(typed) !== -1) return null;
    return Adventure.reply(key, adventureFacts(text, text.slice(0, start).split('\n').length - 1));
}

document.addEventListener('beforeinput', (e) => {
    const answer = adventureReplyFor(e);
    if (answer) setTimeout(() => showNotice(answer), 0);
}, true);
