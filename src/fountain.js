(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Fountain = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const TITLE_KEYS = ['title', 'credit', 'author', 'authors', 'source', 'notes', 'draft date', 'date', 'contact',
        'copyright', 'revision', 'watermark', 'font', 'tl', 'tc', 'tr', 'bl', 'bc', 'br'];

    const SCENE_RE = /^(?:INT|EXT|EST|INT\.?\/EXT|EXT\.?\/INT|I\/E)(?:\.|\s)/i;
    const SCENE_NUMBER_RE = /\s#([\w.\-]+)#\s*$/;
    const KNOWN_TRANSITION_RE = /^(?:FADE OUT|FADE TO BLACK|CUT TO BLACK|SMASH CUT|MATCH CUT|FADE TO WHITE)[.:]?$/;

    function escapeHTML(str) {
        return String(str).replace(/[&<>'"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c];
        });
    }

    function isBlank(line) {
        return line === undefined || line.trim() === '';
    }

    function isUpper(s) {
        return /\p{L}/u.test(s) && s === s.toUpperCase();
    }

    function stripBoneyard(text) {
        return text.replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ''); });
    }

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
                const f = fields[fields.length - 1];
                f.value = f.value ? f.value + '\n' + lines[i].trim() : lines[i].trim();
            }
        }
        return { token: { type: 'title_page', fields: fields, line: 0 }, next: i };
    }

    function parse(text) {
        const lines = stripBoneyard(String(text || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ')).split('\n');
        const tokens = [];
        let action = null;
        let dialogue = null;

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

            if (dialogue) {
                if (isBlank(raw)) {
                    if (/^ {2,}$/.test(raw)) continue;
                    flushDialogue();
                    continue;
                }
                dialogue.lines.push({ type: /^\(.*\)$/.test(line) ? 'parenthetical' : 'dialogue', text: line, line: i });
                continue;
            }

            if (isBlank(raw)) { flushAction(); continue; }

            if (/^={3,}$/.test(line)) { push({ type: 'page_break', line: i }); continue; }

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

            const section = line.match(/^(#+)\s*(.*)$/);
            if (section) { push({ type: 'section', text: section[2], depth: section[1].length, line: i }); continue; }
            if (line[0] === '=') { push({ type: 'synopsis', text: line.replace(/^=\s*/, ''), line: i }); continue; }

            if (prevBlank) {
                if (SCENE_RE.test(line)) { push(sceneToken(line, i)); continue; }

                if (isUpper(line) && nextBlank && (/TO:$/.test(line) || KNOWN_TRANSITION_RE.test(line))) {
                    push({ type: 'transition', text: line, line: i }); continue;
                }

                if (!nextBlank && isCharacterCue(line)) { startDialogue(line, i); continue; }
            }

            startAction(raw, i);
        }
        flushAction();
        flushDialogue();

        pairDualDialogue(tokens);
        return tokens;

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

    function isCharacterCue(line) {
        const cue = line.replace(/\s*\^\s*$/, '');
        if (cue[0] === '(') return false;
        const name = cue.replace(/\s*\([^)]*\)\s*$/, '');
        return name.length > 0 && isUpper(name) && !/TO:$/.test(name);
    }

    function pairDualDialogue(tokens) {
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].type === 'dialogue' && tokens[i].dual === 'right') {
                const prev = tokens[i - 1];
                if (prev && prev.type === 'dialogue' && !prev.dual) prev.dual = 'left';
                else tokens[i].dual = false;
            }
        }
    }

    function inline(text) {
        let s = escapeHTML(text);

        const literals = { '*': '', '_': '', '\\': '' };
        s = s.replace(/\\([*_\\])/g, function (_, c) { return literals[c]; });

        s = s.replace(/\[\[([\s\S]*?)\]\]/g, '<span class="script-note">[[$1]]</span>');
        s = s.replace(/\*\*\*([^\s*](?:[^*]*?[^\s*])?)\*\*\*/g, '<strong><em>$1</em></strong>');
        s = s.replace(/\*\*([^\s*](?:[^*]*?[^\s*])?)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/\*([^\s*](?:[^*]*?[^\s*])?)\*/g, '<em>$1</em>');
        s = s.replace(/(^|\W)_([^\s_](?:[^_]*?[^\s_])?)_(?!\w)/g, '$1<u>$2</u>');

        return s.replace(//g, '*').replace(//g, '_').replace(//g, '\\');
    }

    function runs(text) {
        const LIT = { '*': '\u0011', '_': '\u0012', '\\': '\u0013' };
        const MARK = { b: '\u0001', B: '\u0002', i: '\u0003', I: '\u0004', u: '\u0005', U: '\u0006' };
        let s = String(text || '').replace(/\\([*_\\])/g, function (_, c) { return LIT[c]; });
        s = s.replace(/\[\[[\s\S]*?\]\]/g, '');
        s = s.replace(/\*\*\*([^\s*](?:[^*]*?[^\s*])?)\*\*\*/g, MARK.b + MARK.i + '$1' + MARK.I + MARK.B);
        s = s.replace(/\*\*([^\s*](?:[^*]*?[^\s*])?)\*\*/g, MARK.b + '$1' + MARK.B);
        s = s.replace(/\*([^\s*](?:[^*]*?[^\s*])?)\*/g, MARK.i + '$1' + MARK.I);
        s = s.replace(/(^|\W)_([^\s_](?:[^_]*?[^\s_])?)_(?!\w)/g, '$1' + MARK.u + '$2' + MARK.U);

        const out = [];
        const style = { bold: 0, italic: 0, underline: 0 };
        let buf = '';
        const flush = function () {
            if (!buf) return;
            const run = { text: buf.replace(/\u0011/g, '*').replace(/\u0012/g, '_').replace(/\u0013/g, '\\'),
                bold: style.bold > 0, italic: style.italic > 0, underline: style.underline > 0 };
            const last = out[out.length - 1];
            if (last && last.bold === run.bold && last.italic === run.italic && last.underline === run.underline) last.text += run.text;
            else out.push(run);
            buf = '';
        };
        for (const ch of s) {
            const code = ch.charCodeAt(0);
            if (code >= 1 && code <= 6) {
                flush();
                const key = code <= 2 ? 'bold' : code <= 4 ? 'italic' : 'underline';
                style[key] += code % 2 ? 1 : -1;
            } else buf += ch;
        }
        flush();
        return out;
    }

    function attrs(token, cls) {
        return 'class="' + cls + '" data-line="' + token.line + '"';
    }

    function renderDialogue(t) {
        let html = '<div ' + attrs(t, 'script-dialogue-block' + (t.dual ? ' dual-' + t.dual : '')) + '>' +
            '<div class="script-character" data-line="' + t.line + '">' + inline(t.character) + '</div>';
        t.lines.forEach(function (l) {
            html += '<div class="script-' + l.type + '" data-line="' + l.line + '">' + inline(l.text) + '</div>';
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

    function blocks(tokens) {
        const out = [];
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            let html = '';
            switch (t.type) {
                case 'title_page': html = renderTitlePage(t); break;
                case 'scene':
                    html = '<div ' + attrs(t, 'script-scene-heading') + '>' + inline(t.text) +
                        (t.number ? '<span class="script-scene-num">' + escapeHTML(t.number) + '</span>' : '') + '</div>';
                    break;
                case 'action': html = '<div ' + attrs(t, 'script-action') + '>' + inline(t.text) + '</div>'; break;
                case 'dialogue':
                    if (t.dual === 'left' && tokens[i + 1] && tokens[i + 1].dual === 'right') {
                        html = '<div class="script-dual">' + renderDialogue(t) + renderDialogue(tokens[i + 1]) + '</div>';
                        i++;
                    } else {
                        html = renderDialogue(t);
                    }
                    break;
                case 'transition': html = '<div ' + attrs(t, 'script-transition') + '>' + inline(t.text) + '</div>'; break;
                case 'centered': html = '<div ' + attrs(t, 'script-centered') + '>' + inline(t.text) + '</div>'; break;
                case 'lyrics': html = '<div ' + attrs(t, 'script-lyrics') + '>' + inline(t.text) + '</div>'; break;
                case 'section':
                    html = '<div ' + attrs(t, 'script-section depth-' + Math.min(t.depth, 6)) + '>' + inline(t.text) + '</div>';
                    break;
                case 'synopsis': html = '<div ' + attrs(t, 'script-synopsis') + '>' + inline(t.text) + '</div>'; break;
                case 'page_break': html = '<hr ' + attrs(t, 'script-page-break') + '>'; break;
            }
            if (html) out.push({ html: html, line: t.line });
        }
        return out;
    }

    function toHTML(tokens) {
        return blocks(tokens).map(function (b) { return b.html; }).join('');
    }

    function classifyLines(text, tokens) {
        const count = String(text || '').replace(/\r\n?/g, '\n').split('\n').length;
        const kinds = new Array(count).fill('blank');
        (tokens || parse(text)).forEach(function (t) {
            if (t.type === 'action') {
                const span = t.text.split('\n').length;
                for (let k = 0; k < span; k++) kinds[t.line + k] = 'action';
            } else if (t.type === 'dialogue') {
                kinds[t.line] = 'character';
                t.lines.forEach(function (l) { kinds[l.line] = l.type; });
            } else if (t.type === 'title_page') {
                const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
                for (let k = 0; k < lines.length && lines[k].trim() !== ''; k++) kinds[k] = 'title_page';
            } else {
                kinds[t.line] = t.type;
            }
        });
        return kinds;
    }

    function shade(text, tokens) {
        const src = String(text || '').replace(/\r\n?/g, '\n');
        const kinds = classifyLines(src, tokens);
        const bone = [];
        src.replace(/\/\*[\s\S]*?\*\//g, function (m, at) { bone.push([at, at + m.length]); return m; });
        let pos = 0, b = 0;
        return src.split('\n').map(function (line, i) {
            const start = pos, end = pos + line.length;
            pos = end + 1;
            while (b < bone.length && bone[b][1] <= start) b++;
            const inBone = b < bone.length && bone[b][0] < end;
            if (!inBone && line.indexOf('[[') === -1) return { kind: kinds[i], runs: [{ text: line, mark: null }] };
            const marks = new Array(line.length).fill(null);
            line.replace(/\[\[.*?\]\]/g, function (m, at) { marks.fill('note', at, at + m.length); return m; });
            for (let k = b; k < bone.length && bone[k][0] < end; k++) {
                marks.fill('boneyard', Math.max(bone[k][0], start) - start, Math.min(bone[k][1], end) - start);
            }
            const runs = [];
            for (let c = 0; c < line.length; c++) {
                const last = runs[runs.length - 1];
                if (last && last.mark === marks[c]) last.text += line[c];
                else runs.push({ text: line[c], mark: marks[c] });
            }
            return { kind: kinds[i], runs: runs.length ? runs : [{ text: '', mark: null }] };
        });
    }

    function fullTitle(text) {
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
        return title.replace(/[*_]/g, '').trim();
    }

    function extractTitle(text) {
        const title = fullTitle(text);
        return title ? title.substring(0, 40) : 'Untitled Script';
    }

    function setTitle(text, title) {
        const value = String(title == null ? '' : title).replace(/\s*\n\s*/g, ' ').trim();
        const line = 'Title: ' + value;
        const src = String(text || '').replace(/\r\n?/g, '\n');
        const lines = src.split('\n');
        const page = parseTitlePage(lines);

        if (!page) return line + '\n\n' + src.replace(/^\n+/, '');

        const end = page.next;
        const isKeyLine = function (l) { return /^\S/.test(l) && /^([A-Za-z][A-Za-z ]*?):/.test(l); };
        let at = -1;
        for (let i = 0; i < end; i++) {
            if (isKeyLine(lines[i]) && /^title\s*:/i.test(lines[i])) { at = i; break; }
        }
        if (at === -1) { lines.unshift(line); return lines.join('\n'); }

        let stop = at + 1;
        while (stop < end && !isKeyLine(lines[stop])) stop++;
        lines.splice(at, stop - at, line);
        return lines.join('\n');
    }

    function fileName(text, ext) {
        const extension = String(ext || 'fountain').replace(/^\./, '');
        let slug = fullTitle(text).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase();
        if (slug.length > 60) {
            let cut = slug.slice(0, 60);
            if (slug[60] !== '-' && cut.indexOf('-') !== -1) cut = cut.replace(/-[^-]*$/, '');
            slug = cut.replace(/-+$/, '');
        }
        if (!slug) slug = 'untitled';
        if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(slug)) slug = 'script-' + slug;
        return slug + '.' + extension;
    }

    return {
        parse: parse, toHTML: toHTML, blocks: blocks, extractTitle: extractTitle, fullTitle: fullTitle, setTitle: setTitle,
        fileName: fileName, classifyLines: classifyLines, shade: shade, escapeHTML: escapeHTML, inline: inline, runs: runs
    };
});
