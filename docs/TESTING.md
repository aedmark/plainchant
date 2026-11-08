# Testing

How to run every test, what each one proves, and what it cannot. Read this before claiming anything works. The results
themselves live in HANDOFF's "Verified" table; this file is how to get them.

## The suites

| Suite | File | Proves | Does not prove | Time, needs |
| --- | --- | --- | --- | --- |
| Unit, Node | `test/*.test.js` via `test/run.js` (`npm test`) | the pure modules' rules: parser, typing helpers, library, import, suggest, store rules, pagination, stats, outline, versions, narration, adventure, compare, file-sync, FDX, finding | the DOM, real IndexedDB, any browser behaviour | seconds, Node 18+ |
| Structure | `test/structure.test.js` (part of `npm test`, Node only) | the app scripts, the page and `sw.js` agree; no inline script or style; no duplicate global name; no file over 500 lines; nothing loaded from another host; no tracker-like file name | that any of it runs | seconds |
| Unit, browser | `test/index.html` | the same unit tests in a real engine | the app | part of the headless run |
| App end to end | `test/app.e2e.html` | restore, save, library, typing, panes, print layout, themes and the accessibility sweep, in headless Chromium or Chrome with a real IndexedDB | Firefox, Safari, a real phone or tablet, real printing, a screen reader, an ad blocker | about 50 s, a browser |
| Docs | `tools/check_docs.py` | the documents agree with each other: IDs, links, tables, limits | that the prose is true of the code | under a second, Python 3 |

**The fast set** (before every commit): `npm test` and `python3 tools/check_docs.py`.
**The full set** (before declaring a code change done, and after deleting or moving code): add `npm run test:browser`.

**Expected results** live in HANDOFF's "Verified" table, with the date and commit they were measured on. A count written
anywhere else goes stale without anyone noticing: point to HANDOFF instead.

## Before any run

- **Never run a headless browser against `file://` pages with your real profile.** The runner uses a throwaway profile
  (D-007).
- **Never add `--virtual-time-budget` back.** IndexedDB never answers under it (D-019). The suites run in real time.
- **Choosing the browser:** `BROWSER=/path/to/chrome npm run test:browser`. Exit code 0 means pass.
- **Services:** none. `npm run serve` (`python3 -m http.server 8080`) is only for looking at the offline copy.

## Running each suite

```bash
npm test
```

- Runs every `test/*.test.js` under Node. A pass ends with a summary line and exit code 0.

```bash
npm run test:browser
```

- Runs the unit suite and the app e2e in headless Chromium or Chrome (Linux and macOS: `test/run-headless.sh`). On
  Windows, `npm run test:browser:windows` (`test/run-headless.ps1`, Edge or Chrome) handles headless Edge's quirks; it
  has not been run since session 11.
- "The page never finished" means a script error or a hung `await`. Open the page in a browser, or in Playwright with
  `waitUntil: 'commit'` (the e2e page holds its own load event open until it is done, for up to 10 real minutes).
- Or open `test/index.html` (unit) or `test/app.e2e.html` (needs http, or `--allow-file-access-from-files`) in a
  browser; a green banner means pass.

```bash
python3 tools/check_docs.py
```

- Exit 1 on an error, 0 with warnings. It reads `AGENTS.md`, `CLAUDE.md`, `README.md`, `ROADMAP.md` and the `docs/`
  set (HANDOFF, DECISIONS, README, ARCHITECTURE, TESTING, SECURITY, CONTRIBUTING, CHANGELOG) as active documents, and
  `docs/SESSION-LOG.md` and `docs/archive/*.md` as history. It checks IDs (`P`, `D`, `Q`, `T`), links, the AGENTS.md
  Layout and App scripts tables, invisible characters, HANDOFF's date and Session owner line and size limits.
- To trust a change to the checker, plant the mistake in a scratch copy (an undefined tension reference, a duplicate tension number, a
  zero-width space) and see it fail.

### Adding a check

- A parser rule gets a test in `test/fountain.test.js` first. A change to app behaviour (restore, save, library) extends
  `test/app.e2e.html`.
