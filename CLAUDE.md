# Plainchant

Lightweight, responsive screenwriting app: the writer types Fountain-style plain text, the app handles formatting.
Built for writers who would rather write than fuss over format. Static HTML/CSS/JS, no build step, no runtime
dependencies (see docs/DECISIONS.md). The repo (`aedmark/plainchant`) and this folder share the name; the former
working name, NeuroFountain, survives only as history in the docs.

## Session protocol

Sessions are short-lived and context resets between them, so the repo carries the memory.

**Start of every session**
1. Read `docs/HANDOFF.md`: "Current state" and the latest session-log entry.
2. Read `ROADMAP.md` for the item(s) you are about to work on. Skim `docs/DECISIONS.md` if you are about to make a
   design choice.
3. Confirm the plan with the user in one or two lines, then work on roadmap items by ID.

**While working**
- Work one roadmap item at a time; keep each commit scoped to it. Reference IDs (`P1-06`) in commit messages.
- If you make a choice a future session might question, add an entry to `docs/DECISIONS.md`.
- If you discover new work, append a new item to ROADMAP.md (never renumber existing IDs).
- Run the tests before declaring anything done (see below).

**End of every session (or when the user says to wrap up)**
1. Tick / update items in `ROADMAP.md`.
2. Rewrite the **Current state** and **Next steps** sections of `docs/HANDOFF.md` so they are true right now.
3. Add a session-log entry at the top of the log using the template in HANDOFF.md.
4. Never leave "Current state" describing something that is no longer true. Handoff docs that lie are worse than none.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | The page: markup, and the links to the stylesheet and scripts (no inline style or script) |
| `fonts/` | Courier Prime and Inter as `woff2` (OFL, licences alongside), declared at the top of `src/styles.css`. The app loads nothing from the network (D-026) |
| `icons/`, `manifest.webmanifest`, `sw.js` | The placeholder icon (SVG + PNG sizes), the web app manifest and the service worker: offline and installable when served over http(s). `sw.js`'s file list must match what the page loads (`test/structure.test.js` checks) (D-026) |
| `src/styles.css` | All the CSS. Desktop-first; the mobile block mirrors `MOBILE_QUERY` / `FIT_QUERY` in `src/app/layout.js` |
| `src/app/*.js` | The app itself, one file per concern, loaded in order by `index.html` (see "App scripts" below, D-014) |
| `src/fountain.js` | Fountain parser + HTML renderer, and the editor's line kinds (`classifyLines`, `shade`). Pure, UMD, no DOM (D-003) |
| `src/editing.js` | Typing helpers (Tab, smart Enter, auto-uppercase): text + caret in, edit out. Pure, UMD (D-010) |
| `src/library.js` | Library data rules (search, soft delete, restore, purge, duplicate, rename): scripts object in, new object out. Pure, UMD (D-013) |
| `src/importing.js` | Import rules: which files to accept, decoding (UTF-8/16, Windows-1252), line endings. Pure, UMD (D-016) |
| `src/suggest.js` | Autocomplete rules: names and locations from the script, what to offer for the word being typed. Pure, UMD, uses `Fountain` and `Editing` (D-017) |
| `src/paginate.js` | Print pagination: tokens in, pages of positioned lines out, on the Courier grid (60 columns, 54 rows Letter / 58 A4) with the page-break rules. Pure, UMD, uses `Fountain` (D-021, docs/SPEC-PRINT.md) |
| `src/stats.js` | Script stats: pages (as printed), screen time, scenes, words, per-character speeches and words, per scene its page, length in eighths and speakers, the INT / EXT and time-of-day mix, and the locations (`Stats.heading`). Pure, UMD, uses `Fountain` and `Paginate` (D-023, D-028, D-029) |
| `src/outline.js` | The outline: sections, scenes (with the page each starts on) and synopses, and which one a line is in. Pure, UMD, uses `Fountain` and `Paginate` (D-024) |
| `src/store.js` | Storage in IndexedDB, global `Store`: pure rules (diff, delete guard, emergency-buffer reconcile) plus thin IndexedDB calls that take the database as an argument. UMD (D-018, D-019, D-020) |
| `test/` | `fountain.test.js` (parser), `editing.test.js` (typing helpers), `library.test.js` (library rules), `importing.test.js` (import rules), `suggest.test.js` (autocomplete rules), `store.test.js` (storage rules), `paginate.test.js` (print pagination), `stats.test.js` (script stats), `outline.test.js` (outline), `structure.test.js` (app script structure, Node only), `app.e2e.html` (app behaviour), `harness.js`, runners: `index.html`, `run-headless.ps1` (Windows), `run-headless.sh` (Linux/macOS), `run.js` |
| `ROADMAP.md` | The plan, with stable item IDs |
| `docs/HANDOFF.md` | Current state, next steps, session log |
| `docs/DECISIONS.md` | Append-only decision record |

