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
| Desktop wrapper | `src-tauri/` | `tauri.conf.json` | `app.html` (see Claims vs. code) |

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
- **Two media-query pairs move together** (the one-pane CSS block and `MOBILE_QUERY`; the fixed-body rule and
  `FIT_QUERY`). Enforced by: nothing (D-008, D-009).
- **Emptying the editor does not overwrite the saved script** (D-006) and **a script is never lost** (ROADMAP
  principle 3). Enforced by: storage-rule unit tests and the e2e restore and emergency-buffer sections.

## Boundaries

| Boundary | Comes in as | Checked by | Rule |
| --- | --- | --- | --- |
| The writer's text | a string | `escapeHTML` in `fountain.js` | escaped before it reaches HTML; the only other `innerHTML` writes are `core.js` (parser output) and `tour.js` (static text) |
| Imported files | bytes | `src/importing.js` | accepted types only; decoded (UTF-8/16, Windows-1252); each file becomes a new script, nothing is overwritten (D-016) |
| Linked real files | File System Access handles (Chromium) | `FileSync.decide` | never written over a change made elsewhere (D-046) |
| Another tab | storage events | `persistence.js` | told of every write |
| The network | nothing | `test/structure.test.js` | the app loads nothing from it, fonts included (D-026) |

## Dependencies

None at runtime (D-001). Courier Prime and Inter are bundled as `woff2` under their OFL licences in `fonts/`. Dev
tooling: Node 18+ for `npm test`, headless Chromium or Chrome for the browser suite, Python 3 for `tools/check_docs.py`.
The `src-tauri/` Rust crate is described under Claims vs. code. A new dependency needs the owner's approval and a
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

## Claims vs. code

- **`src-tauri/` has no decision record.** It carries a Tauri 2 desktop wrapper (`tauri.conf.json`, `main.rs`) added
  in the "Website" commit `cf871d3`; `npm run tauri:dev` and `tauri:build` point at it. No document says it is a
  supported target, its `app.security.csp` is `null`, and `withGlobalTauri` is on. Tracked as P8-12.
- **`CLAUDE.md` is now a pointer.** Older session-log entries and DECISIONS entries say "CLAUDE.md" where the rule now
  lives in `AGENTS.md`; they are history and are not rewritten.
