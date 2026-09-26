/*
 * Typing helpers (P2-01 to P2-03, P2-11): pure functions that decide what the editor should do.
 *
 * Nothing here touches the DOM. Every function takes the editor's text and caret and returns an *edit*:
 *
 *   { from, to, insert, selStart, selEnd }   replace text[from..to] with `insert`, then select selStart..selEnd
 *
 * The page applies it in a way that keeps the browser's undo history (see applyEdit in index.html). Loads as
 * window.Editing (after fountain.js) in the browser and via require() in Node.
 *
 *   Editing.blockAt(text, caret)              { start, end } of the run of non-blank lines the caret is in (focus mode)
 *   Editing.kindAt(text, lineIndex)            what element a line is: 'scene' | 'action' | 'character' |
 *                                              'parenthetical' | 'dialogue' | 'transition' | 'blank' | others
 *   Editing.enter(text, start, end, mode, opts) smart Enter, or null to let the browser insert a plain newline
 *   Editing.looksLikeCue(line, names)          whether a line on its own reads as a character's name (P2-14)
 *   Editing.tab(text, caret, dir, mode)        { target, edit, mode } for Tab / Shift+Tab, skipping impossible steps
 *   Editing.cycleTarget(text, caret, dir, mode)  the element Tab would pick, ignoring whether it is possible
 *   Editing.setType(text, caret, target, mode)   { edit, mode } converting the current line to `target`, or null
 *   Editing.autoCase(text, caret, mode, opts)  uppercase-as-you-type edit, or null
 *   Editing.diffEdit(old, new, selStart, selEnd)  the smallest edit turning old into new, selection carried across
 *
 * "mode" is the element the writer chose for a line that has no text yet (a blank line cannot say what it is).
 * It is one of 'character' | 'scene' | 'transition' | null and is held by the page, not in the text.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'));
    else root.Editing = factory(root.Fountain);
})(typeof self !== 'undefined' ? self : this, function (Fountain) {
    'use strict';

    // Order Tab walks through outside a dialogue block, and inside one (Shift+Tab walks it backwards)
    const CYCLE = ['action', 'character', 'scene', 'transition'];
    const BLOCK_CYCLE = ['dialogue', 'parenthetical'];
    const MODES = ['character', 'scene', 'transition'];          // element types a blank line can be "set to"
    const STRONG = ['scene', 'transition', 'section', 'synopsis', 'centered', 'lyrics', 'page_break', 'title_page'];
    const NEEDS_BLANK_BEFORE = { character: true, scene: true, transition: true };
    const FORCE = { action: '!', character: '@', scene: '.', transition: '> ' };
    const SCENE_PREFIX_RE = /^(?:INT|EXT|EST|INT\.?\/EXT|EXT\.?\/INT|I\/E)(?:\.|\s)\s*/i;
    // Typed prefixes that are clearly a scene heading, so the line can be uppercased without being told to
    const AUTO_SCENE_RE = /^(?:(?:int|ext|est)\.|(?:int|ext)\.?\/(?:ext|int)\.|i\/e\.?)\s/i;
    const AUTO_TRANSITION_RE = /^[a-z][a-z' ]* to:$/i;
    const WINDOW = 80; // lines of context above the caret that are worth parsing

    // ---------- text helpers ----------

    function lineInfo(text, caret) {
        const before = text.slice(0, caret);
        const idx = before.split('\n').length - 1;
        const start = before.lastIndexOf('\n') + 1;
        let end = text.indexOf('\n', caret);
        if (end === -1) end = text.length;
        return { lines: text.split('\n'), idx: idx, start: start, end: end };
    }

    const isBlank = function (s) { return s === undefined || s.trim() === ''; };

    /** The words of a line with any element markers removed: scene prefix and number, forced markers, parentheses. */
    function plain(line) {
        let s = line.trim();
        s = s.replace(/\s#[\w.\-]+#$/, '');
        if (/^[!@~]/.test(s)) s = s.slice(1).trim();
        else if (s[0] === '.' && s[1] !== '.') s = s.slice(1).trim();
        else if (s[0] === '>') s = s.replace(/^>\s*/, '').replace(/\s*<$/, '');
        s = s.replace(SCENE_PREFIX_RE, '');
        const paren = s.match(/^\((.*)\)$/);
        if (paren) s = paren[1];
        return s.trim();
    }

    /**
     * Classify one line the way the parser will once the writer moves on. The parser needs to see the *next* line to
     * call something a character cue or a transition, and while typing there isn't one yet, so ask twice: once with
     * an empty line after it, once with a line of text.
     */
    function kindAt(text, idx) {
        const lines = text.split('\n');
        const line = lines[idx];
        if (isBlank(line)) return 'blank';

        // Parse only a window of context so a long script stays cheap; start it at a block boundary
        let s = Math.max(0, idx - WINDOW);
        if (s > 0) {
            while (s < idx && !isBlank(lines[s])) s++;
            if (isBlank(lines[s]) && s < idx) s++;
        }
        const upto = lines.slice(s, idx + 1).join('\n');
        const at = idx - s;
        const A = Fountain.classifyLines(upto + '\n')[at];   // followed by a blank line
        const B = Fountain.classifyLines(upto + '\nx')[at];  // followed by more text

        if (STRONG.indexOf(A) !== -1) return A;
        if (A === 'dialogue' || A === 'parenthetical') return A;
        // Sentence punctuation means action ("BANG!", "SILENCE."), even though the spec would allow it as a cue.
        // An explicit @ is the writer saying otherwise.
        if (B === 'character' && (line.trim()[0] === '@' || !/[.!?]$/.test(line.trim()))) return 'character';
        return 'action';
    }

    function inDialogueBlock(text, idx) {
        if (idx <= 0) return false;
        const lines = text.split('\n');
        if (isBlank(lines[idx - 1])) return false;
        const k = kindAt(text, idx - 1);
        return k === 'character' || k === 'dialogue' || k === 'parenthetical';
    }

    // ---------- Enter ----------

    /**
     * Smart Enter. Only acts when the writer is at the end of a block at the end of the script (or before a blank
     * line): the situation where "what comes next" is a guess worth making. Anywhere else, and for selections, it
     * returns null so the browser does its normal thing.
     *   character cue or parenthetical -> new line (the speech comes next)
     *   anything else                  -> blank line (a new element)
     * With `mode` set, the line is also finished off first (uppercased, scene prefix / transition marker added).
     * `options.paragraphs === false` (the writer's setting, P2-15): no blank lines are added; Enter is the browser's
     * plain line break, except that a chosen element is still finished off, followed by one line break.
     * `options.cues = { names }` (P2-14, D-036): a line after a blank line that looksLikeCue() becomes a cue as if the
     * writer had chosen Character: capitals, then straight into the speech.
     */
    function enter(text, start, end, mode, options) {
        const paragraphs = !options || options.paragraphs !== false;
        const cues = options && options.cues;
        if (start !== end) return null;
        const info = lineInfo(text, start);
        if (start !== info.end) return null;                          // not at the end of the line
        if (!isBlank(info.lines[info.idx + 1])) return null;          // more text right below: mid-block edit
        const line = info.lines[info.idx];
        if (isBlank(line)) return null;

        if (mode && MODES.indexOf(mode) !== -1) return finishLine(text, info, mode, paragraphs);
        if (cues && (info.idx === 0 || isBlank(info.lines[info.idx - 1])) && kindAt(text, info.idx) === 'action' &&
            looksLikeCue(line, cues.names)) {
            return finishLine(text, info, 'character', paragraphs);
        }
        if (!paragraphs) return null;

        const kind = kindAt(text, info.idx);
        const sep = (kind === 'character' || kind === 'parenthetical') ? '\n' : '\n\n';
        return { from: start, to: start, insert: sep, selStart: start + sep.length, selEnd: start + sep.length };
    }

    // ---------- guessing a cue (P2-14) ----------

    const CUE_WORD = /^\p{Lu}[\p{L}'’.\-]*$/u; // a capitalised word: Mara, O'Neil, Mary-Jane, Dr.

    /**
     * Whether a line on its own looks like a character's name: one the script already uses as a cue (any case, with
     * or without an extension), or a new one written with capitals, one to three words, not ending like a sentence.
     * "Mara enters." and "Night falls" do not; "Detective Ruiz" and "mara (v.o.)" (if MARA speaks) do.
     */
    function looksLikeCue(line, names) {
        let name = String(line || '').trim();
        while (/\([^)]*\)\s*$/.test(name)) name = name.replace(/\s*\([^)]*\)\s*$/, '');
        name = name.trim();
        if (!name) return false; // (a line starting with a mark, ! . > # =, fails the word test below)
        const up = name.toUpperCase();
        if ((names || []).some((n) => String(n).toUpperCase() === up)) return true;
        if (name.length > 30 || SCENE_PREFIX_RE.test(name) || /[.!?,;:]$/.test(name)) return false;
        const words = name.split(/\s+/);
        return words.length <= 3 && words.every((w) => CUE_WORD.test(w));
    }

    function finishLine(text, info, mode, paragraphs) {
        const words = plain(info.lines[info.idx]);
        if (words === '') return null;                                // nothing typed yet: plain newline
        let line, sep;
        if (mode === 'character') {
            line = words.toUpperCase();
            sep = '\n';
        } else if (mode === 'scene') {
            line = info.lines[info.idx].trim().toUpperCase();
            if (!SCENE_PREFIX_RE.test(line)) line = FORCE.scene + words.toUpperCase();
            sep = '\n\n';
        } else { // transition
            line = words.toUpperCase();
            if (!isTransition(line)) line = FORCE.transition + line;
            sep = '\n\n';
        }
        if (!paragraphs) sep = '\n';
        return { from: info.start, to: info.end, insert: line + sep,
                 selStart: info.start + line.length + sep.length, selEnd: info.start + line.length + sep.length };
    }

    function isTransition(candidate) {
        return Fountain.classifyLines('a\n\n' + candidate + '\n')[2] === 'transition';
    }

    // ---------- Tab / element buttons ----------

    /** The elements Tab can walk through for the current line, and where in that list the line is now. */
    function cycleList(text, caret, mode) {
        const info = lineInfo(text, caret);
        const words = plain(info.lines[info.idx]);
        const blank = words === '';
        const kind = blank ? (mode || (inDialogueBlock(text, info.idx) ? 'dialogue' : 'action')) : kindAt(text, info.idx);
        const list = (kind === 'dialogue' || kind === 'parenthetical') ? BLOCK_CYCLE : CYCLE;
        const i = list.indexOf(kind);
        return { list: list, i: i === -1 ? 0 : i };
    }

    /** The element Tab (dir = 1) or Shift+Tab (dir = -1) should turn the current line into. */
    function cycleTarget(text, caret, dir, mode) {
        const c = cycleList(text, caret, mode);
        return c.list[(c.i + (dir < 0 ? -1 : 1) + c.list.length) % c.list.length];
    }

    /**
     * Tab / Shift+Tab: the next element that the current line can actually become. Some conversions are impossible
     * for particular text (a line ending in "TO:" cannot be a cue), and skipping them means the cycle never sticks.
     * Returns { target, edit, mode } or null when nothing applies.
     */
    function tab(text, caret, dir, mode) {
        const c = cycleList(text, caret, mode);
        const step = dir < 0 ? -1 : 1;
        for (let k = 1; k < c.list.length; k++) {
            const target = c.list[(c.i + step * k + c.list.length * k) % c.list.length];
            const r = setType(text, caret, target, mode);
            if (r) return { target: target, edit: r.edit, mode: r.mode };
        }
        return null;
    }

    /**
     * Turn the current line into `target`. Keeps the words, changes what marks them: uppercases cues, adds "INT. ",
     * wraps parentheses, adds a forced-element marker if the plain form would parse as something else, and adds the
     * blank line above that cues, scene headings and transitions need. Returns { edit, mode } where `edit` may be
     * null (a blank line has no text to change) and `mode` is what the page should remember for a line with no text
     * yet. Returns null if the conversion is not possible here (dialogue and parentheticals only exist inside a
     * character's block).
     */
    function setType(text, caret, target, mode) {
        const info = lineInfo(text, caret);
        const line = info.lines[info.idx];
        const words = plain(line);
        const blank = words === '';
        const prevBlank = info.idx === 0 || isBlank(info.lines[info.idx - 1]);

        if ((target === 'dialogue' || target === 'parenthetical') && !inDialogueBlock(text, info.idx)) {
            if (!(kindAt(text, info.idx) === 'dialogue' || kindAt(text, info.idx) === 'parenthetical')) return null;
        }

        const lead = (NEEDS_BLANK_BEFORE[target] && !prevBlank) ? '\n' : '';
        let candidate;
        let caretInside = false;
        switch (target) {
            case 'character': candidate = words.toUpperCase(); break;
            case 'scene': candidate = blank ? 'INT. ' : (SCENE_PREFIX_RE.test(line.trim()) ? line.trim() : 'INT. ' + words).toUpperCase(); break;
            case 'transition': candidate = words.toUpperCase(); break;
            case 'parenthetical': candidate = '(' + words + ')'; caretInside = blank; break;
            default: candidate = words; // 'action' and 'dialogue'
        }
        if (target === 'transition' && candidate && !isTransition(candidate)) candidate = FORCE.transition + candidate;

        // Does the parser agree it is now the requested element? If not, force it with the element's marker.
        // (Blank lines have no text to classify, so they are trusted; the page remembers `mode` for them.)
        if (candidate.trim() !== '' && candidate !== 'INT. ' && !caretInside) {
            const trial = function (c) {
                const t = text.slice(0, info.start) + lead + c + text.slice(info.end);
                return kindAt(t, info.idx + (lead ? 1 : 0));
            };
            if (trial(candidate) !== target && FORCE[target] && candidate.indexOf(FORCE[target]) !== 0) {
                const forced = FORCE[target] + candidate;
                if (trial(forced) === target) candidate = forced;
                else if (target !== 'dialogue' && target !== 'parenthetical') return null;
            }
        }

        const insert = lead + candidate;
        const newMode = (blank || candidate === 'INT. ') && MODES.indexOf(target) !== -1 ? target : null;
        if (insert === line && !lead) return { edit: null, mode: newMode };
        const pos = info.start + insert.length - (caretInside ? 1 : 0);
        return { edit: { from: info.start, to: info.end, insert: insert, selStart: pos, selEnd: pos }, mode: newMode };
    }

    // ---------- auto-uppercase ----------

    /**
     * Uppercase the current line as it is typed, when it is clearly a scene heading ("int. kitchen"), a transition
     * ("cut to:"), or the writer has said it is one (mode). Only at the end of a line, and never inside dialogue.
     * `options.guess === false` (the writer's setting, P2-15): only a chosen mode uppercases; nothing is guessed.
     */
    function autoCase(text, caret, mode, options) {
        const info = lineInfo(text, caret);
        if (caret !== info.end) return null;
        const line = info.lines[info.idx];
        const upper = line.toUpperCase();
        if (line === upper) return null;
        const prevBlank = info.idx === 0 || isBlank(info.lines[info.idx - 1]);

        const chosen = MODES.indexOf(mode) !== -1;
        const guess = !options || options.guess !== false;
        const obvious = guess && prevBlank && (AUTO_SCENE_RE.test(line) || AUTO_TRANSITION_RE.test(line));
        if (!chosen && !obvious) return null;
        return { from: info.start, to: info.end, insert: upper, selStart: caret, selEnd: caret };
    }

    // ---------- whole-text changes ----------

    /**
     * The smallest edit that turns oldText into newText, with the selection carried across it. Used to change a
     * script's title from outside the editor (the Library) while leaving the rest of the text, the writer's
     * position and the undo history alone. If the texts are equal the edit is empty (from === to, insert '').
     */
    function diffEdit(oldText, newText, selStart, selEnd) {
        const max = Math.min(oldText.length, newText.length);
        let a = 0;
        while (a < max && oldText[a] === newText[a]) a++;
        let b = 0;
        while (b < max - a && oldText[oldText.length - 1 - b] === newText[newText.length - 1 - b]) b++;
        const from = a;
        const to = oldText.length - b;
        const insert = newText.slice(a, newText.length - b);
        const delta = insert.length - (to - from);
        const carry = function (p) { return p <= from ? p : (p >= to ? p + delta : from + insert.length); };
        return { from: from, to: to, insert: insert, selStart: carry(selStart), selEnd: carry(selEnd) };
    }

    /**
     * The block the caret is in, for focus mode (P2-07): the run of non-blank lines around it, as character offsets
     * { start, end } (end is the end of its last line, before any newline). On a blank line, just that line.
     */
    function blockAt(text, caret) {
        const lines = String(text).split('\n');
        const starts = [];
        let at = 0;
        lines.forEach((l) => { starts.push(at); at += l.length + 1; });
        let i = 0;
        while (i < lines.length - 1 && starts[i + 1] <= caret) i++;
        const blank = (k) => !lines[k].trim();
        if (blank(i)) return { start: starts[i], end: starts[i] + lines[i].length };
        let first = i, last = i;
        while (first > 0 && !blank(first - 1)) first--;
        while (last < lines.length - 1 && !blank(last + 1)) last++;
        return { start: starts[first], end: starts[last] + lines[last].length };
    }

    return {
        kindAt: kindAt, enter: enter, looksLikeCue: looksLikeCue, cycleTarget: cycleTarget, tab: tab, setType: setType, autoCase: autoCase,
        diffEdit: diffEdit, lineInfo: lineInfo, inDialogueBlock: inDialogueBlock, blockAt: blockAt
    };
});
