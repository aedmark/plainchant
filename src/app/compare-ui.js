const COMPARE_MAX_LINES = 300;
const COMPARE_CONTEXT = 2;
let comparing = null;

const COMPARE_SAYS = {
    changed: 'Changed since the version',
    removed: 'In the version, not in the text now',
    added: 'New since the version'
};

function compareLines(x) {
    const lines = x.status === 'changed' ? Compare.around(x.lines, COMPARE_CONTEXT)
        : (x.status === 'removed' ? x.was : x.now).text.replace(/\s+$/, '').split('\n')
            .map((t) => ({ op: x.status === 'removed' ? '-' : '+', text: t }));
    const box = h('div', { class: 'compare-lines' });
    lines.slice(0, COMPARE_MAX_LINES).forEach((l) => {
        if (l.op === '…') { box.appendChild(h('span', { class: 'compare-line compare-fold', text: '… ' + l.count + (l.count === 1 ? ' line' : ' lines') + ' the same' })); return; }
        const el = h(l.op === '-' ? 'del' : l.op === '+' ? 'ins' : 'span', { class: 'compare-line' });
        el.appendChild(h('span', { class: 'compare-sign', 'aria-hidden': 'true', text: l.op === '-' ? '−' : l.op === '+' ? '+' : ' ' }));
        el.appendChild(document.createTextNode(l.text || ' '));
        box.appendChild(el);
    });
    if (lines.length > COMPARE_MAX_LINES) {
        box.appendChild(h('p', { class: 'compare-more', text: (lines.length - COMPARE_MAX_LINES).toLocaleString() + ' more lines' }));
    }
    return box;
}

function compareCount(n, what) {
    return n + ' ' + (n === 1 ? 'scene' : 'scenes') + ' ' + what;
}

function drawCompare() {
    const { v, items } = comparing;
    const when = versionWhen(v.updatedAt, Date.now());
    const count = (s) => items.filter((x) => x.status === s && x.heading).length;
    const differ = items.map((x, i) => [x, i]).filter(([x]) => x.status !== 'same');
    const summary = !differ.length ? 'The version of ' + when + ' is the same as the text now.'
        : 'Since the version of ' + when + ': ' + [compareCount(count('changed'), 'changed'), compareCount(count('removed'), 'removed'),
            compareCount(count('added'), 'added')].filter((t) => !/^0 /.test(t)).concat(
            items[0].status === 'changed' ? ['the title page or opening changed'] : []).join(', ') +
            '.' + (count('same') ? ' ' + compareCount(count('same'), 'the same') + '.' : '');
    versionsList.textContent = '';
    versionsList.appendChild(h('div', { class: 'compare-head' }, [
        h('button', { type: 'button', class: 'mini', 'data-action': 'compare-back', text: 'All versions' }),
        h('p', { class: 'compare-summary', id: 'compareSummary', text: summary })
    ]));
    differ.forEach(([x, i]) => {
        const kids = [
            h('h3', { class: 'compare-heading', text: x.heading || 'Title page and opening' }),
            h('p', { class: 'compare-status compare-' + x.status, text: COMPARE_SAYS[x.status] }),
            compareLines(x)
        ];
        const label = x.status === 'changed' ? 'Use the version’s' : x.status === 'removed' ? 'Put back' : null;
        if (label) {
            const what = x.heading ? '“' + x.heading + '”' : 'the title page and opening';
            kids.push(h('div', { class: 'script-actions' }, [h('button', { type: 'button', class: 'mini', 'data-action': 'take-scene',
                'data-index': i, 'aria-label': label + ' ' + what, text: label + (x.heading ? ' scene' : ' opening') })]));
        }
        versionsList.appendChild(h('section', { class: 'compare-item', 'aria-label': x.heading || 'Title page and opening' }, kids));
    });
}

async function openCompare(v) {
    if (v.scriptId === currentScriptId) flushSave();
    await whenSaved();
    const script = getScripts()[v.scriptId];
    if (!script) return;
    disarmVersion();
    comparing = { v: v, items: Compare.of(v.content, script.content) };
    versionsSay('');
    drawCompare();
    versionsList.scrollTop = 0;
    versionsList.querySelector('[data-action="compare-back"]').focus();
}

function closeCompare() {
    const id = comparing && comparing.v.id;
    comparing = null;
    renderVersions();
    const again = versionsList.querySelector('[data-id="' + id + '"] [data-action="compare"]');
    if (again) again.focus();
}

async function takeScene(index) {
    const { v } = comparing;
    if (v.scriptId === currentScriptId) flushSave();
    await whenSaved();
    const script = getScripts()[v.scriptId];
    if (!script) return;
    const items = Compare.of(v.content, script.content);
    const x = items[index];
    if (!x || !x.was || x.status === 'same') { comparing.items = items; drawCompare(); return; }
    const when = versionWhen(v.updatedAt, Date.now());
    const what = x.heading ? '“' + x.heading + '”' : 'the title page and opening';
    await replaceScriptText(v.scriptId, Compare.take(script.content, items, index), 'Before taking ' + what + ' from the version of ' + when);
    versionsShown = await Store.loadVersions(scriptDb, versionsOf);
    comparing.items = Compare.of(v.content, getScripts()[v.scriptId].content);
    drawCompare();
    versionsSay('Took ' + what + ' from the version of ' + when + '. The text you had is kept as a version too.');
    (versionsList.querySelector('[data-action="take-scene"]') || versionsList.querySelector('[data-action="compare-back"]')).focus();
}

versionsList.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (!button || !comparing) return;
    if (button.dataset.action === 'compare-back') closeCompare();
    else if (button.dataset.action === 'take-scene') takeScene(Number(button.dataset.index));
});
