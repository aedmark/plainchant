# Session Handoff

Read this first. It describes the project **as it is right now** and what comes next. It is rewritten at the end of
every session, and nothing in it is history: when something stops being true, change it or delete it.

History (what each session did) is in [SESSION-LOG.md](SESSION-LOG.md). Protocol: [CLAUDE.md](../CLAUDE.md).
Plan: [ROADMAP.md](../ROADMAP.md). Decisions: [DECISIONS.md](DECISIONS.md). The writer-facing story: [devlog/](devlog/).

---

## Current state

_Last updated: 2026-09-30, session 31. Plainchant now has a public homepage at `index.html`; the writing app is
`app.html` and installed copies open there (D-061). Tests: `npm test` 339, browser suite 327 unit + 730 e2e._

**Where things stand:** Phases 1 to 4 are done apart from P2-06 (desktop scroll sync still goes by percentage) and
an optional idea (P2-20 first-use hints). Phase 3's output is done (Fountain and Final Draft export, print / save as
PDF, the page view while writing); what is left there is optional (P3-09, P3-10, P3-14). Phase 5 has real files on
disk (P5-01, Chromium only); cloud sync and sharing (P5-02, P5-03) are not planned. The owner dropped the brand and
Apple-platform phases and the device-pass items from the roadmap on 2026-09-29. The biggest gap is not code: most
features have only run in headless Chromium and the owner's Firefox, so the owner's hands-on checks (Next steps 1)
matter more than the next feature.

**Front door:** `index.html` introduces Plainchant to new writers with a raw-text-to-page demonstration, the
distraction-free and local-first promise, a four-step primer, the core workflow, and links into `app.html` (P6-01,
D-061). The homepage needs no JavaScript and shares the app's bundled typefaces.

**What the app does** (ROADMAP has every ticked item; the detailed notes as of session 29 are frozen at the end of
SESSION-LOG.md)
- **Writing:** Fountain text in a textarea with colour hints behind it (D-031); a live preview patched block by block
  (D-043) or shown as printed sheets (page view, D-054); on a desktop the editor, the preview or both (D-056); quick
  edits in the preview by double-click or press-and-hold (D-057). Under 1024px, one pane at a time (Void | Canvas, D-060).
- **Typing helpers:** Tab cycles elements, smart Enter, capitals as you type, character names guessed on Enter, the
  element bar, autocomplete chips for names, places and times of day (D-010, D-017, D-036, D-037); focus mode (D-025);
  the caret kept clear of the on-screen keyboard (D-030); tapping the one-pane preview goes to that line (D-033).
- **Library and storage:** IndexedDB (database `plainchant`, version 3), an emergency buffer for a tab closed
  mid-write, other tabs told of every change (D-018 to D-020); search, rename, duplicate, delete with 30-day restore
  (D-013); versions with scene-by-scene compare (D-034, D-044); asking the browser to keep the library (D-027).
- **In and out:** import `.fountain` / `.txt` / `.md` (D-016); download `.fountain` or `.fdx` (D-049, D-052); print /
  save as PDF on Letter or A4 (D-021, D-022, D-051); scripts linked to real files on disk, Chromium only (D-046).
- **Around the script:** stats with scenes, locations and the scene mix (D-023, D-028, D-029); the Outline (D-024);
  read-aloud time and YouTube chapters for narrated videos (D-038).
- **Everything else:** Settings (D-032); dark, light, retro (CGA) and system themes, text size, an accessibility sweep
  in the e2e (D-035, D-041, D-047); the welcome tour and Help (D-011); offline and installable when served (D-026);
  adventure-game replies in the retro theme (D-042, an Easter egg, not in Help).

**Not checked yet** (the tests cannot, or have not)
- **Real touch devices (Android):** keyboard room at the bottom of a long script, tapping the preview, quick edits by
  press-and-hold (does Android's own long-press menu compete?), soft-keyboard Enter and composition (GBoard may delay
  auto-uppercase), the element bar keeping the keyboard up. The owner reported in September that the app works on
  their tablet and that import, export and real files work on Android, without these specifics.
