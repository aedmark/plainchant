/*
 * Fountain parser and HTML renderer (D-003).
 *
 * Pure: no DOM, no window, no Node-only APIs. Loads as window.Fountain in the browser and via require() in Node.
 *
 *   Fountain.parse(text)      -> tokens
 *   Fountain.toHTML(tokens)   -> HTML string (all user text escaped)
 *   Fountain.extractTitle(t)  -> best-effort script title
 *
 * Follows Fountain 1.1 (https://fountain.io/syntax). Deliberately strict about case: lowercase cues are action (D-004).
 * Known limitation: multi-line [[notes]] are not recognised.
 *
 * Tokens (every token has `line`, the 0-based source line where it starts):
 *   { type: 'title_page',   fields: [{ key, value }] }
 *   { type: 'scene',        text, number }
 *   { type: 'action',       text }                       text may contain '\n'; leading spaces preserved
 *   { type: 'dialogue',     character, lines: [{ type: 'parenthetical' | 'dialogue', text }], dual }
 *                           dual is false | 'left' | 'right'
 *   { type: 'transition',   text }
 *   { type: 'centered',     text }
 *   { type: 'lyrics',       text }
 *   { type: 'section',      text, depth }
 *   { type: 'synopsis',     text }
 *   { type: 'page_break' }
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Fountain = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const TITLE_KEYS = ['title', 'credit', 'author', 'authors', 'source', 'notes', 'draft date', 'date', 'contact',
        'copyright', 'revision', 'watermark', 'font', 'tl', 'tc', 'tr', 'bl', 'bc', 'br'];

    const SCENE_RE = /^(?:INT|EXT|EST|INT\.?\/EXT|EXT\.?\/INT|I\/E)(?:\.|\s)/i;
    const SCENE_NUMBER_RE = /\s#([\w.\-]+)#\s*$/;
    // Common transitions writers expect to work without a `>` prefix, on top of the spec's "ends in TO:" rule.
    const KNOWN_TRANSITION_RE = /^(?:FADE OUT|FADE TO BLACK|CUT TO BLACK|SMASH CUT|MATCH CUT|FADE TO WHITE)[.:]?$/;

    // ---------- helpers ----------

    function escapeHTML(str) {
        return String(str).replace(/[&<>'"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c];
        });
    }

    function isBlank(line) {
        return line === undefined || line.trim() === '';
    }

    /** True if the string has at least one letter and no lowercase letters. */
    function isUpper(s) {
        return /\p{L}/u.test(s) && s === s.toUpperCase();
    }

    /** Removes closed boneyard comments but keeps their newlines so source line numbers stay valid. */
    function stripBoneyard(text) {
        return text.replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ''); });
    }

    // ---------- parser ----------

    function parseTitlePage(lines) {
        if (!lines.length) return null;
        const first = lines[0].match(/^([A-Za-z][A-Za-z ]*?):/);
        if (!first || TITLE_KEYS.indexOf(first[1].toLowerCase()) === -1) return null;

        const fields = [];
        let i = 0;
        for (; i < lines.length && !isBlank(lines[i]); i++) {
            const kv = lines[i].match(/^([A-Za-z][A-Za-z ]*?):\s*(.*)$/);
            if (kv && /^\S/.test(lines[i])) {
                fields.push({ key: kv[1], value: kv[2] });
            } else if (fields.length) {
                // Indented continuation of a multi-line value
                const f = fields[fields.length - 1];
                f.value = f.value ? f.value + '\n' + lines[i].trim() : lines[i].trim();
            }
        }
        return { token: { type: 'title_page', fields: fields, line: 0 }, next: i };
    }

    function parse(text) {
        const lines = stripBoneyard(String(text || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ')).split('\n');
        const tokens = [];
        let action = null;      // open action paragraph
        let dialogue = null;    // open dialogue block

        function flushAction() {
            if (action) { tokens.push(action); action = null; }
        }
        function flushDialogue() {
            if (dialogue) { tokens.push(dialogue); dialogue = null; }
        }
        function push(token) {
            flushAction();
            tokens.push(token);
        }

        let i = 0;
        const title = parseTitlePage(lines);
        if (title) { tokens.push(title.token); i = title.next; }

        for (; i < lines.length; i++) {
            const raw = lines[i];
            const line = raw.trim();
            const prevBlank = i === 0 || isBlank(lines[i - 1]);
            const nextBlank = i + 1 >= lines.length || isBlank(lines[i + 1]);

            // --- inside a dialogue block: everything up to the next blank line belongs to it ---
            if (dialogue) {
                if (isBlank(raw)) {
                    // Two or more spaces on an otherwise empty line keep the block open (Fountain 1.1)
                    if (/^ {2,}$/.test(raw)) continue;
                    flushDialogue();
                    continue;
                }
                dialogue.lines.push({ type: /^\(.*\)$/.test(line) ? 'parenthetical' : 'dialogue', text: line });
                continue;
            }

            // --- blank line ends the current action paragraph ---
            if (isBlank(raw)) { flushAction(); continue; }

            // --- page break ---
            if (/^={3,}$/.test(line)) { push({ type: 'page_break', line: i }); continue; }

            // --- forced elements ---
            if (line[0] === '!') { startAction(raw.replace(/^(\s*)!/, '$1'), i); continue; }
            if (line[0] === '.' && line[1] !== '.' && line.length > 1) { push(sceneToken(line.slice(1).trim(), i)); continue; }
            if (line[0] === '~') { push({ type: 'lyrics', text: line.replace(/^~\s*/, ''), line: i }); continue; }
            if (line[0] === '>') {
                if (/<\s*$/.test(line)) {
                    push({ type: 'centered', text: line.replace(/^>\s*/, '').replace(/\s*<$/, ''), line: i });
                } else {
                    push({ type: 'transition', text: line.slice(1).trim(), line: i });
                }
                continue;
            }
            if (line[0] === '@' && line.length > 1 && prevBlank && !nextBlank) {
                startDialogue(line.slice(1).trim(), i); continue;
            }

            // --- sections and synopses ---
            const section = line.match(/^(#+)\s*(.*)$/);
            if (section) { push({ type: 'section', text: section[2], depth: section[1].length, line: i }); continue; }
            if (line[0] === '=') { push({ type: 'synopsis', text: line.replace(/^=\s*/, ''), line: i }); continue; }

            // --- elements that must follow a blank line (or the start of the script) ---
            if (prevBlank) {
                if (SCENE_RE.test(line)) { push(sceneToken(line, i)); continue; }

                if (isUpper(line) && nextBlank && (/TO:$/.test(line) || KNOWN_TRANSITION_RE.test(line))) {
                    push({ type: 'transition', text: line, line: i }); continue;
                }

                if (!nextBlank && isCharacterCue(line)) { startDialogue(line, i); continue; }
            }

            // --- everything else is action ---
            startAction(raw, i);
        }
        flushAction();
        flushDialogue();

        pairDualDialogue(tokens);
        return tokens;

        // ----- local builders (closures over the flush helpers above) -----

        function startAction(rawLine, at) {
            const text = rawLine.replace(/\s+$/, '');
            if (action) action.text += '\n' + text;
            else action = { type: 'action', text: text, line: at };
        }

        function sceneToken(text, at) {
            let number = null;
            const m = text.match(SCENE_NUMBER_RE);
            if (m) { number = m[1]; text = text.slice(0, m.index); }
            return { type: 'scene', text: text, number: number, line: at };
        }

        function startDialogue(cue, at) {
            flushAction();
            let dual = false;
            if (/\^\s*$/.test(cue)) { dual = true; cue = cue.replace(/\s*\^\s*$/, ''); }
            dialogue = { type: 'dialogue', character: cue, lines: [], dual: dual ? 'right' : false, line: at };
        }
    }

    /** A character cue is upper case, ignoring any trailing (extension) such as (V.O.) or (cont'd). */
    function isCharacterCue(line) {
        const cue = line.replace(/\s*\^\s*$/, '');
        if (cue[0] === '(') return false;
        const name = cue.replace(/\s*\([^)]*\)\s*$/, '');
        // "CUT TO:" typed without the required blank line after it is a botched transition, not a speaker
        return name.length > 0 && isUpper(name) && !/TO:$/.test(name);
    }

    /** A `^` cue makes its block the right half, and the dialogue block just before it the left half. */
    function pairDualDialogue(tokens) {
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].type === 'dialogue' && tokens[i].dual === 'right') {
                const prev = tokens[i - 1];
                if (prev && prev.type === 'dialogue' && !prev.dual) prev.dual = 'left';
                else tokens[i].dual = false; // nothing to pair with: render as a normal block
            }
        }
    }

    // ---------- inline formatting ----------

    /** Escapes text, then applies notes, escapes and *bold* / *italic* / _underline_ emphasis. */
    function inline(text) {
        let s = escapeHTML(text);

        // Backslash-escaped emphasis characters become placeholders so they survive the passes below
        const literals = { '*': '', '_': '', '\\': '' };
        s = s.replace(/\\([*_\\])/g, function (_, c) { return literals[c]; });

        s = s.replace(/\[\[([\s\S]*?)\]\]/g, '<span class="script-note">[[$1]]</span>');
        s = s.replace(/\*\*\*([^\s*](?:[^*]*?[^\s*])?)\*\*\*/g, '<strong><em>$1</em></strong>');
        s = s.replace(/\*\*([^\s*](?:[^*]*?[^\s*])?)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/\*([^\s*](?:[^*]*?[^\s*])?)\*/g, '<em>$1</em>');
        // Underline must sit on word boundaries so snake_case_names are left alone
        s = s.replace(/(^|\W)_([^\s_](?:[^_]*?[^\s_])?)_(?!\w)/g, '$1<u>$2</u>');

        return s.replace(//g, '*').replace(//g, '_').replace(//g, '\\');
    }

    // ---------- renderer ----------

    function attrs(token, cls) {
        return 'class="' + cls + '" data-line="' + token.line + '"';
    }

    function renderDialogue(t) {
        let html = '<div ' + attrs(t, 'script-dialogue-block' + (t.dual ? ' dual-' + t.dual : '')) + '>' +
            '<div class="script-character">' + inline(t.character) + '</div>';
        t.lines.forEach(function (l) {
            html += '<div class="script-' + l.type + '">' + inline(l.text) + '</div>';
        });
        return html + '</div>';
    }

    function renderTitlePage(t) {
        const get = function (k) {
            const f = t.fields.find(function (x) { return x.key.toLowerCase() === k; });
            return f ? f.value : '';
        };
        let html = '<div ' + attrs(t, 'script-title-page') + '>';
        html += '<div class="tp-title">' + inline(get('title').replace(/\n/g, ' ') || 'Untitled') + '</div>';
        const credit = get('credit'), author = get('author') || get('authors');
        if (credit) html += '<div class="tp-credit">' + inline(credit) + '</div>';
        if (author) html += '<div class="tp-author">' + inline(author) + '</div>';
        ['source', 'draft date', 'date', 'contact', 'copyright'].forEach(function (k) {
            const v = get(k);
            if (v) html += '<div class="tp-meta">' + inline(v).replace(/\n/g, '<br>') + '</div>';
        });
        return html + '</div>';
    }

    function toHTML(tokens) {
        let html = '';
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            switch (t.type) {
                case 'title_page': html += renderTitlePage(t); break;
                case 'scene':
                    html += '<div ' + attrs(t, 'script-scene-heading') + '>' + inline(t.text) +
                        (t.number ? '<span class="script-scene-num">' + escapeHTML(t.number) + '</span>' : '') + '</div>';
                    break;
                case 'action': html += '<div ' + attrs(t, 'script-action') + '>' + inline(t.text) + '</div>'; break;
                case 'dialogue':
                    if (t.dual === 'left' && tokens[i + 1] && tokens[i + 1].dual === 'right') {
                        html += '<div class="script-dual">' + renderDialogue(t) + renderDialogue(tokens[i + 1]) + '</div>';
                        i++;
                    } else {
                        html += renderDialogue(t);
                    }
                    break;
                case 'transition': html += '<div ' + attrs(t, 'script-transition') + '>' + inline(t.text) + '</div>'; break;
                case 'centered': html += '<div ' + attrs(t, 'script-centered') + '>' + inline(t.text) + '</div>'; break;
                case 'lyrics': html += '<div ' + attrs(t, 'script-lyrics') + '>' + inline(t.text) + '</div>'; break;
                case 'section':
                    html += '<div ' + attrs(t, 'script-section depth-' + Math.min(t.depth, 6)) + '>' + inline(t.text) + '</div>';
                    break;
                case 'synopsis': html += '<div ' + attrs(t, 'script-synopsis') + '>' + inline(t.text) + '</div>'; break;
                case 'page_break': html += '<hr ' + attrs(t, 'script-page-break') + '>'; break;
            }
        }
        return html;
    }

    /** Title-page Title if present, otherwise the first scene heading or non-empty line, capped at 40 chars. */
    function extractTitle(text) {
        const tokens = parse(text);
        const tp = tokens.find(function (t) { return t.type === 'title_page'; });
        let title = '';
        if (tp) {
            const f = tp.fields.find(function (x) { return x.key.toLowerCase() === 'title'; });
            if (f) title = f.value.replace(/\n/g, ' ');
        }
        if (!title) {
            const first = String(text || '').split('\n').map(function (l) { return l.trim(); })
                .find(function (l) { return l.length > 0; });
            title = first || '';
        }
        title = title.replace(/[*_]/g, '').trim();
        return title ? title.substring(0, 40) : 'Untitled Script';
    }

    return { parse: parse, toHTML: toHTML, extractTitle: extractTitle, escapeHTML: escapeHTML, inline: inline };
});
