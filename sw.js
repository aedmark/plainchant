/*
 * Plainchant service worker (P4-02, D-026): keeps a copy of the whole app in the browser so it opens and works with
 * no connection, and so it can be installed. Browsers run service workers only for pages served over http(s) (and
 * localhost), never for index.html opened from disk; opened from disk the app is already on the device, and with
 * the fonts in fonts/ it needs no network at all.
 *
 * Every request for one of the app's files is answered from the copy at once, and the copy is refreshed from the
 * network in the background (stale-while-revalidate): offline it just works, online a change shows on the next load.
 * Scripts live in IndexedDB, not here. test/structure.test.js checks that APP_FILES lists exactly what the page loads.
 * Change CACHE when files are removed or renamed, so the old copies are cleared out.
 */
const CACHE = 'plainchant-v2';
const APP_FILES = [
    './',
    'index.html',
    'manifest.webmanifest',
    'src/styles.css',
    'src/fountain.js',
    'src/editing.js',
    'src/library.js',
    'src/store.js',
    'src/paginate.js',
    'src/stats.js',
    'src/outline.js',
    'src/importing.js',
    'src/suggest.js',
    'src/app/core.js',
    'src/app/layout.js',
    'src/app/persistence.js',
    'src/app/dialogs.js',
    'src/app/library-ui.js',
    'src/app/example.js',
    'src/app/help.js',
    'src/app/tour.js',
    'src/app/settings.js',
    'src/app/typing.js',
    'src/app/shade.js',
    'src/app/focus.js',
    'src/app/export.js',
    'src/app/import.js',
    'src/app/print.js',
    'src/app/stats-ui.js',
    'src/app/outline-ui.js',
    'src/app/main.js',
    'src/app/offline.js',
    'src/app/safekeeping.js',
    'fonts/courier-prime-latin-400-italic.woff2',
    'fonts/courier-prime-latin-400-normal.woff2',
    'fonts/courier-prime-latin-700-italic.woff2',
    'fonts/courier-prime-latin-700-normal.woff2',
    'fonts/courier-prime-latin-ext-400-italic.woff2',
    'fonts/courier-prime-latin-ext-400-normal.woff2',
    'fonts/courier-prime-latin-ext-700-italic.woff2',
    'fonts/courier-prime-latin-ext-700-normal.woff2',
    'fonts/inter-latin-400-normal.woff2',
    'fonts/inter-latin-600-normal.woff2',
    'fonts/inter-latin-ext-400-normal.woff2',
    'fonts/inter-latin-ext-600-normal.woff2',
    'icons/icon.svg',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
    'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys()
        .then((keys) => Promise.all(keys.filter((k) => k.indexOf('plainchant-') === 0 && k !== CACHE).map((k) => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
    event.respondWith(caches.open(CACHE).then(async (cache) => {
        const copy = await cache.match(request, { ignoreSearch: true });
        const fresh = fetch(request)
            .then((response) => { if (response.ok) cache.put(request, response.clone()); return response; })
            .catch(() => null);
        if (copy) { event.waitUntil(fresh); return copy; }
        const response = await fresh;
        if (response) return response;
        return request.mode === 'navigate' ? cache.match('index.html') : Response.error();
    }));
});
