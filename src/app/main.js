let startup = null;

async function start() {
    fitToViewport();
    await restoreLastScript();
    render();
    syncElementState();
    restoreFocusMode();
    maybeShowTour();
    startSafekeeping();
    startFiles();
}

function whenReady() {
    return startup || Promise.resolve();
}

window.addEventListener('DOMContentLoaded', () => { startup = start(); });