- In the e2e, wait for `loaded(frame, go)` after any navigation, and read storage with `await stored()` or
  `await storedMeta()` (they wait for every frame's pending writes first).
- Assert on what happened (stored text, a returned value), not on words in a message.
- Before trusting a new check, make it fail: undo the fix (only the fix) and run it. A check that passes either way
  proves nothing.

## Runs that vary

Two timing checks can trip on a busy machine: "hints: on a 120-page script a keystroke's redraw stays quick" (e2e 16k,
20 ms) and "speed: a feature-length script lays out quickly" (`test/paginate.test.js`, 150 ms). If one fails alone, run
again; if it fails twice, it is real. Record the tally in HANDOFF when it matters.

## Change-to-check matrix

| Changed area | Minimum checks | Additional evidence |
| --- | --- | --- |
| Documentation only | `python3 tools/check_docs.py` | read the rendered links |
| Pure module (`src/*.js`) | `npm test` | a mutation run for a rule that matters (see pitfalls) |
| App scripts, CSS, `app.html` | `npm test` and `npm run test:browser` | a look in the app; Firefox if the change is layout or CSS `zoom` |
| Help's wording or a copy edit | the e2e (checks match visible text exactly) | update the check's pattern (D-059) |
| Storage, schema, migration | the full set | a real library in a real profile; two tabs |
| A new file the page loads | the structure test | add it to `APP_FILES` in `sw.js`; bump `CACHE` if a file was removed or renamed |
| CSS colours | the e2e accessibility sweep (16o) | all three themes |

## Manual checks

What only a person can check. Record who checked what, where and when in HANDOFF; the current list of what nobody has
seen is HANDOFF's "Not checked yet".

- A day of writing, then Library > Versions: Go back, then Ctrl+Z.
- An Android phone or tablet: keyboard room at the bottom of a long script, tapping the preview, press-and-hold quick
  edits, Focus mode, the element bar keeping the keyboard up.
- Firefox: quick edits, the panes switch, the page view's scaling.
- A real `.fdx` opened in Final Draft; a narration chapter list pasted into YouTube.

## Environment recipes

- **Browser:** any Chromium or Chrome on PATH; otherwise set `BROWSER`.
- **Playwright** is not a project dependency. For ad-hoc checks (service worker offline, real print output) install it
  in a scratch directory and point `NODE_PATH` at it. For the offline copy, serve the folder over http, then
  `context.setOffline(true)`. For real print output, `page.emulateMedia({ media: 'print' })` then
  `page.pdf({ preferCSSPageSize: true })`.
- **Node** may be missing from PATH in a session that was already open when it was installed: refresh PATH or restart.

## Known pitfalls (already hit, already fixed: don't re-discover these)

- **The e2e checks match visible text exactly** (`textContent`, Help's wording, button labels). An editor's reformat
  that wraps a sentence across lines in `app.html` breaks them, and so does a copy edit. Keep each phrase a check looks
  for on one line (D-059).
- **The e2e page is one shared script scope** (about 2,000 lines): a name declared twice (`typeInto`, `cs2`, `tf`, `kw`,
  `chips`, `said` all have) breaks the whole page. Prefix a new section's names (`verF`, `acChips`) and syntax-check by
  compiling each `<script>` block of `test/app.e2e.html` with `new Function` under `node -e`.
- **Every e2e frame must set `plainchant_onboarded` first**, or the tour opens and blocks it. A stubbed write that never
  resolves hangs `stored()` (section 16c reads `Store.loadAll(await idb())` directly while one is in place).
- **Stale autosave timers:** frames from early sections keep a 2-second autosave timer, and a late one can write into
  storage during a later section (symptom: "library: choosing a script opens the wrong script"). A new section that
  touches storage after long-lived frames silences every existing frame first, as the typing section does.
- **A line in capitals parses as a character cue** (`A.` alone after a blank line): use lowercase in action fixtures.
- **The Help cheat sheet is tested against the parser:** each `<code data-expect="...">` in `app.html` runs through
  `Fountain.classifyLines`. Change the parser and the failing example names the Help line to update. Add a line to Help
  for each user-visible feature; bump `TOUR_VERSION` to re-show a revised tour.
- **A mutation check must break the fix, not the test.** A scratch script swaps one source line, runs the suites and
  restores it. Restore from the text the script read, **never with `git checkout <file>`**; do not commit while a run
  is going; check `git diff` after an interrupted run. Survivors are usually a weak test or a redundant guard.
- **Headless runs have no browser extensions**, so they cannot catch an ad blocker refusing a file. Never name a file
  like a tracker (pageview, analytics, track, beacon, ads, banner, metric, counter); the structure test checks (D-055).
- **A test that calls internals breaks when they are cleaned up.** Functions the e2e calls stay top-level declarations
  (`fitToViewport`, `setView`, `setMenu`, `syncElementState`, `buildPrintPages`, `printScript`, `saveScript`,
  `flushSave`, `whenReady`, `whenSaved`, `restoreLastScript`, and `currentScriptId` as a top-level `let`).
- **Dialogs:** tests read `.modal-overlay.active`, not `openModals`; do not toggle `.active` by hand.
- **Versions in the e2e:** the frame's `Date.now` is stubbed to reach "ten minutes later" (`Versions.due`).