## App scripts (`src/app/`)

The app is a set of classic scripts that share **one global scope**, loaded by `index.html` in this order. That
order matters for one reason: code that runs *while a file loads* (registering listeners, reading the DOM) may only
use what an earlier file already defined. Code inside functions runs later and can call anything.

| File | Owns |
| --- | --- |
| `core.js` | `editor` / `renderTarget` / `page` references, `newId`, `currentScriptId`, `autoSaveTimer`, `showNotice`, `render()` (one parse for the preview and the colour hints) |
| `layout.js` | One pane at a time, the phone menu, keyboard-safe sizing (`fitToViewport`), the caret kept clear of the keyboard (`keepCaretClear`, D-030), a tap on the one-pane preview going to that line (D-033), scroll sync, measuring where text falls in the editor (`textTopIn` / `textTop`, the cached `textAbovePx`) |
| `persistence.js` | The in-memory library, IndexedDB writes and the emergency buffer, the no-storage notice, restoring the last script, New, the trash purge, save on hide (D-019) |
| `dialogs.js` | `openModal` / `closeModal`: the one accessible helper for every modal window |
| `library-ui.js` | The Library dialog (data rules are in `src/library.js`) |
| `example.js`, `help.js`, `tour.js` | The example script, the Help window, the welcome tour |
| `settings.js` | The Settings window and `settings` (colours, blank lines on Enter, capitals as you type; `setSetting`), stored in `plainchant_settings` (D-032) |
| `typing.js` | Tab, smart Enter, auto-uppercase, the element bar, autocomplete chips (rules are in `src/editing.js` and `src/suggest.js`) |
| `shade.js` | The editor's colour hints: a coloured copy of the text behind the textarea (whose own text is transparent), redrawn line by line from `render()`'s parse, with a wrap check that switches it off if it ever misaligns (D-031) |
| `focus.js` | Focus mode: the veils around the current block, typewriter scrolling, the toggle and Ctrl/Cmd+Shift+F (D-025) |
| `export.js` | The Export dialog (the `.fountain` download), and Copy |
| `import.js` | Import: the Library's picker and drag-and-drop onto the page; `showNotice` messages (defined in `core.js`) |
| `print.js` | Print / save as PDF: draws the `src/paginate.js` pages as paper-sized sheets in `#print-root`, the paper choice, `beforeprint` (D-021, D-022) |
| `stats-ui.js` | The live page count in the preview's header (`scheduleStats`, called by `render()`) and the Script stats window, with the scene mix, locations and scene list (D-023, D-028, D-029) |
| `outline-ui.js` | The Outline window and `jumpToLine` (caret to a line, the line near the top of the editor, the preview following) (D-024) |
| `offline.js` | Registers `sw.js` and links the manifest, only when served over http(s) (`offlineState`) (D-026) |
| `safekeeping.js` | Asking the browser to keep the library (`navigator.storage.persist()`) once there is work to keep, and the line at the foot of the Library saying whether it agreed (D-027) |
| `main.js` | Start-up on `DOMContentLoaded` (asynchronous: the library loads first; `whenReady()`). Always last |

