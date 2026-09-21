/*
 * Plainchant app script: tour: the welcome tour, shown once on first launch
 *
 * One of the classic scripts loaded by index.html, in order (see CLAUDE.md, "App scripts"). They share the
 * page's global scope, so top-level functions and consts here are visible to the files after it, and anything
 * that runs at load time may only use what an earlier file (or a src/*.js module) already defined.
 */

// --- Welcome tour: once, on first launch; replayable from Help ---
const TOUR_KEY = 'frictionless_onboarded';  // holds the tour version the writer has seen
const TOUR_VERSION = '1';                   // bump to show an updated tour to everyone again
const tourModal = document.getElementById('tour-modal');
const tourSteps = Array.from(tourModal.querySelectorAll('.tour-step'));
const tourDots = Array.from(tourModal.querySelectorAll('.tour-dots span'));
const tourBack = document.getElementById('tourBack');
const tourNext = document.getElementById('tourNext');
const tourSkip = document.getElementById('tourSkip');
let tourIndex = 0;

// The tour's sample is rendered by the real parser, so what it shows is what the app does
document.getElementById('tourRendered').innerHTML =
    Fountain.toHTML(Fountain.parse(document.getElementById('tourSample').textContent));

function showTourStep(n) {
    tourIndex = Math.max(0, Math.min(tourSteps.length - 1, n));
    const last = tourIndex === tourSteps.length - 1;
    tourSteps.forEach((s, i) => { s.hidden = i !== tourIndex; });
    tourDots.forEach((d, i) => { if (i === tourIndex) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); });
    tourBack.hidden = tourIndex === 0;
    tourNext.hidden = last;
    tourSkip.hidden = last;
    tourModal.querySelector('.modal-body').scrollTop = 0;
    document.getElementById('tour-title').textContent = last ? 'You\'re set' : 'Welcome to Plainchant';
}

function markTourSeen() {
    try { localStorage.setItem(TOUR_KEY, TOUR_VERSION); } catch (e) { /* storage unavailable */ }
}

function openTour() {
    showTourStep(0);
    openModal(tourModal, { focus: '#tourNext', onClose: markTourSeen });
}

function maybeShowTour() {
    let seen;
    try { seen = localStorage.getItem(TOUR_KEY); } catch (e) { return; } // cannot remember it: don't nag every load
    if (seen !== TOUR_VERSION) openTour();
}

tourNext.addEventListener('click', () => { showTourStep(tourIndex + 1); (tourNext.hidden ? document.getElementById('tourStart') : tourNext).focus({ preventScroll: true }); });
tourBack.addEventListener('click', () => { showTourStep(tourIndex - 1); (tourBack.hidden ? tourNext : tourBack).focus({ preventScroll: true }); });
document.getElementById('tourStart').addEventListener('click', () => {
    closeModal(tourModal);
    editor.focus({ preventScroll: true });
});
document.getElementById('helpTakeTour').addEventListener('click', () => {
    closeModal(helpModal);
    openTour();
});
