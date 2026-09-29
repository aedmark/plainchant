let offlineState = 'pending';

function setUpOffline() {
    if (!/^https?:$/.test(location.protocol)) { offlineState = 'file'; return; }
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = 'manifest.webmanifest';
    document.head.appendChild(manifest);
    if (!('serviceWorker' in navigator)) { offlineState = 'unsupported'; return; }
    navigator.serviceWorker.register('sw.js').then(
        () => { offlineState = 'registered'; },
        (e) => { offlineState = 'failed'; console.warn('The offline copy could not be set up:', e); });
}

window.addEventListener('load', setUpOffline);