- **Firefox:** the owner reports it works well, but quick edits (P2-24), the panes switch (P2-23) and the page view's
  scaling (CSS `zoom`, P3-12) were built after that report and have not been seen there.
- **Quick edits (P2-24):** two tests are missing (session 28's mutation run): a finger that moves while holding
  cancels the hold (scrolling never opens the box), and a mouse held down never opens it (selecting text).
- **Final Draft export** has never been opened in Final Draft.
- **Versions on a real library:** the database upgrades (to version 2, then 3) have only run in fresh test profiles.
  With two tabs open, the older tab loses its database when the newer one upgrades (reload it).
- **Persistent storage** has not met a real browser's yes: Firefox's prompt, an installed copy in Chrome.
- **Narration:** 150 words a minute, counting words only, is an estimate; no chapter list has been pasted into
  YouTube yet.
- **Printing** has only run in headless Chromium, deliberately: the owner chose (2026-09-26) to assume it works until a
  bug report says otherwise.
- **Also unobserved:** a real tab closed mid-write; colour hints with IME or dictation; Windows high-contrast mode; a
  screen reader hearing the autocomplete chips; the ad-blocker fix (D-055) confirmed with the owner's blocker on; the
  Windows test runner (not run since session 11).
- Whether Enter / Tab, name guessing and Tab-takes-the-suggestion *feel* right is the owner's judgement (Settings can
  switch most of it off).

## Gotchas

**Tests**
- Run `npm test` (Node, unit) and `bash test/run-headless.sh` (headless Chromium, unit + e2e, real time, about 60 s)
  before declaring anything done. Never add `--virtual-time-budget` back: IndexedDB never answers under it (D-019).
  "The page never finished" means a script error or a hung `await`; open the page in a browser, or in Playwright with
  `waitUntil: 'commit'` (the e2e page holds its own load event open until it is done, for up to 10 real minutes).
- **The panes are the Void (the text) and the Canvas (the formatted script)** in everything a writer sees, on every
  screen size (D-060). Code and tests still say write / preview (`data-view`, `setView('preview')`, `#tabPreview`).
