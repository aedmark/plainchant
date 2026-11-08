# Architecture

How Plainchant fits together, for a session that has never seen it. This is the map, not the territory: it names the
parts and the rules between them. The file-by-file tables are in [AGENTS.md](../AGENTS.md) ("Layout", "App scripts");
why things are this way is in [DECISIONS.md](DECISIONS.md). Update this file when the shape changes (a module added,
moved or merged), not for every change inside one.

## The shape, in one paragraph

The browser loads `app.html`, which links `src/styles.css` and the classic scripts in `src/` and `src/app/`. The writer
types Fountain text into a textarea. `render()` (`src/app/core.js`) parses it once with `Fountain` and feeds that parse to
the preview (patched block by block, `drawPreview`, or drawn as paper sheets, `drawPages`), to the colour hints behind
the textarea (`shade.js`) and to the stats and the outline. Saves go through `persistence.js` into IndexedDB (database
`plainchant`), with a localStorage emergency buffer for a tab closed mid-write. Print, `.fountain` and `.fdx` export and
linked files on disk all work from the same text. Nothing leaves the device and the app loads nothing from the network
(D-001, D-026).

## Code map

| Area | Where | Entry point | Talks to |
| --- | --- | --- | --- |
| Parser and renderer | `src/fountain.js` | `Fountain.toHTML`, `blocks`, `classifyLines`, `shade` | nothing (pure, no DOM) |
| Typing and autocomplete rules | `src/editing.js`, `src/suggest.js` | `Editing.enter`, `Suggest.at` | `Fountain` |
| Library, import, versions, compare, find, file-sync rules | `src/library.js`, `importing.js`, `versions.js`, `compare.js`, `finding.js`, `filesync.js` | one pure module each | scripts object in, new object out |
| Pagination, stats, outline, narration, FDX | `src/paginate.js`, `stats.js`, `outline.js`, `narration.js`, `fdx.js` | `Paginate`, `Stats.collect`, `Outline.build`, `Narration`, `Fdx` | `Fountain`, `Paginate` |
| Storage | `src/store.js` | `Store` (rules plus thin IndexedDB calls) | IndexedDB, passed in as an argument |
| The app | `src/app/*.js` | `main.js` on `DOMContentLoaded` | every module above, one global scope (D-014) |
| Offline and install | `sw.js`, `manifest.webmanifest`, `src/app/offline.js` | `APP_FILES` | the Cache API, only over http(s) |
| Desktop shell (how local builds are distributed, D-070) | `src-tauri/` | `main.rs`, `tauri.conf.json` | `app.html`; five Rust commands for native file dialogs and real paths |

## Interfaces and data flow

```text
keystroke -> typing.js (Editing rules, applyEdit) -> textarea -> render() -> one Fountain parse
   -> drawPreview / drawPages, shade.js, stats, outline, drawer
textarea -> saveScript / putScripts (persistence.js) -> Store -> IndexedDB (+ emergency buffer, other tabs told)
text -> Paginate -> print sheets;  text -> Fdx / canon -> download or a linked real file (FileSync.decide first)
```

| Interface | Producer | Consumer | Contract |
| --- | --- | --- | --- |
| Fountain text | the textarea, imports, linked files | every module | the only source of truth (D-002); anything the app knows is derivable from it |
| `plainchant` IndexedDB, version 3 | `persistence.js`, `versions-ui.js`, `files-ui.js` | the same | stores `scripts`, `meta`, `versions`, `files`; storage names may change without a migration while this is not a production release (D-020) |
| `plainchant_settings` etc. (localStorage) | `settings.js` and others | the same | holds only what differs from defaults; the full key list is in AGENTS.md "Conventions" |
| Pure modules | `src/*.js` | `src/app/*.js`, tests | UMD, no DOM, no `window`; text in, result out (D-003) |

## Invariants

Each names what enforces it; "nothing yet" marks a candidate for a test or a roadmap item.

- **The parser and the pure modules never touch the DOM, `window` or Node-only APIs.** Enforced by: the unit suite runs
  them under Node (`npm test`); nothing checks the rule directly.
- **Every storage write goes through `putScripts` / `saveScript` / `rememberCurrent`**, except `versions-ui.js` and
  `files-ui.js` through `Store`. Enforced by: nothing yet. A linked file is only written through `syncFile` /
  `writeLinkedFile`, after `FileSync.decide` says so (D-046).
- **Nothing writes the preview (`#page`) but `drawPreview`, nor the page view (`#sheets`) but `drawPages`.** Enforced by:
  nothing; `drawPreview` restarts from scratch if its element count stops matching (D-043, D-054).
- **No ES modules, no inline script or `<style>`, no name declared twice across `src/app/` files, no file over 500
  lines, no file named like a tracker, nothing loaded from another host, `APP_FILES` matches what the page loads.**
  Enforced by: `test/structure.test.js` (D-014, D-026, D-055).
- **The editor's copies lay out exactly like the textarea**: a length line height (`1.6em`), `copyEditorType`. Enforced
  by: the wrap check in `shade.js`, which switches the hints off if they drift (D-031, D-065).
- **A user-visible edit never assigns `editor.value`**; it goes through `applyEdit()` so undo survives. Enforced by: e2e
  undo checks for the main helpers; nothing for a new one.
- **Chrome colours are tokens in all three theme sets.** Enforced by: the e2e accessibility sweep (section 16o), 4.5:1
  in every theme (D-035, D-041).
