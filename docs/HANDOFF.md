# Session Handoff

Read this first. It is rewritten at the end of every session so the top half is always true *right now*.
The session log below it is append-only history.

Protocol: see [CLAUDE.md](../CLAUDE.md). Plan: [ROADMAP.md](../ROADMAP.md). Decisions: [DECISIONS.md](DECISIONS.md).

---

## Current state

_Last updated: 2026-09-21, session 10 (autocomplete done; PDF printing is next, as a spec only)._

**What works**
- **Import** (D-016, `src/importing.js` + `src/app/import.js`). The Library's `Import a file...` button, or drop a file
  anywhere on the page. `.fountain` / `.txt` / `.md` (any UTF-8 / UTF-16 / Windows-1252 text) become NEW scripts, the
  first opens, nothing is overwritten; `.fdx` / PDF / Word are refused with a reason. Messages show in `#notice`.
  Untested on a real file manager drag or on iOS / Android pickers.
- **Library management** (D-013, `src/library.js` + the Library dialog). Search (titles and text), **rename** (rewrites
  the script's own `Title:` line), **duplicate** ("<title> (copy)"), **delete** with an Undo message, and a
  **Recently deleted** tab (30 days, then removed for good) with Restore and a two-click Delete forever / Delete all
  forever. Rows show when a script was last edited and its word count, and a preview that skips the title page.
  Deleting the open script leaves a blank page. Nothing can resurrect a deleted script (autosave, reload, or a second
  browser tab).
- **The app is called Plainchant** (D-012): page title, the welcome dialog ("Welcome to Plainchant"), the first line
  of Help plus a one-line note on what the word means, `package.json` (`plainchant`), doc headings and test page
  titles. An e2e check fails if "NeuroFountain" or "SLASH" reappears in `index.html`. The GitHub repo is
  `aedmark/plainchant` and the project now lives in a folder called `plainchant` (re-cloned 2026-09-20; the old
  `NeuroFountain` folder is retired).
- **Onboarding and help** (D-011). **Welcome tour**: opens by itself on first launch (four skippable steps, wording
  adapts to touch vs keyboard, live-rendered sample, ends with Start writing / Open the example script). Remembered
  in `frictionless_onboarded`; replay it from Help. **Help window**: Start here, Screenplay elements (cheat sheet),
  Keys & touch, Troubleshooting. Opens from the `?` button (the word "Help" in the phone menu), F1, Ctrl/Cmd+/, or
  the `?` at the end of the element bar (jumps to the elements topic). Library, Help and the tour share one
  accessible dialog helper (focus trap, Esc, backdrop click, focus return).
- **Typing helpers** (D-010, `src/editing.js`, wired in `index.html`). **These change how Enter and Tab behave, so
  the user should try them:**
  - **Tab / Shift+Tab** cycle the current line action -> character -> scene heading -> transition. Inside dialogue
    they toggle dialogue <-> parenthetical. On a blank line Tab *chooses* the element for what is about to be typed
    (Character: typed text is uppercased; Scene: `INT. ` is pre-filled). `Esc` then `Tab` moves focus out.
  - **Enter** at the end of a block: after a character cue or parenthetical -> next line (speech follows); after
    anything else -> blank line (new element). **After an action line it now starts a new paragraph; Shift+Enter is
    the plain line break.** Mid-line, mid-block and selections use the normal Enter.
  - **Auto-uppercase** while typing: `int. `/`ext. `/`est. `/`i/e` scene headings and `... to:` transitions, only
    after a blank line and only at the end of the line. Character cues are NOT guessed: press Tab (or the Character
    button) first.
  - **Element bar** under the editor: shows what the current line is and converts it on tap, without closing the
    on-screen keyboard. Short names on phones. Hidden while previewing. This is the touch replacement for Tab.
  - All edits go in through `execCommand('insertText')`, so Ctrl/Cmd+Z undoes each one (tested).
- **Autocomplete** (P2-04, D-017, `src/suggest.js` + the bar in `src/app/typing.js`). While a character name is typed
  (an uppercase cue) or a location after `INT.` / `EXT.` / `.`, names already used in the script show as up to four chips
  in the element bar's row, in place of the element buttons (same height, `?` stays). **Tab takes the first chip only
  while chips are showing; otherwise Tab cycles as before. Enter never takes one. Esc hides them (a second Esc frees Tab
  as before). Shift+Tab always cycles.** Tap a chip to complete the word. Needs one typed letter (a bare `INT. ` offers
  nothing so Tab keeps cycling), and nothing once the text is a whole name (JOHN stays JOHN with JOHNNY in the script).
  Order: use count, then recency. **This changes what Tab does while typing a name, so the user should try it.**
- **1024px and wider** (desktop, iPad landscape): two panes side by side, raw Fountain text left, live preview right.
- **Below 1024px** (phones, portrait tablets, narrow windows; also landscape coarse-pointer under 500px tall): one pane
  at a time. A top bar has a **Write | Preview** toggle. Opening Preview scrolls to where the caret was.
  - Phones (under 700px): New / Library / Save / Export / Copy are in a ⋯ menu.
  - Tablets (700px+): those actions sit inline in the bar; the editor text is held to ~44rem in the middle.
- The screenplay adapts to the width of its *column* (container queries, D-009): a full 60-character page with true
  indents when it fits (portrait iPad), percentage indents and stacked dual dialogue when narrower (phones, a
  1024-1300px split), 14px type under 26rem. The layout tracks `visualViewport` on any touch device so the
  on-screen keyboard shouldn't cover the text.
- Parser/renderer in `src/fountain.js` (pure UMD): scene headings (forced, numbered), action (forced), characters
  (forced `@`, extensions), dual dialogue `^`, parentheticals, dialogue, transitions (forced `>`), centered text,
  lyrics, sections, synopses, page breaks, notes, boneyard, title page, emphasis.
- The last-open script is restored on reload. **New** starts a blank script. The page saves on tab hide / unload as
  well as 2 s after the last keystroke.
- Scroll sync no longer divides by zero.

**Verified**
- `npm test` passes under Node 24: 180 tests (60 parser, 53 typing helpers, 23 library, 13 importing, 23 autocomplete, 8
  app-script structure). The browser runner runs the 172 that need no file access.
- **Autocomplete mutation-tested**: dropping the whole-name guard, the skip-own-line rule, the one-letter minimum, the
  count ordering, the end-of-line rule and the option cap each fail unit tests; Shift+Tab accepting, an Esc that never
  clears, an Esc that also frees Tab, no refresh before Tab, no hide on blur, `innerHTML` chips and an accept that
  bypasses undo each fail an e2e check. Seen in the browser pane at desktop and 375px (four chips fit, long names
  ellipsised). A lookup takes 8 ms on a 30,000-line script (unit-tested).
- Library mutation-tested: removing the guard against autosave writing into a deleted script fails the two-tab
  test; reusing a deleted script's id on reload fails; a 30-day boundary off by one fails a unit test; hard-deleting
  instead of soft-deleting crashes the Library section (an exception), so it cannot pass. (The first attempt at the autosave-guard mutation failed *nothing*, which
  exposed that the two-tab scenario was untested; it now is.)
- `npm run test:browser` passes: the same 172 unit tests + 387 app end-to-end checks (headless Edge, throwaway
  profile). Frames: a 375px phone, the preview-column position at desktop/phone/1800px, tablets at 640-810px
  (one pane) and 1024-1366px (split, no clipping), a 1200px desktop frame for the typing helpers (Tab, Enter,
  Shift+Enter, auto-uppercase, buttons, undo, Esc+Tab, mode lifetime) and for the tour and Help (first launch,
  step navigation, focus trap and return, Esc / backdrop / x / Done, F1 and Ctrl+/, replay, the example script,
  Library on the shared dialog), and the phone frame for dialog fit.
- The **Help cheat sheet is tested against the parser**: 15 examples, each carrying `data-expect` and each run
  through `Fountain.classifyLines` in the e2e suite. Mutation-tested: a wrong example, a broken focus trap and a
  tour that never remembers itself all fail tests.
- Mutation-tested: a 14px editor font and an unreachable menu in Preview fail 4 checks; a shrink-to-fit column fails
  6; disabling the container query fails 10; bypassing `execCommand` fails the 2 undo checks; auto-uppercasing
  paste fails 1; intercepting Shift+Enter fails 1. Removing `min-width: 0` alone fails nothing, because the
  container containment is a second guard against the same clipping.
- The Node unit run found two real bugs in the typing helpers before the page was wired up (Tab stalling on a line
  ending in `TO:`; `@`-forced cues rejected). Both fixed and covered.
- Visually checked at 375x667 (phone), iPad 810px (Write and Preview), 1024x768, and the element bar on desktop
  and phone in headless Edge.

**Not verified / not done**
- **Real devices: the user reports everything works on their tablet and elsewhere** (2026-09-20, after the layout,
  typing-helper and tablet work; no detail recorded on which devices, Split View, or Pencil). That covers P2-09 in
  spirit but the specifics below remain unobserved by me. `fitToViewport()` itself is tested only with a fake
  `visualViewport`. The **tour and Help have not been seen on a device**, and their wording has had no review from
  anyone but me.
- Only Edge (Chromium) has been used. Firefox and Safari are untested. iPad Safari's "desktop-class" browsing mode
  and Split View / Stage Manager window widths are reasoned about, not observed.
- Apple Pencil handwriting and hardware-keyboard use on tablets are unchecked (P2-13).
- **Typing helpers on real input methods.** Tests fire keyboard-shaped events (`keydown` Tab, `beforeinput`
  insertLineBreak, `input` insertText). Not yet observed: iOS Safari and Android GBoard soft keyboards (Enter is
  read from `beforeinput`; Android composition may delay auto-uppercase until a word is committed), predictive
  text, Scribble, and whether the on-screen keyboard survives a tap on the element bar (the design cancels
  `mousedown` for that). All of it is P2-09 territory.
- Whether the new Enter / Tab behaviour *feels* right to a writer is a judgement only the user can make; P2-15
  (settings to turn parts off) exists in case it does not.
- **Autocomplete on real devices and with a screen reader** (nothing announces the chips; P2-21). Whether Tab taking a
  suggestion feels right to a writer is the user's call.
- Phase 1 is complete (P1-01 to P1-10); P2-01 to -05, -11, -12, -17 to -19 are done.

**Gotchas for the next session**
- Node 24.19.0 and Python 3.13.15 were installed via winget at the end of session 1. Sessions that were already
  running need PATH refreshed (or a restart) before `node`/`npm`/`python` resolve. Neither is needed to run the app.
- PyCharm may still need its interpreter pointed at `%LOCALAPPDATA%\Programs\Python\Python313\python.exe`
  (Settings > Project > Python Interpreter) if the user wants Python features there. The project is JavaScript.
- Headless Edge quirks on Windows: pass URL unquoted via `Start-Process -ArgumentList`; quote any path that contains
  a space (`C:\Users\Gordon Knot\...`); use `--virtual-time-budget=NNNN` so timers fire; redirect stdout to a file
  rather than piping. `test/run-headless.ps1` already handles all of this.
- Blank lines are structure, not spacers: the parser emits no spacer tokens, spacing is CSS margins only.
- The parser is deliberately spec-strict (D-004). The editor, not the parser, adds leniency (D-010): text in the
  document must already parse the way the writer means it. Where it cannot, the editor writes a forced marker
  (`!`, `@`, `.`, `> `), which is valid Fountain.
- Never assign `editor.value` or use `setRangeText` for a user-visible edit: it wipes the browser's undo history.
  Go through `applyEdit()` (execCommand). Programmatic loads (Library, New, restore) may assign `.value`.
- `applyingEdit` guards against our own edits re-triggering auto-uppercase; `elementMode` / `modeLine` are the
  per-line "chosen element" state; `syncElementState()` is global on purpose (the e2e calls it).
- `Editing.kindAt()` asks the parser twice (next line blank / next line has text) because the parser needs to see
  what follows before it will call something a cue or a transition. Change it with care; the property test in
  `test/editing.test.js` ("the parser agrees afterwards") is the safety net.
- `frictionless_*` localStorage keys are legacy naming and must stay (D-005).
- **The headless runner's `--virtual-time-budget` is 240000** (was 60000). The e2e suite had grown past the old budget
  and the runner reported "the page never finished" with 0 passed, on a clean checkout too. If that message returns,
  raise it again before suspecting the code.
- **The e2e page has a timing trap.** Frames from early sections keep their text and a 2-second autosave timer, and
  `openFrame` silences saving only in its own frame. Adding frames or waits moves the virtual clock, and a stale timer
  can then write a script into storage during the Library section (the symptom: "library: choosing a script opens it"
  opens the wrong script). The typing section now silences every existing frame before it starts. Do the same in any
  new section that runs after long-lived frames and touches storage.
- Autocomplete: `Suggest.at(text, caret)` needs no "mode" argument because it asks `Editing.kindAt`, so it sees a cue only
  once the line is uppercase (Tab-chosen Character mode uppercases as you type). Chips use their own class
  (`.suggest-chip`), not `.el-btn`, so the tests that count six element buttons still hold. `dismissedFor` clears itself
  as soon as the caret leaves the dismissed word.
- **Git and the repo:** `origin` is `https://github.com/aedmark/plainchant.git` (renamed on GitHub by the owner,
  who also re-cloned into a fresh `plainchant` folder). Everything through `4d9fe13` is pushed and in sync. The
  `gh` CLI is not installed, so GitHub-side changes (renames, settings) are the owner's to make. **Git working
  agreement (owner's preference):** commit finished, tested work without asking, with a normal message; never
  force-push or rewrite history; push when asked (it publishes the code). The fresh clone has a git identity
  configured (`Gordon Knot`), so plain `git commit` works; early commits were authored `gknot
  <oopismcgoopis@gmail.com>` from before that. The owner also commits and pushes from PyCharm, often with the
  message "0"; expect that in `git log`.
- Claude Code project memory is keyed by folder path, so the renamed folder starts with none. That is fine: the
  docs in this repo (this file, ROADMAP, DECISIONS, CLAUDE.md) are the memory. Do not rely on anything else.
- Do not run a bulk find-and-replace of "NeuroFountain" over the docs: the old name appears deliberately in D-012
  and in the session logs as history, and a replace once turned two sentences there into nonsense (caught in the
  retired folder before it was committed).
- **Every e2e frame must set `frictionless_onboarded` first**, or the tour opens in it and blocks the test. The
  e2e page does this once at the start (and snapshots/restores the key with the others). New test files that load
  the app need the same.
- **The Help cheat sheet must stay true.** Every example is a `<code data-expect="type,type,...">` in `index.html`
  whose text is run through `Fountain.classifyLines` by the e2e suite. Change the parser, and the failing example
  tells you which help line to update. Add a line to Help when adding a user-visible feature. Bump `TOUR_VERSION`
  to re-show a revised tour to everyone.
- Dialogs: use `openModal(overlay, {focus, onClose})` / `closeModal(overlay)`; a close control is any element with
  `data-close`. Do not toggle `.active` by hand. `openModals` is a `const`, so tests read the DOM
  (`.modal-overlay.active`), not the array.
- Help's `?` (short) / "Help" (long) label switches at 700px, the same width where the actions move from the phone
  menu to the tablet bar. If that breakpoint moves, move the label rule with it.
- Two media queries each live in two places: the CSS "one pane" block and `MOBILE_QUERY`, and the CSS fixed-body
  rule and `FIT_QUERY` (both in the script). Change each pair together (D-008, D-009). The 1024px / 700px
  breakpoints and the 36rem / 26rem container thresholds are explained in D-009.
- Do not put a `nowrap` or a large `ch` margin on anything in the preview without checking it at 744-1024px wide:
  one such line once forced the preview pane to 627px and clipped it off every iPad in portrait.
- In Preview on mobile, `.pane-void` is `display: contents` so its fixed-position menu stays reachable. Don't
  change it to `display: none`; a test guards this.
- **The app script is split into `src/app/*.js`** (D-014; the map and rules are in CLAUDE.md "App scripts"). Classic
  scripts, one shared global scope, order matters only for code that runs at load. `test/structure.test.js` guards it.
  Put new code in the file that owns the concern (a new file if none does) and register it in `index.html`.
- `fitToViewport(vv)` and `setView()` / `setMenu()` are global functions on purpose: the e2e page calls them.
- `#render-target` (full-width scroll area) and `#page` (the fixed-width screenplay column, `.screenplay-font`) are
  separate elements on purpose. Merged into one flex item with `margin: 0 auto`, the column shrank to its widest
  line and floated to the middle. Render into `#page`, scroll `#render-target`.

## Next steps (in order)

1. **Try the tour as a first-time user on the tablet** (clear site data or
   `localStorage.removeItem('frictionless_onboarded')`). The user proofed the Help copy in session 8; the tour copy
   (`src/app/tour.js` and the tour markup) was not changed then.
2. **Ask the user how the typing helpers feel** (especially Enter starting a new paragraph after action, and cues
   needing a Tab). Adjust or add settings (P2-15) / cue suggestions (P2-14) accordingly.
3. **Ask the user how autocomplete feels** (P2-04, D-017): Tab taking the first suggestion while chips show, needing a
   first letter, chips replacing the element buttons while typing a name. Then P2-21 (time of day after `INT. PLACE - `,
   names on an empty cue line, screen-reader announcements) only if wanted. The agreed order still stands:
   autocomplete, then PAUSE.
4. **P3-03 print stylesheet / PDF: spec and plan only, at the user's request, before any implementation.** Questions to
   settle: US Letter and A4, screenplay margins and Courier 12pt, about 55 lines a page, page numbers, `(MORE)` /
   `(CONT'D)`, title page on its own page, dual dialogue, scene numbers, and print-CSS versus a generated PDF (D-001 says
   no runtime dependencies). Write the result up as a decision plus roadmap items, then wait for the go-ahead.
5. (P4-08 and P4-09, splitting the script and the stylesheet out of `index.html`, are done.)
6. **P4-10 IndexedDB migration is specced, not scheduled** ([docs/SPEC-INDEXEDDB.md](SPEC-INDEXEDDB.md), D-018). It is
   a Phase 4 item and comes after P3-03; do not start it without the user's go-ahead. Settle the spec's open questions
   (§11) before implementing.

## Open questions for the user

- ~~What is the product called?~~ **Plainchant** (D-012). Repo and folder renamed. Still open for the owner:
  register a domain, do a proper trademark search, make a logo (roadmap Phase 6).
- Is the tour the right length and tone (four steps), and is showing it once to existing users too?
- Enter after an action line starts a new paragraph (Shift+Enter for a line break). Right default?
- Cues need Tab or the Character button. Is that acceptable, or should "a short unpunctuated line after a blank
  line, then Enter" be treated as a cue automatically (P2-14)?
- Autocomplete: is Tab-takes-the-first-suggestion right, and do you want the time of day (`- DAY`) suggested too (P2-21)?
- Is a plain `<textarea>` editor acceptable long term, or is inline styling of the source text (P2-08) a must-have?

---

## Session log

Newest first. Copy the template for each new session.

### Session 11: 2026-09-21: IndexedDB migration spec (P4-10)

**Goal:** At the user's request, spec out moving storage from localStorage to IndexedDB (P4-10).
**Done:** P4-10 added to the roadmap (Phase 4); D-018 decision; `docs/SPEC-INDEXEDDB.md` written; a "Next steps"
pointer added to this file. No code, no tests — spec only.
**Changed:** `ROADMAP.md` (P4-10), `docs/DECISIONS.md` (D-018), `docs/SPEC-INDEXEDDB.md` (new), `docs/HANDOFF.md`
(next-steps item 6).
**Decisions:** D-018. The two problems are separable (the ~5 MB cap vs. the whole-library rewrite per save); the
migration is async and interacts with the pagehide flush, so it is specced, not scheduled, and comes after P3-03.
**Problems / surprises:** None — the main finding is that this is a bigger change than a storage swap (async reads/writes
ripple through persistence, and "never lose words" needs a synchronous emergency buffer to survive the unload race).
**Left undone:** Implementation; settling the spec's §11 open questions; it is a Phase 4 item, after P3-03.
**Next session should start with:** "Next steps" above.

### Session 10: 2026-09-21: Autocomplete (P2-04)

**Goal:** Build the autocomplete designed at the end of session 9.
**Done:** P2-04 (D-017). New `src/suggest.js` (pure; `names`, `locations`, `at`, `edit`) with 23 unit tests written first
and seen failing; chips in the element bar wired in `src/app/typing.js`; 29 new e2e checks (a desktop frame for showing,
tap, Tab, Enter, Esc, undo, focus, XSS; a 375px frame for fit); Help (Keyboard and Touch); D-017; roadmap P2-04 ticked and
P2-21 added. `test/run.js`, `test/index.html`, `index.html` and the structure test know the new module.
**Changed:** the design sketch was followed except: a bare `INT. ` offers nothing (a suggestion there would steal the
Tab that cycles to Transition), and the time of day is left out (the user had not decided). Esc dismisses only while the
caret stays on that word; it does not free Tab (a second Esc does).
**Decisions:** D-017.
**Problems / surprises**
- The headless runner reported "0 passed, the page never finished" on a clean checkout: the suite had outgrown the 60 s
  virtual-time budget (session 9's import tests, probably). Raised to 240 s; the baseline then passed 358/358 three times.
- Adding frames to the e2e page then made an old, unsilenced autosave timer leak a script into storage and break a Library
  check. Traced by comparing with a clean worktree of HEAD (deterministic 358/0), fixed by silencing older frames first.
- Two of my own e2e checks were wrong (a text search that matched text already in the fixture; a Shift key left "down"
  after a synthetic Shift+Tab). One real flaw was found by the tests: Esc's dismissal outlived the caret leaving the word.
**Left undone:** Real devices, iOS / Android soft keyboards and screen readers. Time-of-day suggestions (P2-21). Session 9
has no log entry of its own; its work (import, P3-02, D-016) is in the git log and the "What works" list above.
**Next session should start with:** "Next steps" above.

---

### Session 8: 2026-09-20: Help copy proofed; stylesheet extracted (P4-09)

**Done:** The user rewrote three passages of the Help "Start here" copy (intro, the "Your work" callout). Their editor
had stripped the comments from `index.html` (55 of them) and reformatted it, so I restored the committed file and
re-applied only the wording edits (found by diffing with comments and whitespace normalised). Small fixes on the way: "The Void
(Write on a phone) / The Canvas (Preview)" so the copy matches the phone tab labels, and "never sent to a server"
instead of "no Cloud server" (the page still loads fonts from Google until P4-02). Pushed. Then P4-09: the ~680-line
inline stylesheet is now `src/styles.css` (rules unchanged, de-indented; `index.html` 1,019 to 321 lines) with a
structure test guarding it. Tests: 144 under Node, 136 unit and 330 e2e in the browser.

**Left undone:** the tour copy is still mine and unreviewed by the user; nothing verified on a real device.

### Session 7: 2026-09-20: Split the app script; `.fountain` export (P4-08, P3-01)

**Goal:** Take the growing inline script out of `index.html`, and add the quick `.fountain` export win.

**Done (part 1, the split):** P4-08. The ~925-line inline script is now eleven files in `src/app/` (D-014). The
split was mechanical: line ranges cut by script and de-indented, then a multiset comparison proved every original
code line exists exactly once (826 in; 827 out = two section-comment lines replaced by file headers, plus three
"Wiring" markers). All 319 e2e checks and 129 unit tests passed unchanged. `index.html` went from 1,931 to 1,019
lines. New `test/structure.test.js` (7 tests, Node only) guards the load list, duplicate declarations, inline
scripts, syntax, file size and headers; each guard was mutation-checked.

**Done (part 2, export):** P3-01 (D-015). Export now downloads `<title>.fountain` (was `.txt` named after the first
line). New `Fountain.fileName` (7 tests, written first and seen failing): readable slug, any-language letters kept,
path characters neutralised, 60-char word-boundary cap, Windows reserved names prefixed, `untitled` fallback.
`downloadText` / `exportScript` / `flashButton` in `src/app/export.js`; 11 new e2e checks exercise the real download
path (blob type and contents, the temporary link, naming from a title and from a first line, accents, the empty
case, labels reverting). Help updated. Fixed a real Copy bug found on the way: two quick clicks could leave the
button stuck on "Copied!" (reproduced by mutation, now tested).

**Problems / surprises**
- `.txt` is gone as an export format. If that matters to the user, P3-10 is the place to add a choice.

**Left undone:** Export is untested on real iOS / Android downloads (the delayed `revokeObjectURL` is the
precaution, not an observation). PDF / print (P3-03). The user is proofing the Tour / Help copy next.

**Also this session:** pushed the Library commit (`cdafa4d`).


### Session 6: 2026-09-20: Library management (P3-07)

**Goal:** Rename, delete (with undo), duplicate and search for scripts in the Library.

**Done:** P3-07 (D-013). New `src/library.js` (pure) with 23 unit tests; `Fountain.setTitle` / `fullTitle` and
`Editing.diffEdit` with tests; the Library dialog rebuilt in `index.html`; Help updated (rename, Recently deleted);
52 new e2e checks (267 to 319). Also improved `test/run-headless.ps1` to say plainly when the e2e page never finishes.

**Changed**
- `index.html`: Library dialog (search box, Scripts / Recently deleted tabs, live-region messages), `renderLibrary`
  and its actions, `applyEdit(edit, {keepFocus})` (keeps focus in the dialog and suppresses the on-screen keyboard
  with `inputmode="none"` while it briefly focuses the editor), and safer persistence: `saveScript` merges into the
  stored record and never writes into a deleted script, `restoreLastScript` ignores a pointer to a deleted script,
  `purgeTrash` runs at startup. Library rows are now real buttons (the whole row used to be a `div role=button`).
- Tests: `test/library.test.js`; additions to `fountain.test.js` and `editing.test.js`; a Library section in
  `app.e2e.html` covering search, rename (open and not open, undo/redo), duplicate, delete/undo, trash, delete forever
  (two clicks and timeout), deleting the open script, stale pointer, two tabs, XSS, empty state, phone fit.

**Decisions:** D-013.

**Problems / surprises**
- The first run of the e2e page reported "0 passed, 0 failed": a duplicate `const` was a syntax error, and the
  runner didn't say so. Checked with `node --check`, fixed, and the runner now reports "the page never finished".
- Older test frames still had autosaves pending and were writing scripts into the shared storage while the Library
  was under test. Fixed by silencing saving in every earlier frame before that section.
- One assertion assumed the renamed script would sort first; a pending autosave of another script legitimately
  sorted newer. The app was right; the test now asserts the stable facts.
- Screenshot review showed the Rename / Duplicate / Delete buttons still visible under the rename field; hidden now.

**Left undone:** Not seen on a real device (the `inputmode="none"` focus trick in particular is unobserved on iOS /
Android). Sort options, multi-select, per-script export and a storage indicator (P3-09). Tour / Help copy still needs
the user's read.

**Next session should start with:** "Next steps" above.

---

### Session 5: 2026-09-20: Naming (P6-00)

**Goal:** Brainstorm and choose a name, then apply it.

**Done:** Chose **Plainchant** and applied it (D-012). Roadmap Phase 6 added for the owner's brand follow-ups.

**How it went**
- The user set the brief: an app for neurodivergent writers and anyone who gets hung up on formatting; calm and
  whimsical; liked Ebb, Lucid and Vellum. I brainstormed in the water / quiet / paper register and checked each
  shortlisted name with web search and DNS lookups instead of guessing.
- Dropped for real collisions: Vellum (a Mac book-formatting app), Deckle, Foolscap, Dormouse, Inkling, Rill, Paper
  Boat (a beverage brand), and Plainsong (two apps already). The user then chose Plainchant, the same music under
  its other name, precisely because Plainsong was taken. It came back clear in searches.
- Renamed: `index.html` title and copy, `package.json`, doc and test-page headings. Two e2e checks added for the
  name (page title and no leftover old names; welcome dialog title).

**Problems / surprises**
- The user wrote "Plainchant" while I had been discussing "Plainsong". I checked instead of assuming; they meant it.
- An early domain check included `.write`, which is not a real TLD, so those rows meant nothing (noted at the time).
- DNS "no answer" is a hint, not availability. No trademark clearance was done (D-012).

**After the rename:** the user renamed the GitHub repo to `plainchant`, committed the doc corrections (`4d9fe13`),
pushed, and re-cloned into a fresh `plainchant` folder, which is now the working directory. The fresh clone was
verified from scratch: `npm test` 94/94, browser suites 94 unit + 267 e2e, clean tree. The user also said to be
less protective about git (commit finished work without asking); recorded above under "Git working agreement".

**Left undone:** Domain, trademark search, logo (Phase 6). Tour / Help copy still needs the user's read.

**Next session should start with:** "Next steps" above.

---

### Session 4: 2026-09-20: Onboarding tour and Help (P2-17, P2-18, P2-19)

**Goal:** Give new users an onboarding process and modal help windows.

**Done:** P2-17 tour, P2-18 Help window, P2-19 shared dialog helper. P2-09 recorded as user-verified in spirit.

**Changed**
- `index.html`: three dialogs (Library retrofitted, Help, Tour) on `openModal` / `closeModal`; Help button in the
  action group (`?` inline, "Help" in the phone menu) and a `?` on the element bar; F1 / Ctrl+/ shortcut; example
  script; tour state in `frictionless_onboarded`; CSS for dialogs, help tables (stack on phones), kbd, callouts.
- `test/app.e2e.html`: 85 new checks (265 total): tour lifecycle, dialog a11y and focus, Help topics and shortcuts,
  15 cheat-sheet examples verified against the parser, the example script, Library on the shared helper, phone fit,
  and a 700px tablet frame plus six-button header checks at 1024-1366px. Existing frames now pre-set the tour key.
- Docs: D-011, roadmap P2-17..P2-20 and P4-08, this file.

**Decisions:** D-011. Not a spotlight tour (fragile across three layouts). Tour wording avoids the product name.

**Problems / surprises**
- One test failure was my test: a programmatic `.click()` does not move focus like a real tap, so the "focus returns
  to the menu button" case needed the opener focused first.
- Mutation checks of the new tests caught a wrong help example, a broken focus trap and a forgetful tour.
- The Help topic chips scrolled sideways on a phone and hid two topics; found in a screenshot, fixed by wrapping
  them, now tested.

**Left undone:** The copy has had no review beyond mine. Not seen on a real device. Library still cannot delete
(the example script accumulates, P3-07). No contextual first-use hints (P2-20).

**Next session should start with:** "Next steps" above.

---

### Session 3: 2026-09-20: Typing helpers (P2-01, P2-02, P2-03, P2-11)

**Goal:** Start on the typing helpers while the user charged their tablet.

**Done:** P2-01 Tab cycling, P2-02 smart Enter, P2-03 auto-uppercase, P2-11 on-screen element bar.

**Changed**
- New `src/editing.js` (pure): `kindAt`, `enter`, `tab` / `cycleTarget`, `setType`, `autoCase`.
- `src/fountain.js`: dialogue lines now carry their source `line`; new `Fountain.classifyLines(text)` (one type per
  source line) for the editor.
- `index.html`: element bar markup + CSS (short labels under 480px), key/beforeinput/input handlers, `applyEdit`
  (execCommand, keeps undo), `elementMode` state, `syncElementState`.
- Tests: `test/editing.test.js` (49 tests incl. a property check that the parser agrees with every conversion, and
  a never-stalls check on Tab), 43 new checks in `test/app.e2e.html`; phone-layout checks adjusted for the bar.
- Docs: D-010, roadmap statuses and new items P2-14..P2-16, CLAUDE.md layout table.

**Decisions:** D-010. The ones the user may want to reverse: Enter after action = new paragraph; cues are explicit
(Tab / button), not guessed; Tab order is action -> character -> scene -> transition.

**Problems / surprises**
- The first Node run of the pure module failed 2 of 91 tests: one wrong expectation of mine (`SMASH CUT` is already a
  known transition) and one real bug (converting `cut to:` to a character returned nothing, so Tab would have
  stalled on such a line). Fixed by making Tab skip impossible steps.
- All wiring tests passed on their first run, so I checked they could fail: probed `execCommand` / undo directly
  (both work headless) and mutation-tested undo, paste and Shift+Enter (all caught).
- The element bar overflowed at 375px (last button cut off); fixed with short labels.

**Left undone:** Real devices and soft keyboards (P2-09). Cue suggestions (P2-14), settings (P2-15), keeping the
caret above the keyboard in long scripts (P2-16). Autocomplete (P2-04).

**Next session should start with:** "Next steps" above.

---

### Session 2: 2026-09-20: Mobile layout (P2-05) and tablets (P2-12)

**Tablet follow-up (second half of session 2, commit after `2eccd97`):** the user pointed out tablets are the most
likely device. Measured at iPad sizes and found the split layout clipped the preview by 85-341px anywhere below
1109px wide (see D-009 for cause). Fixed and redesigned: one pane below 1024px, inline actions from 700px, editor
line-length cap, container-query screenplay, viewport fitting on all touch devices, tagline hidden in narrow splits.
The e2e desktop frame moved from 1000px to 1200px because 1000px is now (correctly) one-pane. 70 new checks.
I had told the user tablets were "unchanged" earlier without testing them; that claim was wrong in spirit.

**Goal:** Replace the fixed 50/50 split on phones with a layout that is actually usable for writing.

**Done:** P2-05. Partly P2-06 (Preview jumps to the caret when opened on mobile; desktop scroll sync is still
percentage-based). P4-07 (Clipboard API for Copy), pulled forward because Copy has to work while the textarea is
hidden in Preview.

**Changed**
- `index.html` CSS: layout is now desktop-first (was mobile-first with a 768px override). A "mobile" media block
  shows one pane at a time, adds the top bar and drop-down menu, sets the editor to 16px, re-proportions the
  screenplay in percentages, stacks dual dialogue, and sizes `body` from `--app-height` / `--app-top`.
- Screenplay indents are now CSS variables (`--ind-char`, `--w-dialogue`, ...) so the mobile block only overrides
  variables.
- `index.html` script: `setView`, `scrollPreviewToCaret`, `setMenu`, `fitToViewport`, `MOBILE_QUERY`; viewport meta
  gained `viewport-fit=cover` and `interactive-widget=resizes-content`; `copyText()` uses the Clipboard API with the
  old select+execCommand fallback and reports failure honestly.
- `test/app.e2e.html`: 31 new checks (58 total), a phone-sized frame, and a fix so pending autosave timers can't
  write to storage after it has been restored.

**Decisions:** D-008 (mobile mode is a CSS media query mirrored in JS; `display: contents` for the menu).

**Bug found by the user during this session:** the preview centred content whenever no line filled the full column
width. Cause: the scroll area and the screenplay column were one element, a flex item with `margin: 0 auto`, so it
shrank to its widest line and centred (scrollbar included). Reproduced with measurements (column at x=562/377px wide
for a short script versus x=501/500px for one long line), fixed by splitting it into `#render-target` and `#page`,
and guarded by e2e checks at desktop, phone and wide widths. Side effect: the column is now really 60ch of *content*
wide on large screens (it was 60ch including the 4rem padding, so about 47ch of text).

**Problems / surprises**
- First design hid `.pane-void` in Preview, which also hid the menu that lives in its header. Caught while
  designing, fixed with `display: contents`, and now covered by a test.
- Ran the visual check and test runs in throwaway profiles again (D-007).

**Left undone:** Real-device verification (P2-09). An on-screen way to do what Tab will do (P2-01) on a phone.
Tapping the preview to jump to that line in the editor.

**Next session should start with:** "Next steps" above.

---

### Session 1: 2026-09-20: Roadmap, handoff scheme, restore, Fountain parser

**Goal:** Set up planning/handoff docs; deliver roadmap items 1 (restore last script, scroll-sync fix) and 2 (real
Fountain parser with tests).

**Done:** P1-01 to P1-10 (all of Phase 1). Node 24.19.0 and Python 3.13.15 installed via winget at the user's
request, after which `npm test` was run for the first time and passed.

**Changed**
- Added `ROADMAP.md`, `CLAUDE.md`, `docs/HANDOFF.md`, `docs/DECISIONS.md` (D-001 to D-007), `.gitignore`.
- New `src/fountain.js`; `index.html` now uses it (old inline `parseScript` and `escapeHTML` removed).
- `index.html`: New button, restore-on-load (`frictionless_current` pointer), flush on `visibilitychange` /
  `pagehide`, scroll-sync guard, `crypto.randomUUID` fallback for plain-http origins, CSS for the new elements.
- Tests: `test/harness.js`, `test/fountain.test.js`, `test/index.html`, `test/app.e2e.html`, `test/run.js`,
  `test/run-headless.ps1`; `package.json` scripts.

**Decisions:** D-001 to D-007 in DECISIONS.md. Notably D-004 (spec-strict parser, editor adds leniency) and D-006
(emptying the editor does not overwrite the saved script).

**Behaviour changes a writer will notice**
- Lowercase `cut to:` and lowercase character names are now action (they were guessed before).
- Blank-line spacing is normalised; several blank lines no longer stack up.
- Reloading now brings back your last script instead of an empty editor.

**Problems / surprises**
- A test failure that looked like a scroll-sync bug was a wrong test (scrolled to 10000px of a 12899px range).
  Diagnosed with real numbers; app code was correct.
- Headless-browser runs without `--user-data-dir` can share `file://` localStorage with a real profile. The e2e page
  now snapshots and restores the app's keys, and the runner uses a throwaway profile (D-007). The real Edge
  profile's Local Storage files showed no writes from this session.

**Left undone:** Real-phone and non-Chromium testing.

**Next session should start with:** "Next steps" above.

---

### Template

```
### Session N: YYYY-MM-DD: short title

**Goal:**
**Done:** roadmap IDs
**Changed:** files / behaviour
**Decisions:** D-numbers added
**Problems / surprises:**
**Left undone:**
**Next session should start with:**
```