- **The e2e checks match visible text exactly** (`textContent`, Help's wording, button labels). An editor's
  "reformat" that wraps a sentence across lines in `app.html` breaks them, and so does a copy edit ("capitalised"
  to "capitalized"). Keep each phrase a check looks for on one line, and after changing Help's wording run the e2e
  and update the check's pattern to the new words (D-059).
- **The e2e page is one shared script scope** (~2,000 lines): a name declared twice (`typeInto`, `cs2`, `tf`, `kw`,
  `chips`, `said` all have) breaks the whole page. Prefix a new section's names (`verF`, `acChips`) and syntax-check by
  compiling each `<script>` block of `test/app.e2e.html` with `new Function` under `node -e`.
- **Every e2e frame must set `plainchant_onboarded` first**, or the tour opens and blocks it. Wait for
  `loaded(frame, go)` after any navigation; read storage with `await stored()` / `await storedMeta()`. A stubbed write
  that never resolves hangs `stored()` (section 16c reads `Store.loadAll(await idb())` directly while one is in place).
- **Stale autosave timers:** frames from early sections keep a 2-second autosave timer, and a late one can write into
  storage during a later section (symptom: "library: choosing a script opens the wrong script"). A new section that
  touches storage after long-lived frames should silence every existing frame first, as the typing section does.
- **Two timing checks can trip on a busy machine:** "hints: on a 120-page script a keystroke's redraw stays quick"
  (e2e 16k, 20 ms) and "speed: a feature-length script lays out quickly" (`test/paginate.test.js`, 150 ms). If one
  fails alone, run again; if it fails twice, it is real.
- **A line in capitals parses as a character cue** (`A.` alone after a blank line): use lowercase in action fixtures.
- **The Help cheat sheet is tested against the parser:** each `<code data-expect="...">` in `app.html` runs through
  `Fountain.classifyLines`. Change the parser and the failing example names the Help line to update. Add a line to Help
  for each user-visible feature; bump `TOUR_VERSION` to re-show a revised tour.
- **Mutation testing** (a scratch script swaps one source line, runs the suites, restores it) is how features have been
  checked. Restore from the text the script read, **never with `git checkout <file>`**; don't commit while a run is
  going; check `git diff` after an interrupted run. Survivors are usually a weak test or a redundant guard.
- Headless runs have no browser extensions, so they cannot catch an ad blocker refusing a file: never name a file
  like a tracker (pageview, analytics, track, beacon, ads, banner, metric, counter; `test/structure.test.js`, D-055).

**App code**
- The app is classic scripts in `src/app/` sharing one global scope (CLAUDE.md "App scripts", D-014). Functions the e2e
  calls stay top-level declarations: `fitToViewport`, `setView`, `setMenu`, `syncElementState`, `buildPrintPages`,
  `printScript` and the others listed in CLAUDE.md. Header comments are optional; no test looks for them (D-059).
- **Offline:** add any new file the page loads to `APP_FILES` in `sw.js` (the structure test fails until you do), and
  bump `CACHE` when a file is removed or renamed. Service workers never run on `file://`; to see the offline copy,
  serve the folder (`python3 -m http.server`) and use Playwright with `context.setOffline(true)`.
- **Never assign `editor.value` or use `setRangeText` for a user-visible edit:** it wipes undo. Go through
  `applyEdit()` (execCommand). Programmatic loads (Library, New, restore) may assign `.value`. `applyingEdit` stops our
  own edits re-triggering auto-uppercase; `elementMode` / `modeLine` are the chosen-element state.
- The parser is spec-strict (D-004); the editor adds leniency (D-010), writing forced markers (`!`, `@`, `.`, `> `)
  where needed. Blank lines are structure, not spacers: spacing is CSS margins only. `Editing.kindAt()` asks the parser
  twice (next line blank / not); the property test "the parser agrees afterwards" is its safety net.
- Autocomplete: `Suggest.at(text, caret, mode)` sees a cue only once the line is uppercase; `mode` matters only for an
  empty cue line, whose suggestions carry `tab: false`. Chips are `.suggest-chip`, not `.el-btn` (tests count six
  element buttons). `dismissedFor` clears as soon as the caret leaves the dismissed word.
- **The editor's copies must lay out exactly like the textarea** (colour layer, measuring copy): line height a length
  (`1.6em`), `copyEditorType` for type and width, `getBoundingClientRect`, not `offsetTop`. The wrap check in `shade.js`
  switches the hints off if anything drifts.
- **Colours** are tokens in all three theme sets, never literals in the chrome (D-035, D-041); the e2e sweep (16o) fails
  for text under 4.5:1 or an unnamed control in any theme, so run the e2e after any CSS change.
- **Settings:** a new choice goes in `SETTING_DEFAULTS` (and `SETTING_CHOICES` for a pick-one) with a control in the
  window; the stored key holds only what differs from the defaults; a pure rule takes it as an option.
- Dialogs: `openModal(overlay, {focus, onClose})` / `closeModal(overlay)`; any `data-close` element closes. Don't toggle
  `.active` by hand; tests read `.modal-overlay.active`, not `openModals`.
- **Printing:** `#print-root` is `display: none` on screen (show it before measuring); the `@page` size comes from a
  `<style>` that `print.js` creates. Real output: Playwright `page.emulateMedia({ media: 'print' })` then
  `page.pdf({ preferCSSPageSize: true })`.
- Two media queries live in two places each: the CSS one-pane block and `MOBILE_QUERY`, the CSS fixed-body rule and
  `FIT_QUERY`. Change each pair together (D-008, D-009). Help's `?` / "Help" label switches at 700px with the actions;
  move them together.
- No `nowrap` or large `ch` margin in the preview without checking 744-1024px wide (it once clipped the preview off
  every portrait iPad). In Preview on mobile, `.pane-void` is `display: contents` (never `none`; a test guards it).
  `#render-target` (scroll area) and `#page` (the column) are separate on purpose: render into `#page`, scroll
  `#render-target`.

**Storage**
- The library is the in-memory `library` in `persistence.js`; `putScripts(next)` stores the difference. Never write to
  IndexedDB or localStorage directly (other tabs would not be told; the emergency buffer would go wrong); the
  exceptions are `versions-ui.js` and `files-ui.js`, through `Store`. The global is `Store`, never `Storage`. Each
  IndexedDB write creates its transaction synchronously: no `await` in front of one (D-019).
- No legacy support (D-020): the old `frictionless_*` keys are dead. Storage names may change without a migration
  while this is not a production release; record it in DECISIONS.
- Versions are saved inside `Store.saveScript`'s own transaction when `Versions.due` says so; the e2e stubs the frame's
  `Date.now` to reach "ten minutes later".

**Environment and git**
- The owner works on Arch Linux: `npm run test:browser` runs the Linux runner. `npm run test:browser:windows`
  (`test/run-headless.ps1`) still exists and handles headless Edge's quirks (unquoted URLs, paths with spaces).
- `origin` is `https://github.com/aedmark/plainchant.git`. Cloud sessions work on the branch they are given, commit
  and push there; the owner merges into `master` and says so. No `gh` CLI: GitHub-side changes are the owner's. The
  owner's preference: commit finished, tested work without asking; never force-push or rewrite history; push when
  asked. The owner also commits from PyCharm, often with one-word messages ("0", "copy").
- The docs in this repo are the only memory between sessions. The old name (NeuroFountain) appears in DECISIONS and
  the session log as history: never bulk-replace it.

## Next steps (in order)

1. **The owner's hands-on checks,** each a few minutes (whatever feels wrong is the next session's first job):
   - After a day of writing, **Library > Versions** on a real script: Go back, then Ctrl+Z.
   - **On an Android phone or tablet:** type at the bottom of a long script (three lines of room above the keyboard?);
     tap a line in Preview (does the keyboard come up?); press and hold a line for a quick edit; Focus mode; the times
     of day offered after `INT. X - `.
   - **In Firefox:** double-click a line for a quick edit; the panes switch; the page view (does it scale?), and typing
     on a long script with it on (does the short pause feel right?).
   - **Name guessing:** write normally for a while. If Enter ever takes an action line for a character, the planned fix
     is to require a known name for single words (D-036).
   - **Firefox's "keep your data" prompt:** does it appear, and what does the foot of the Library say after?
   - **Narration:** read a page aloud against a clock and set that speed in Settings; paste the chapters into an
     unlisted YouTube upload and see whether YouTube accepts them.
   - If anyone you send scripts to has Final Draft, a real `.fdx` opened there.
2. **Small loose end:** the two quick-edit tests listed under "Not checked yet".
3. **Then the next feature, the owner's pick.** Candidates: **P3-14** importing `.fdx`; **P3-09 / P3-10** Library and
   export extras; **P5-04** real-file extras; **P2-20** first-use hints.

**For the dev diary:** nothing waiting; the 2026-09-30 entry includes the homepage and the recent language clean-up.

The latest entry, "Touching Up the Page", covers everything up to session 28.

## Open questions for the owner

- Is the tour the right length and tone (four steps)? It has not been revised since session 8.
- Enter after an action line starts a new paragraph (Shift+Enter for a line break): the right default? (Switchable,
  D-032.)
- Name guessing on Enter (D-036): does it guess wrong in real writing?
- Tab takes the first suggestion (names, places, times of day, D-037): right?
- Should the preview follow the theme (a dark page), or stay paper as now (D-035)?
- Narration (D-038): is 150 words a minute the right default; should chapters also be offered from scenes (for scripts
  with no sections); should the header's page count show the read-aloud time for narrated scripts?
