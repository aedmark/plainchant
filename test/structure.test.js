// Structure of the app scripts (src/app/*.js). Node only: it reads files, so it is required by test/run.js and not
// by the browser runner. Expects globals: test, assert.
//
// The app is split into classic scripts that share one global scope (D-001, D-014). That is safe only if the page
// loads exactly the files that exist, in an order where load-time code uses only what is already defined.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appDir = path.join(root, 'src', 'app');
const onDisk = fs.readdirSync(appDir).filter((f) => f.endsWith('.js')).sort();
const listed = Array.from(html.matchAll(/<script src="src\/app\/([^"]+)"><\/script>/g)).map((m) => m[1]);
const MAX_LINES = 500;

test('structure: index.html loads every file in src/app exactly once, and no file that does not exist', () => {
    assert.deepEqual(listed.slice().sort(), onDisk, 'the script tags and src/app/ disagree');
    assert.equal(new Set(listed).size, listed.length, 'a script is listed twice');
});

test('structure: the app scripts are loaded after the src/ modules they use, and main.js is last', () => {
    const order = Array.from(html.matchAll(/<script src="([^"]+)"><\/script>/g)).map((m) => m[1]);
    ['src/fountain.js', 'src/editing.js', 'src/library.js', 'src/store.js', 'src/paginate.js', 'src/stats.js', 'src/outline.js', 'src/importing.js', 'src/suggest.js'].forEach((m) => {
        assert.ok(order.indexOf(m) !== -1 && order.indexOf(m) < order.indexOf('src/app/core.js'), m + ' must load before the app scripts');
    });
    assert.equal(order[order.length - 1], 'src/app/main.js');
    assert.equal(order.indexOf('src/app/core.js'), order.indexOf('src/suggest.js') + 1, 'core.js must be the first app script');
});

test('structure: no inline script has crept back into index.html', () => {
    const inline = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)).filter((m) => m[1].trim() !== '');
    assert.equal(inline.length, 0, inline.length + ' inline script(s) with code');
});

test('structure: each app script is valid JavaScript', () => {
    listed.forEach((f) => {
        try { new vm.Script(fs.readFileSync(path.join(appDir, f), 'utf8'), { filename: f }); }
        catch (e) { assert.ok(false, f + ': ' + e.message); }
    });
});

test('structure: together they are one program, so no name is declared twice across files', () => {
    const combined = listed.map((f) => fs.readFileSync(path.join(appDir, f), 'utf8')).join('\n;\n');
    try { new vm.Script(combined, { filename: 'src/app/*.js (concatenated in load order)' }); }
    catch (e) { assert.ok(false, e.message); }
});

test('structure: no app script has grown past ' + MAX_LINES + ' lines (split it by concern before it does)', () => {
    listed.forEach((f) => {
        const lines = fs.readFileSync(path.join(appDir, f), 'utf8').split('\n').length;
        assert.ok(lines <= MAX_LINES, f + ' is ' + lines + ' lines');
    });
});

test('structure: every app script starts with the explanatory header', () => {
    listed.forEach((f) => {
        assert.ok(/^\/\*\n \* Plainchant app script: /.test(fs.readFileSync(path.join(appDir, f), 'utf8')), f + ' has no header comment');
    });
});

test('structure: the stylesheet is a linked file and no inline <style> has crept back into index.html', () => {
    const links = Array.from(html.matchAll(/<link rel="stylesheet" href="(src\/[^"]+)">/g)).map((m) => m[1]);
    assert.deepEqual(links, ['src/styles.css']);
    assert.ok(fs.existsSync(path.join(root, 'src', 'styles.css')), 'src/styles.css is linked but missing');
    assert.ok(!/<style[\s>]/.test(html), 'an inline <style> block is back');
});

// ---------- Offline (P4-02, D-026): nothing from the network, and the service worker's copy is complete ----------

const readRoot = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const css = readRoot('src/styles.css');
const fontUrls = Array.from(css.matchAll(/url\('\.\.\/(fonts\/[^']+)'\)/g)).map((m) => m[1]);
const manifest = JSON.parse(readRoot('manifest.webmanifest'));

test('offline: the page and the stylesheet load nothing from another site (the app needs no network)', () => {
    assert.ok(!/(?:src|href)="(?:https?:)?\/\//i.test(html), 'index.html links to another site');
    assert.ok(!/url\(\s*['"]?(?:https?:)?\/\//i.test(css), 'styles.css loads something from another site');
    assert.ok(!/@import/.test(css), 'styles.css imports another stylesheet');
});

test('offline: every font the stylesheet names is in fonts/, and every font file there is used', () => {
    assert.ok(fontUrls.length >= 12, fontUrls.length + ' font files');
    fontUrls.forEach((f) => assert.ok(fs.existsSync(path.join(root, f)), f + ' is missing'));
    const onDisk = fs.readdirSync(path.join(root, 'fonts')).filter((f) => f.endsWith('.woff2')).map((f) => 'fonts/' + f).sort();
    assert.deepEqual(Array.from(new Set(fontUrls)).sort(), onDisk);
    ['Courier Prime', 'Inter'].forEach((family) => assert.includes(css, "font-family: '" + family + "'"));
});

test('offline: the service worker keeps a copy of exactly the files the app uses, and all of them exist', () => {
    const sw = readRoot('sw.js');
    const listed = Array.from(sw.match(/const APP_FILES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
    assert.equal(new Set(listed).size, listed.length, 'a file is listed twice');
    const pageLinks = Array.from(html.matchAll(/<link [^>]*href="([^"]+)"/g)).map((m) => m[1]);
    const scripts = Array.from(html.matchAll(/<script src="([^"]+)"><\/script>/g)).map((m) => m[1]);
    const expected = ['./', 'index.html', 'manifest.webmanifest'].concat(pageLinks, scripts, fontUrls, manifest.icons.map((i) => i.src));
    assert.deepEqual(listed.slice().sort(), Array.from(new Set(expected)).sort());
    listed.filter((f) => f !== './').forEach((f) => assert.ok(fs.existsSync(path.join(root, f)), f + ' is listed but missing'));
});

test('offline: the manifest makes the app installable (name, start, standalone, 192 and 512 icons, a maskable one)', () => {
    assert.equal(manifest.name, 'Plainchant');
    assert.equal(manifest.start_url, './');
    assert.equal(manifest.display, 'standalone');
    const has = (size, purpose) => manifest.icons.some((i) => i.sizes === size && i.type === 'image/png' && (i.purpose || 'any').split(' ').indexOf(purpose) !== -1);
    assert.ok(has('192x192', 'any') && has('512x512', 'any') && has('512x512', 'maskable'));
    manifest.icons.forEach((i) => assert.ok(fs.existsSync(path.join(root, i.src)), i.src + ' is missing'));
});