Rules: add a new file to `index.html` in the right place (`test/structure.test.js` fails if the folder and the page
disagree, if a name is declared twice across files, if an inline script or `<style>` comes back, or if a file passes 500 lines).
Keep each file's own listeners in that file. Functions the e2e tests call (`saveScript`, `setView`, `openTour`,
`syncElementState`, `flushSave`, `whenReady`, `whenSaved`, `restoreLastScript`, ...) must stay top-level function declarations, and `currentScriptId` a top-level
`let`: tests reach them as globals. Do not use ES modules (D-001).

## Conventions

- Vanilla JS, no frameworks. Modern syntax is fine (evergreen browsers).
- Classic `<script>` files, not ES modules (`file://` blocks module imports).
- The parser must never touch the DOM, `window` or Node-only APIs. Escape all user text before it reaches HTML.
- Match existing CSS variable names and class names (`script-*` for rendered screenplay elements).
- A new writer's choice goes in Settings (`settings.js`, `SETTING_DEFAULTS`), and a pure rule it changes takes it as
  an option (as `Editing.enter` / `autoCase` do), so the rule stays testable in Node.
- The editor's line height must stay a length (`1.6em`), never unitless, and anything copying the editor's text must use
  `copyEditorType` (layout.js): the colour hints only line up if the copies lay out exactly like the textarea (D-031).
- Scripts live in IndexedDB (database `plainchant`, stores `scripts` and `meta`). localStorage holds only
  `plainchant_onboarded` (the tour), `plainchant_emergency` (the buffer), `plainchant_paper` (Letter / A4),
  `plainchant_focus` (focus mode), `plainchant_keep_asked` (the browser said no to keeping the library, D-027) and
  `plainchant_settings` (the Settings switches that differ from their defaults, D-032). There is no legacy support and no
  localStorage fallback (D-020): this is not a production release, so storage names may change without a migration,
  but say so in DECISIONS when they do.
- Every storage write goes through `putScripts` / `saveScript` / `rememberCurrent` in `persistence.js`, never straight
  to IndexedDB or localStorage, so other tabs are told and the emergency buffer stays right.

## Running and testing

- App: open `index.html` directly in a browser, or serve the folder statically. Served over http(s) it also works
  offline and can be installed (service worker + manifest); from disk it needs no network either (local fonts).
  **Add a new file the page loads to `APP_FILES` in `sw.js`** (the structure test fails until you do).
- Tests: `npm run test:browser` (or `bash test/run-headless.sh`) on Linux/macOS, the owner's machine since
  2026-09-25 (Arch Linux). It runs the unit suite and the app e2e in headless Chromium/Chrome with a throwaway profile;
  `BROWSER=/path/to/chrome` picks the browser; exit code 0 = pass. On Windows: `npm run test:browser:windows`
  (`test/run-headless.ps1`, Edge/Chrome, nothing to install). Both run in real time, about 40 s: never add
  `--virtual-time-budget` back, IndexedDB does not work under it (D-019).
- Or open `test/index.html` (unit) / `test/app.e2e.html` (app, needs http or `--allow-file-access-from-files`) in a
  browser; a green banner means pass.
- `npm test` runs `test/run.js` under Node (unit suite only; needs Node 18+, developed on 24). If `node` is not
  found in a session that was already open when Node was installed, refresh PATH or restart the session.
- Never run a headless browser against `file://` pages with your real profile. See D-007.
- When you add a parser rule, add a test in `test/fountain.test.js` first. When you change app behaviour (restore,
  save, library), extend `test/app.e2e.html`. There, wait for `loaded(frame, go)` after any navigation, and read storage
  with `await stored()` / `await storedMeta()` (they wait for every frame's pending writes first).
