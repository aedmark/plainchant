(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'));
    else root.Editing = factory(root.Fountain);
})(typeof self !== 'undefined' ? self : this, function (Fountain) {
    'use strict';

    const CYCLE = ['action', 'character', 'scene', 'transition'];
    const BLOCK_CYCLE = ['dialogue', 'parenthetical'];
    const MODES = ['character', 'scene', 'transition'];
    const STRONG = ['scene', 'transition', 'section', 'synopsis', 'centered', 'lyrics', 'page_break', 'title_page'];
    const NEEDS_BLANK_BEFORE = { character: true, scene: true, transition: true };
    const FORCE = { action: '!', character: '@', scene: '.', transition: '> ' };
    const SCENE_PREFIX_RE = /^(?:INT|EXT|EST|INT\.?\/EXT|EXT\.?\/INT|I\/E)(?:\.|\s)\s*/i;
    const AUTO_SCENE_RE = /^(?:(?:int|ext|est)\.|(?:int|ext)\.?\/(?:ext|int)\.|i\/e\.?)\s/i;
    const AUTO_TRANSITION_RE = /^[a-z][a-z' ]* to:$/i;
    const WINDOW = 80;

    function lineInfo(text, caret) {
        const before = text.slice(0, caret);
        const idx = before.split('\n').length - 1;
        const start = before.lastIndexOf('\n') + 1;
        let end = text.indexOf('\n', caret);
        if (end === -1) end = text.length;
        return { lines: text.split('\n'), idx: idx, start: start, end: end };
    }

    const isBlank = function (s) { return s === undefined || s.trim() === ''; };

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

    function kindAt(text, idx) {
        const lines = text.split('\n');
        const line = lines[idx];
        if (isBlank(line)) return 'blank';

        let s = Math.max(0, idx - WINDOW);
        if (s > 0) {
            while (s < idx && !isBlank(lines[s])) s++;
            if (isBlank(lines[s]) && s < idx) s++;
        }
        const upto = lines.slice(s, idx + 1).join('\n');
        const at = idx - s;
        const A = Fountain.classifyLines(upto + '\n')[at];
        const B = Fountain.classifyLines(upto + '\nx')[at];

        if (STRONG.indexOf(A) !== -1) return A;
        if (A === 'dialogue' || A === 'parenthetical') return A;
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

    function enter(text, start, end, mode, options) {
        const paragraphs = !options || options.paragraphs !== false;
        const cues = options && options.cues;
        if (start !== end) return null;
        const info = lineInfo(text, start);
        if (start !== info.end) return null;
        if (!isBlank(info.lines[info.idx + 1])) return null;
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

    const CUE_WORD = /^\p{Lu}[\p{L}'’.\-]*$/u;

    function looksLikeCue(line, names) {
        let name = String(line || '').trim();
        while (/\([^)]*\)\s*$/.test(name)) name = name.replace(/\s*\([^)]*\)\s*$/, '');
        name = name.trim();
        if (!name) return false;
        const up = name.toUpperCase();
        if ((names || []).some((n) => String(n).toUpperCase() === up)) return true;
        if (name.length > 30 || SCENE_PREFIX_RE.test(name) || /[.!?,;:]$/.test(name)) return false;
        const words = name.split(/\s+/);
        return words.length <= 3 && words.every((w) => CUE_WORD.test(w));
    }

    function finishLine(text, info, mode, paragraphs) {
        const words = plain(info.lines[info.idx]);
        if (words === '') return null;
        let line, sep;
        if (mode === 'character') {
            line = words.toUpperCase();
            sep = '\n';
        } else if (mode === 'scene') {
            line = info.lines[info.idx].trim().toUpperCase();
            if (!SCENE_PREFIX_RE.test(line)) line = FORCE.scene + words.toUpperCase();
            sep = '\n\n';
        } else {
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

    function cycleList(text, caret, mode) {
        const info = lineInfo(text, caret);
        const words = plain(info.lines[info.idx]);
        const blank = words === '';
        const kind = blank ? (mode || (inDialogueBlock(text, info.idx) ? 'dialogue' : 'action')) : kindAt(text, info.idx);
        const list = (kind === 'dialogue' || kind === 'parenthetical') ? BLOCK_CYCLE : CYCLE;
        const i = list.indexOf(kind);
        return { list: list, i: i === -1 ? 0 : i };
    }

    function cycleTarget(text, caret, dir, mode) {
        const c = cycleList(text, caret, mode);
        return c.list[(c.i + (dir < 0 ? -1 : 1) + c.list.length) % c.list.length];
    }

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
            default: candidate = words;
        }
        if (target === 'transition' && candidate && !isTransition(candidate)) candidate = FORCE.transition + candidate;

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

    function paragraphAt(text, line) {
        const s = String(text);
        const lines = s.split('\n');
        const n = Math.max(0, Math.min(Math.floor(line) || 0, lines.length - 1));
        let at = 0;
        for (let i = 0; i < n; i++) at += lines[i].length + 1;
        const b = blockAt(s, at);
        const first = s.slice(0, b.start).split('\n').length - 1;
        return { start: b.start, end: b.end, first: first, last: first + s.slice(b.start, b.end).split('\n').length - 1 };
    }

    return {
        kindAt: kindAt, enter: enter, looksLikeCue: looksLikeCue, cycleTarget: cycleTarget, tab: tab, setType: setType, autoCase: autoCase,
        diffEdit: diffEdit, lineInfo: lineInfo, inDialogueBlock: inDialogueBlock, blockAt: blockAt, paragraphAt: paragraphAt
    };
});
