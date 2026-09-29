(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./fountain.js'));
    else root.Fdx = factory(root.Fountain);
})(typeof self !== 'undefined' ? self : this, function (Fountain) {
    'use strict';

    const xml = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    function styleOf(run, italic) {
        const s = [];
        if (run.bold) s.push('Bold');
        if (run.italic || italic) s.push('Italic');
        if (run.underline) s.push('Underline');
        return s.join('+');
    }

    function texts(text, italic) {
        const runs = Fountain.runs(String(text || '')).filter((r) => r.text);
        if (runs.length) {
            runs[0] = Object.assign({}, runs[0], { text: runs[0].text.replace(/^[ \t]+/, '') });
            const last = runs.length - 1;
            runs[last] = Object.assign({}, runs[last], { text: runs[last].text.replace(/[ \t]+$/, '') });
        }
        return runs.filter((r) => r.text).map((r) => {
            const style = styleOf(r, italic);
            return '<Text' + (style ? ' Style="' + style + '"' : '') + '>' + xml(r.text) + '</Text>';
        }).join('');
    }

    function paragraph(type, text, extra) {
        const x = extra || {};
        const inner = texts(text, x.italic);
        if (!inner) return '';
        let attrs = type ? ' Type="' + type + '"' : '';
        if (x.number) attrs += ' Number="' + xml(x.number) + '"';
        if (x.center) attrs += ' Alignment="Center"';
        if (x.newPage) attrs += ' StartsNewPage="Yes"';
        return '    <Paragraph' + attrs + '>' + inner + '</Paragraph>\n';
    }

    const lyric = (text) => /^~/.test(text);

    function speech(t, first) {
        let out = paragraph('Character', t.character, first);
        t.lines.forEach((l) => {
            if (l.type === 'parenthetical') out += paragraph('Parenthetical', l.text);
            else out += paragraph('Dialogue', lyric(l.text) ? l.text.replace(/^~\s*/, '') : l.text, { italic: lyric(l.text) });
        });
        return out;
    }

    function titlePage(fields) {
        const get = (k) => { const f = fields.find((x) => x.key.toLowerCase() === k); return f ? f.value : ''; };
        const blank = '      <Paragraph Alignment="Center"><Text></Text></Paragraph>\n';
        const line = (value, align) => String(value).split('\n').map((v) =>
            '      <Paragraph Alignment="' + align + '">' + (texts(v) || '<Text></Text>') + '</Paragraph>\n').join('');
        let out = '  <TitlePage>\n    <Content>\n' + blank.repeat(16);
        out += line(get('title') || 'Untitled', 'Center');
        ['credit', 'author', 'authors', 'source'].forEach((k) => { if (get(k)) out += blank + line(get(k), 'Center'); });
        const foot = ['draft date', 'date', 'contact', 'copyright'].filter((k) => get(k));
        if (foot.length) out += blank.repeat(12) + foot.map((k) => line(get(k), 'Left')).join(blank);
        return out + '    </Content>\n  </TitlePage>\n';
    }

    function of(text) {
        const tokens = Fountain.parse(String(text || ''));
        let body = '';
        let title = '';
        let newPage = false;
        const take = () => { const n = newPage; newPage = false; return n; };
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            switch (t.type) {
                case 'title_page': title = titlePage(t.fields); break;
                case 'page_break': newPage = true; break;
                case 'scene': body += paragraph('Scene Heading', t.text, { number: t.number, newPage: take() }); break;
                case 'action': body += paragraph('Action', t.text, { newPage: take() }); break;
                case 'centered': body += paragraph('Action', t.text, { center: true, newPage: take() }); break;
                case 'lyrics': body += paragraph('Action', t.text, { italic: true, newPage: take() }); break;
                case 'transition': body += paragraph('Transition', t.text, { newPage: take() }); break;
                case 'dialogue': {
                    const next = tokens[i + 1];
                    if (t.dual === 'left' && next && next.dual === 'right') {
                        const n = take();
                        body += '    <Paragraph' + (n ? ' StartsNewPage="Yes"' : '') + '>\n    <DualDialogue>\n' +
                            speech(t) + speech(next) + '    </DualDialogue>\n    </Paragraph>\n';
                        i++;
                    } else {
                        body += speech(t, { newPage: take() });
                    }
                    break;
                }
                default: break;
            }
        }
        return '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n' +
            '<FinalDraft DocumentType="Script" Template="No" Version="5">\n' +
            '  <Content>\n' + body + '  </Content>\n' + title + '</FinalDraft>\n';
    }

    return { of: of };
});