- **The desktop shell's commands touch only dialog-picked paths, and the page loads only its own files** (D-071). Enforced by: four Rust unit tests (`npm run tauri:test`) and the window's CSP for the page; the structure test for the web files. The owner has run the real window (2026-11-08, "works fine", not itemised).
- **Two media-query pairs move together** (the one-pane CSS block and `MOBILE_QUERY`; the fixed-body rule and
  `FIT_QUERY`). Enforced by: nothing (D-008, D-009).
- **Emptying the editor does not overwrite the saved script** (D-006) and **a script is never lost** (ROADMAP
  principle 3). Enforced by: storage-rule unit tests and the e2e restore and emergency-buffer sections.

## Boundaries

| Boundary | Comes in as | Checked by | Rule |
| --- | --- | --- | --- |
| The writer's text | a string | `escapeHTML` in `fountain.js` | escaped before it reaches HTML; the only other `innerHTML` writes are `core.js` (parser output) and `tour.js` (static text) |
| Imported files | bytes | `src/importing.js` | accepted types only; decoded (UTF-8/16, Windows-1252); each file becomes a new script, nothing is overwritten (D-016) |
| Linked real files | File System Access handles (Chromium), or the shell's `read_script_file` / `write_script_file` with a path | `FileSync.decide` | never written over a change made elsewhere (D-046); the shell's commands accept only a path the writer picked in a native dialog (D-071) |
| Another tab | storage events | `persistence.js` | told of every write |
| The network | nothing | `test/structure.test.js` | the app loads nothing from it, fonts included (D-026) |

## Dependencies

None at runtime (D-001). Courier Prime and Inter are bundled as `woff2` under their OFL licences in `fonts/`. Dev
tooling: Node 18+ for `npm test`, headless Chromium or Chrome for the browser suite, Python 3 for `tools/check_docs.py`.
The `src-tauri/` shell (D-070) has its own build-time dependencies, outside the web app's rule: `tauri` 2, `serde`,
`serde_json`, `rfd` 0.15, pinned by `src-tauri/Cargo.lock`. A new dependency needs the owner's approval and a
decision record.

## State and caches

| What | Where | Written by | Reset by | Committed? |
| --- | --- | --- | --- | --- |
| Scripts, versions, file links | IndexedDB `plainchant` | `persistence.js`, `versions-ui.js`, `files-ui.js` | the browser's site data; the 30-day trash purge | no |
| Emergency buffer, tour flag, paper, focus, keep-asked, settings | localStorage `plainchant_*` | `persistence.js`, `settings.js` and others | site data | no |
| Offline copy of the app | the Cache API (`CACHE` in `sw.js`) | the service worker | bump `CACHE` when a file is removed or renamed | no |
| Test profiles | a throwaway profile directory | `test/run-headless.sh` | deleted each run (D-007) | no |

## Failure modes

| Failure | What the writer sees | Detection | Recovery |
| --- | --- | --- | --- |
| IndexedDB unavailable | a notice that nothing is being kept | `persistence.js` start-up | the emergency buffer holds the text; export it |
| Tab closed mid-write | the text back on reopen | emergency buffer reconcile (D-019) | automatic |
| Two tabs, one upgrades the database | the older tab loses its database | none yet (HANDOFF) | reload the older tab |
| Colour hints misalign | colours switch off, a notice says so | the wrap check in `shade.js` | re-enabled by the setting (D-065) |
| A linked file changed elsewhere | a bar: Load the file / Keep the script here | `FileSync.decide` | the writer chooses (D-046) |
| The browser refuses to keep storage | a line at the foot of the Library | `navigator.storage.persist()` result | export `.fountain` files (D-027) |

## Working rules for app code and storage

Traps already hit, moved here from HANDOFF's gotchas (2026-11-08). Test pitfalls are in [TESTING.md](TESTING.md).

### App code
- The app is classic scripts in `src/app/` sharing one global scope (AGENTS.md "App scripts", D-014). Functions the e2e
  calls stay top-level declarations: `fitToViewport`, `setView`, `setMenu`, `syncElementState`, `buildPrintPages`,
  `printScript` and the others listed in AGENTS.md. Header comments are optional; no test looks for them (D-059).
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

### Storage
- The library is the in-memory `library` in `persistence.js`; `putScripts(next)` stores the difference. Never write to
  IndexedDB or localStorage directly (other tabs would not be told; the emergency buffer would go wrong); the
  exceptions are `versions-ui.js` and `files-ui.js`, through `Store`. The global is `Store`, never `Storage`. Each
  IndexedDB write creates its transaction synchronously: no `await` in front of one (D-019).
- No legacy support (D-020): the old `frictionless_*` keys are dead. Storage names may change without a migration
  while this is not a production release; record it in DECISIONS.
- Versions are saved inside `Store.saveScript`'s own transaction when `Versions.due` says so; the e2e stubs the frame's
  `Date.now` to reach "ten minutes later".

## Claims vs. code

- **The shell's CSP and path rule (D-071) are checked in pieces.** The path rule has Rust unit tests; the CSP was tried
  against `app.html` in headless Chrome, not in a Tauri window, and nothing has driven a linked file through the IPC
  bridge since the change.
- **`CLAUDE.md` is now a pointer.** Older session-log entries and DECISIONS entries say "CLAUDE.md" where the rule now
  lives in `AGENTS.md`; they are history and are not rewritten.
