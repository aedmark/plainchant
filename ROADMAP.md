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
4. **Lightweight.** Static files, no build step, no runtime dependencies, works offline
5. **Responsive means usable.**

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
- [x] P2-07 Focus / typewriter mode (dim everything but the current block, keep the caret vertically centred) (D-025):
  veils over the textarea, the Focus toggle in the element bar and Ctrl/Cmd+Shift+F, remembered
- [x] P2-08 Editor styling that hints at structure (subtle per-element colour) without becoming a WYSIWYG editor
  (D-031: a coloured copy behind a transparent textarea)
- [x] P2-12 Tablet support (D-009): fix the preview being clipped below ~1110px wide, one pane below 1024px,
  inline actions from 700px, readable editor column, screenplay re-proportions by column width (container queries),
  touch-device viewport fitting. Verified at 640-1366px in a headless browser; real iPads are P2-09.
- [x] P2-10 Tap a block in the mobile preview to jump to that line in the editor (D-033: every line of a speech too)
- [x] P2-11 On-screen element control for touch (there is no Tab key on a phone): the element bar under the editor
  shows the current element and converts on tap, without dismissing the keyboard
- [x] P2-14 Suggest character cues without a Tab: after a blank line, a short unpunctuated line followed by Enter is
  probably a cue. Try it only if writers find the explicit Tab / Character step a chore (D-010 chose explicit)
  (D-036: known names in any case, new ones written with capitals; a Settings switch)
- [x] P2-15 Settings to switch off Enter-after-action-makes-a-paragraph and auto-uppercase for writers who dislike them
  (D-032: those two and the colour hints, from a gear beside Help)
- [x] P2-16 Keep the caret line comfortably above the on-screen keyboard while typing in a long script (D-030: three
  lines of room, on touch devices and narrow windows)
- [x] P2-17 Welcome tour: four skippable steps on first launch, device-aware wording, live-rendered sample, ends
  with Start writing / Open the example script; replayable from Help (D-011)
- [x] P2-18 Help window: Start here, Screenplay elements cheat sheet (every example verified against the parser),
  Keys & touch, Troubleshooting. Opens from ?, the phone menu, F1, Ctrl/Cmd+/, and the element bar's ?
- [x] P2-19 Shared accessible dialog helper (labelled, focus trap, Esc, backdrop, focus return) for Library, Help
  and the tour; Library items are keyboard-operable
- [ ] P2-20 Contextual first-use hints (for example, the first time a writer types an UPPERCASE line, or first
  presses Tab), if the tour and Help prove not to be enough. Watch how new users actually get stuck first.
- [x] P2-21 Autocomplete follow-ups, if wanted after the writer has tried P2-04: suggest the time of day after
  `INT. PLACE - ` (DAY, NIGHT, plus any already used); offer names on an empty cue line after Character is chosen;
  announce suggestions to screen readers. (D-037: all three; names on an empty line are for tapping, Tab keeps cycling)
- [x] P2-23 Desktop: the editor alone, the preview alone, or both (the owner's request, 2026-09-28) (done, D-056: three
  buttons in the preview's header, moving to the editor's while the preview is hidden; Ctrl/Cmd+Shift+1 / 2 / 3)
