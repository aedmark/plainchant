# NeuroFountain Roadmap

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

- [ ] P2-01 Tab cycles the current line's element type (action, character, scene heading, transition)
- [ ] P2-02 Smart Enter: after a character line, move into dialogue; after dialogue, blank line + likely next element
- [ ] P2-03 Auto-uppercase scene headings, character cues and transitions as they are typed (non-destructive, undoable)
- [ ] P2-04 Autocomplete character names and scene locations from the script
- [x] P2-05 Mobile layout: single pane with a write/preview toggle, no fixed 50/50 split, keyboard-safe. Verified at
  375px in a headless browser; real-device keyboard behaviour is P2-09.
- [~] P2-06 Caret-anchored preview scroll (use the parser's `data-line` anchors instead of percentage sync). Done
  for opening Preview on mobile; continuous desktop sync still uses percentage.
- [ ] P2-07 Focus / typewriter mode (dim everything but the current block, keep the caret vertically centred)
- [ ] P2-08 Editor styling that hints at structure (subtle per-element colour) without becoming a WYSIWYG editor
- [ ] P2-09 Real-device pass for the mobile layout (iOS Safari and Android Chrome: keyboard vs. caret line, no
  zoom-on-focus, safe areas, rotation). Serve the folder over LAN with `python -m http.server`.
- [ ] P2-10 Tap a block in the mobile preview to jump to that line in the editor
- [ ] P2-11 On-screen element-cycle control for touch (there is no Tab key on a phone); pairs with P2-01

## Phase 3: Output and library

Goal: get finished work out of the app in industry-standard shapes, and manage many scripts.

- [ ] P3-01 Export `.fountain` (and keep `.txt`)
- [ ] P3-02 Import `.fountain` / `.txt` (file picker and drag-drop)
- [ ] P3-03 Print stylesheet and print-to-PDF at standard screenplay margins
- [ ] P3-04 Pagination (about 55 lines per page), page numbers, `(MORE)` / `(CONT'D)` handling
- [ ] P3-05 Title page rendering as its own page
- [ ] P3-06 Dual dialogue in print layout
- [ ] P3-07 Library management: rename, delete (with undo), duplicate, search
- [ ] P3-08 Final Draft `.fdx` export (stretch)

## Phase 4: Scale and polish

- [ ] P4-01 Incremental render: only re-render changed blocks; debounce; feature-length (120 page) performance budget
- [ ] P4-02 Offline: self-host fonts, service worker, installable PWA
- [ ] P4-03 Outline navigator (sections, synopses, scenes; click to jump)
- [ ] P4-04 Stats: page count, estimated runtime, scene count, per-character line counts
- [ ] P4-05 Version snapshots and restore
- [ ] P4-06 Themes and font-size controls; accessibility pass (keyboard, contrast, screen reader labels)
- [x] P4-07 Replace deprecated `document.execCommand('copy')` with the async Clipboard API (execCommand stays as the
  fallback for insecure origins)

## Phase 5: Sync and share (open questions)

Not committed. Decide only after Phase 3 ships. See open questions in DECISIONS.md.

- [ ] P5-01 File System Access API: open and save real files on disk
- [ ] P5-02 Optional cloud sync
- [ ] P5-03 Read-only share links / collaboration

## Known limitations (deliberate, revisit)

- Notes (`[[...]]`) that span several lines are not recognised; single-line notes are.
- The parser is spec-strict about uppercase: `cut to:` in lowercase is action until P2-03 auto-uppercases it.
