# Plainchant Roadmap

A lightweight, responsive screenwriting app that takes formatting out of the writer's way. The writer types plain
text; the app handles structure, layout and output.

This file is the **plan**. For *where we are right now* read [docs/HANDOFF.md](docs/HANDOFF.md). For *why we chose
things* read [docs/DECISIONS.md](docs/DECISIONS.md).

## Principles

These break ties when a feature is debatable.

1. **Text is the source of truth.** Scripts are plain [Fountain](https://fountain.io) text. No proprietary format, no
   lock-in. Anything the app knows about a script must be derivable from that text.
2. **Never make the writer think about format.** If a feature asks the writer to pick, click or configure formatting
   while drafting, it belongs behind a shortcut or an automatic rule, or it doesn't ship.
3. **Never lose words.** Autosave, restore on reload, save on tab hide. Data loss outranks every other bug.
4. **Lightweight.** Static files, no build step, no runtime dependencies, works offline, opens fast on a phone.
5. **Responsive means usable, not just shrunk.** The phone experience is designed for a phone.

## Status legend

`[ ]` not started · `[~]` in progress · `[x]` done · `[-]` dropped (say why in DECISIONS.md)

Every item has a stable ID (`P1-03`). Reference IDs in commits and in HANDOFF.md. Never renumber; append new items.

---

## Phase 0: Prototype (done)

- [x] P0-01 Two-pane editor: raw text left, live screenplay render right, stacks on narrow screens
- [x] P0-02 Heuristic line parser (scene headings, characters, dialogue, transitions)
- [x] P0-03 localStorage library, 2 s autosave, `.txt` export, copy

## Phase 1: Reliable core

Goal: a script is never lost, and the parser follows the Fountain spec so behaviour is predictable and testable.

- [x] P1-01 Roadmap, handoff docs and `CLAUDE.md` session protocol
- [x] P1-02 Restore the last-open script on load
- [x] P1-03 "New" script action (required once restore exists)
- [x] P1-04 Flush save on tab hide / page unload so the last 2 s of typing survive
- [x] P1-05 Fix scroll-sync divide-by-zero when a pane does not scroll
- [x] P1-06 Fountain parser as its own module (`src/fountain.js`), pure, no DOM, UMD
- [x] P1-07 Parser coverage: scene headings (incl. forced, scene numbers), action (incl. forced), character (incl.
  forced `@`, extensions, dual `^`), parenthetical, dialogue, transitions (incl. forced `>`), centered text, lyrics,
  sections, synopses, page breaks, notes, boneyard, title page, emphasis
- [x] P1-08 Parser test suite runnable in the browser and in Node (45 tests; verified in headless Edge and under
  Node 24 via `npm test`)
- [x] P1-09 `.gitignore`, package scripts
- [x] P1-10 App end-to-end test (`test/app.e2e.html`) and a dependency-free headless runner
  (`test/run-headless.ps1`, uses Edge/Chrome in a throwaway profile)

## Phase 2: Frictionless typing

Goal: the "just type" promise. The editor helps; it never interrupts.

- [x] P2-01 Tab cycles the current line's element type (action, character, scene heading, transition); inside
  dialogue it toggles dialogue / parenthetical. Verified in a headless browser; real keyboards are P2-09.
- [x] P2-02 Smart Enter: after a character line or parenthetical, move into dialogue; otherwise a blank line.
  Shift+Enter is a plain line break. (Changes what Enter does after action: D-010.)
- [x] P2-03 Auto-uppercase scene headings, character cues and transitions as they are typed (undoable). Scene
  prefixes and `... to:` are automatic; cues need Tab / the Character button first (D-010).
- [x] P2-04 Autocomplete character names and scene locations from the script (D-017). Chips in the element bar; Tab
  takes the first, Enter never does. Time of day is not suggested; not seen on a real device or with a screen reader.
- [x] P2-05 Mobile layout: single pane with a write/preview toggle, no fixed 50/50 split, keyboard-safe. Verified at
  375px in a headless browser; real-device keyboard behaviour is P2-09.
- [~] P2-06 Caret-anchored preview scroll (use the parser's `data-line` anchors instead of percentage sync). Done
  for opening Preview on mobile; continuous desktop sync still uses percentage.
- [ ] P2-07 Focus / typewriter mode (dim everything but the current block, keep the caret vertically centred)
- [ ] P2-08 Editor styling that hints at structure (subtle per-element colour) without becoming a WYSIWYG editor
- [~] P2-09 Real-device pass for the mobile and tablet layouts (iPad and iPhone Safari, Android Chrome: keyboard vs.
  caret line, no zoom-on-focus, safe areas, rotation, iPad Split View / Stage Manager window sizes, hardware
  keyboard attached). Serve the folder over LAN with `python -m http.server`. The user reported (2026-09-20) that
  everything was functional on their tablet and other devices, before the typing helpers' soft-keyboard details or
  the tour/help were looked at in particular; specifics (which devices, Split View, Pencil) were not recorded.
- [x] P2-12 Tablet support (D-009): fix the preview being clipped below ~1110px wide, one pane below 1024px,
  inline actions from 700px, readable editor column, screenplay re-proportions by column width (container queries),
  touch-device viewport fitting. Verified at 640-1366px in a headless browser; real iPads are P2-09.
- [ ] P2-13 Tablet input: check Apple Pencil handwriting (Scribble) and hardware-keyboard shortcuts in the editor;
  decide whether tablets in landscape want the preview to follow the caret continuously (P2-06)
- [ ] P2-10 Tap a block in the mobile preview to jump to that line in the editor
- [x] P2-11 On-screen element control for touch (there is no Tab key on a phone): the element bar under the editor
  shows the current element and converts on tap, without dismissing the keyboard
- [ ] P2-14 Suggest character cues without a Tab: after a blank line, a short unpunctuated line followed by Enter is
  probably a cue. Try it only if writers find the explicit Tab / Character step a chore (D-010 chose explicit)
- [ ] P2-15 Settings to switch off Enter-after-action-makes-a-paragraph and auto-uppercase for writers who dislike them
- [ ] P2-16 Keep the caret line comfortably above the on-screen keyboard while typing in a long script
- [x] P2-17 Welcome tour: four skippable steps on first launch, device-aware wording, live-rendered sample, ends
  with Start writing / Open the example script; replayable from Help (D-011)
- [x] P2-18 Help window: Start here, Screenplay elements cheat sheet (every example verified against the parser),
  Keys & touch, Troubleshooting. Opens from ?, the phone menu, F1, Ctrl/Cmd+/, and the element bar's ?
- [x] P2-19 Shared accessible dialog helper (labelled, focus trap, Esc, backdrop, focus return) for Library, Help
  and the tour; Library items are keyboard-operable
- [ ] P2-20 Contextual first-use hints (for example, the first time a writer types an UPPERCASE line, or first
  presses Tab), if the tour and Help prove not to be enough. Watch how new users actually get stuck first.
- [ ] P2-21 Autocomplete follow-ups, if wanted after the writer has tried P2-04: suggest the time of day after
  `INT. PLACE - ` (DAY, NIGHT, plus any already used); offer names on an empty cue line after Character is chosen;
  announce suggestions to screen readers.

## Phase 3: Output and library

Goal: get finished work out of the app in industry-standard shapes, and manage many scripts.

- [x] P3-01 Export as `.fountain`, named after the script's title (D-015). There is no separate `.txt` option: a
  `.fountain` file is plain text and any editor opens it. Add a choice only if someone asks (P3-10).
- [ ] P3-10 Export choices, if wanted: `.txt`, PDF (P3-03), and exporting a script straight from its Library row
- [x] P3-02 Import `.fountain` / `.txt` / `.md` (the Library's `Import a file...` picker, and drag-drop anywhere on the page). Each file
  becomes a new script and the first opens; nothing is overwritten (D-016). Final Draft `.fdx` import is P3-08.
- [ ] P3-03 Print stylesheet and print-to-PDF at standard screenplay margins
- [ ] P3-04 Pagination (about 55 lines per page), page numbers, `(MORE)` / `(CONT'D)` handling
- [ ] P3-05 Title page rendering as its own page
- [ ] P3-06 Dual dialogue in print layout
- [x] P3-07 Library management: search, rename (rewrites the script's own `Title:` line), duplicate, delete with
  Undo and a 30-day Recently deleted, restore, delete forever (two clicks) (D-013)
- [ ] P3-09 Library extras, if wanted: sort options (name, date created), multi-select, export a single script
  from its row, and a storage-usage indicator (localStorage is about 5 MB and Recently deleted holds space)
- [ ] P3-08 Final Draft `.fdx` export (stretch)

## Phase 4: Scale and polish

- [ ] P4-01 Incremental render: only re-render changed blocks; debounce; feature-length (120 page) performance budget
- [ ] P4-02 Offline: self-host fonts, service worker, installable PWA
- [ ] P4-03 Outline navigator (sections, synopses, scenes; click to jump)
- [ ] P4-04 Stats: page count, estimated runtime, scene count, per-character line counts
- [ ] P4-05 Version snapshots and restore
- [ ] P4-06 Themes and font-size controls; accessibility pass (keyboard, contrast, screen reader labels)
- [x] P4-08 Split the inline app script in `index.html` (~925 lines) into eleven classic script files under
  `src/app/`, one per concern (D-014). Behaviour-neutral: every original line moved exactly once (checked), all
  319 e2e checks unchanged. `test/structure.test.js` guards the structure.
- [x] P4-09 Moved the inline stylesheet (~680 lines) out of `index.html` into `src/styles.css`, linked from the page.
  Byte-for-byte the same rules (de-indented); `test/structure.test.js` fails if an inline `<style>` returns.
- [x] P4-07 Replace deprecated `document.execCommand('copy')` with the async Clipboard API (execCommand stays as the
  fallback for insecure origins)
- [ ] P4-10 Migrate storage from localStorage to IndexedDB (spec: docs/SPEC-INDEXEDDB.md, D-018). Per-script records
  in an object store, the in-memory library object kept as the working model, a synchronous localStorage "emergency
  buffer" for the pagehide race, and a one-time idempotent migration that keeps the localStorage copy as a fallback.
  Fixes the 5 MB cap and the whole-library rewrite on every autosave.

## Phase 5: Sync and share (open questions)

Not committed. Decide only after Phase 3 ships. See open questions in DECISIONS.md.

- [ ] P5-01 File System Access API: open and save real files on disk
- [ ] P5-02 Optional cloud sync
- [ ] P5-03 Read-only share links / collaboration

## Phase 6: Brand (owner follow-ups after the rename, D-012)

- [x] P6-00 Choose and apply the name: Plainchant
- [ ] P6-01 Confirm and register a domain (`plainchant.app` / `.io` showed no DNS answer; `.com` and `.co` are taken)
- [ ] P6-02 Proper trademark search for "Plainchant" in software classes before investing in the brand
- [ ] P6-03 Wordmark and icon (a page with fold lines was floated; plainchant notation is another source of shapes),
  favicon, and a web-app manifest icon once P4-02 (PWA) happens
- [x] P6-04 Rename the GitHub repository to `plainchant`, point `origin` at it, push, and move the project to a
  `plainchant` folder (done 2026-09-20 by the owner: renamed on GitHub, re-cloned; fresh clone verified, all tests pass)

## Known limitations (deliberate, revisit)

- Notes (`[[...]]`) that span several lines are not recognised; single-line notes are.
- The parser is spec-strict about uppercase (D-004); the editor covers for it: `cut to:` and `int. ...` are
  uppercased as typed (P2-03), and other cues are set with Tab / the Character button. Text pasted in or typed
  outside the app in lowercase is still action.