- [x] P2-24 Quick edits in the preview (the owner's idea, 2026-09-28): touch up a paragraph without going back to the
  text (done, D-057: double-click, or press and hold on touch, opens the paragraph's own Fountain lines in a box over
  it, in the preview and in page view; Enter or clicking away keeps it as one undoable edit, Esc leaves it)

## Phase 3: Output and library

Goal: get finished work out of the app in industry-standard shapes, and manage many scripts.

- [x] P3-01 Export as `.fountain`, named after the script's title (D-015). There is no separate `.txt` option: a
  `.fountain` file is plain text and any editor opens it. Add a choice only if someone asks (P3-10).
- [ ] P3-10 Export choices, if wanted: `.txt`, and exporting a script straight from its Library row (PDF is done: the
  Export dialog, D-022)
- [x] P3-02 Import `.fountain` / `.txt` / `.md` (the Library's `Import a file...` picker, and drag-drop anywhere on the page). Each file
  becomes a new script and the first opens; nothing is overwritten (D-016). Final Draft `.fdx` import is P3-08.
- [x] P3-03 Print stylesheet and print-to-PDF at standard screenplay margins (spec: docs/devlog/SPEC-PRINT.md, D-021, D-022):
  in the Export dialog (with the paper choice and page count), `beforeprint` so Ctrl/Cmd+P prints the screenplay,
  Letter / A4, Help on saving as PDF. The preview now matches paper (plain headings, transitions flush right)
- [x] P3-04 Pagination (about 55 lines per page), page numbers, `(MORE)` / `(CONT'D)` handling: `src/paginate.js`, a
  pure module on the Courier character grid, plus `Fountain.runs` (spec §4-§7). Also lays out the title page (P3-05)
  and dual dialogue (P3-06); nothing prints until P3-03
- [x] P3-05 Title page rendering as its own page (unnumbered, not counted; spec §6)
- [x] P3-06 Dual dialogue in print layout (side by side, never split)
- [ ] P3-11 Direct `.pdf` download: a hand-written PDF writer (`src/pdf.js`) with PDF's built-in Courier fonts, fed by
  the same page layout (spec §8b).
- [x] P3-12 Page view in the preview: the paginated sheets, page numbers and breaks while writing (spec §8c) (done,
  D-054: a Page view switch in the preview's header; the sheets printing draws, scaled to the pane)
- [x] P3-07 Library management: search, rename (rewrites the script's own `Title:` line), duplicate, delete with
  Undo and a 30-day Recently deleted, restore, delete forever (two clicks) (D-013)
- [ ] P3-09 Library extras, if wanted: sort options (name, date created), multi-select, export a single script
  from its row, and a storage-usage indicator (`navigator.storage.estimate()`; Recently deleted holds space)
- [x] P3-08 Final Draft `.fdx` export (stretch) (done, D-049: Export > Download .fdx; every printed element, scene
  numbers, dual dialogue, page breaks, emphasis and the title page)
- [ ] P3-14 Final Draft `.fdx` import, if wanted: read a .fdx into a new script (the reverse of P3-08's mapping; today
  Import refuses .fdx and says to export it as Fountain)
- [x] P3-13 Video chapters: YouTube timestamps from the script's top-level sections, timed by narration (P4-18),
  with Copy, in the Export dialog; says which of YouTube's rules a list breaks (at least three, ten seconds each) (D-038)

## Phase 4: Scale and polish

- [x] P4-01 Incremental render: only re-render changed blocks; debounce; feature-length (120 page) performance budget
  (done, D-043: the preview patched block by block; on long scripts it follows just after the paint; a typed
  character on 162 pages went from about 116 ms to about 30; budget: under 60 ms on 120 pages, in the e2e suite)
- [x] P4-02 Offline: self-host fonts, service worker, installable PWA (D-026): fonts in `fonts/`, `sw.js` and
  `manifest.webmanifest` when served over http(s), placeholder icons in `icons/`
- [x] P4-03 Outline navigator (sections, synopses, scenes; click to jump) (D-024): an Outline window from the
  preview's header, with scene numbers, pages, a filter, and a jump that puts the line near the top of the editor
- [x] P4-04 Stats: page count, estimated runtime, scene count, per-character line counts (D-023): a live page count
  in the preview's header opens Script stats (pages as printed, screen time, scenes, words, speeches and words per
  character with their share)
- [x] P4-05 Version snapshots and restore (D-034: kept by the saves themselves, thinned with age, named ones kept;
  a Versions window from the Library)
- [x] P4-06 Themes and font-size controls; accessibility pass (keyboard, contrast, screen reader labels) (D-035: dark,
  light or the system's; four text sizes; an automated sweep in the tests. A real screen reader pass is still to do)
- [x] P4-08 Split the inline app script in `index.html` (~925 lines) into eleven classic script files under
  `src/app/`, one per concern (D-014). Behaviour-neutral: every original line moved exactly once (checked), all
  319 e2e checks unchanged. `test/structure.test.js` guards the structure.
- [x] P4-09 Moved the inline stylesheet (~680 lines) out of `index.html` into `src/styles.css`, linked from the page.
  Byte-for-byte the same rules (de-indented); `test/structure.test.js` fails if an inline `<style>` returns.
- [x] P4-07 Replace deprecated `document.execCommand('copy')` with the async Clipboard API (execCommand stays as the
  fallback for insecure origins)
- [x] P4-10 Migrate storage from localStorage to IndexedDB (spec: docs/devlog/SPEC-INDEXEDDB.md, D-018, D-019). Per-script
  records in an object store (`src/store.js`), the in-memory library object kept as the working model, a synchronous
  localStorage "emergency buffer" for the pagehide race, and a one-time idempotent migration that keeps the
  localStorage copy as a fallback. Other tabs are told of changes (BroadcastChannel); no IndexedDB means the old
  localStorage behaviour. Fixes the 5 MB cap and the whole-library rewrite on every autosave. The headless runners now
  run in real time (`test/run-headless.sh` added for Linux/macOS).
- [x] P4-11 Remove the legacy `frictionless_scripts` / `frictionless_current` localStorage copy (D-018 step 4). Done
  sooner and further than planned (D-020): no migration, no localStorage fallback, `plainchant_*` keys.
- [x] P4-12 Ask for persistent storage (`navigator.storage.persist()`) so the browser does not evict the library under
  disk pressure; pairs with P4-02 (installed PWAs are granted it more readily) (done, D-027: asked once there is
  work, not again after a no unless installed; the Library says where things stand)
- [x] P4-13 Stats, per scene: each scene's length in pages (in eighths, the production convention), its speaking
  characters, and a list to jump from. Builds on `src/stats.js` and the print layout (D-023); pairs with P4-03 (done, D-028: in the Script stats window)
- [x] P4-14 Stats, scene mix: INT / EXT and DAY / NIGHT counts (and other times of day) read from the scene headings (done, D-029)
- [x] P4-15 Stats, locations: each distinct location (the heading without INT./EXT. and the time of day), with how
  many scenes and pages it takes (done, D-029)
- [x] P4-16 Versions, if wanted: compare a version with the text now (what changed, scene by scene) before going
  back, and take one scene from a version rather than the whole script (done, D-044: a version's Compare in the
  Versions window; Use the version's scene / Put back scene, undoable)
- [x] P4-17 Accessibility by a person: NVDA / Orca / TalkBack reading order and wording, Windows high-contrast
  mode, keyboard-only use for a whole session. The automated sweep (D-035) checks names and contrast only (done: the owner checked it with a screen reader, 2026-09-27)
- [x] P4-18 Narration time: how long the script takes to read aloud (dialogue, or dialogue and action), at a reading
  speed set in Settings, as a tile in Script stats (D-038)
- [x] P4-21 A narration example script to show P4-18 / P3-13 at work: a short narrated video essay whose notes say
  what is read aloud and what makes a chapter; from Help, and from Export's Video chapters when a script has none
- [x] P4-19 A retro adventure-game theme: a third theme in Settings beside dark and light, after the 16-colour palette
  of 1980s PC adventure games, softened where the pure colours fail the contrast sweep (D-035: 4.5:1 for text in
  every state). A new token set under `:root[data-theme="retro"]`; the preview stays paper (done, D-041: "Retro (16
  colours)" in Settings, white and yellow on EGA blue, square corners, double-bordered dialogs; then CGA, D-047:
  "Retro (CGA)", cyan, magenta and white on black; D-048: pure palette 1, no yellow)
- [x] P4-20 Small touches, if wanted: a playful reply when an old adventure-game command (`LOOK`, `INVENTORY`) is typed
  on a line of its own, never getting in the way of real text (a cue named LOOK must still work) (done, D-042: in the
  retro theme only, as the notice; the thank-you in Help is now P4-22)
- [x] P4-22 A thank-you in Help to the creator whose videos prompted P4-18 / P3-13 / P4-19 / P4-20, **only with their
  permission** to use their name (split from P4-20) (done, D-045: permission given; a line at the foot of Help > Start here)

## Phase 5: Sync and share (open questions)

Not committed. Decide only after Phase 3 ships. See open questions in DECISIONS.md.

- [x] P5-01 File System Access API: open and save real files on disk (done, D-046: Chromium browsers only; Library >
  Open a file, Export > Sync with a file (D-052); every save writes the file, changes made elsewhere are loaded, a bar asks
  when both changed; Firefox keeps Import and the download)
- [ ] P5-04 Real files, if wanted: tell other open tabs about a new link at once (today a tab learns of it when
  reloaded), and show the linked file's name on the script's row in the Library
- [ ] P5-02 Optional cloud sync
- [ ] P5-03 Read-only share links / collaboration

## Known limitations (deliberate, revisit)

- Notes (`[[...]]`) that span several lines are not recognised; single-line notes are.
- The parser is spec-strict about uppercase (D-004); the editor covers for it: `cut to:` and `int. ...` are
  uppercased as typed (P2-03), cues are set with Tab / the Character button or guessed on Enter (P2-14). Text pasted
  in or typed outside the app in lowercase is still action.
- The editor shows colours only: `*italic*` and `**bold**` are not shown until the preview (weights and slants would
  break the colour layer's alignment, D-031). If a browser wraps the layer differently, the colours switch themselves
  off for that visit.
- Name guessing (D-036) takes a short Title Case line without a full stop ("Silence") for a new character. Undo takes
  it back; Settings switches guessing off.
- Printing goes through the browser's print window (D-021); a direct `.pdf` download was dropped (P3-11, D-050).
- The preview is always white paper, whatever the theme (D-035).
- Narration time (D-038) counts words only: pauses, music and footage with no narration are not timed, so chapter
  timestamps are a starting point to check against the finished video.
