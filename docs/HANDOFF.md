# Session Handoff

Read this first. It is rewritten at the end of every session so the top half is always true *right now*.
The session log below it is append-only history.

Protocol: see [CLAUDE.md](../CLAUDE.md). Plan: [ROADMAP.md](../ROADMAP.md). Decisions: [DECISIONS.md](DECISIONS.md).

---

## Current state

_Last updated: 2026-09-20, end of session 6 (Library management)._

**What works**
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
- `npm test` passes under Node 24: 136 tests (53 parser incl. setTitle, 53 typing helpers incl. diffEdit, 23
  library, 7 app-script structure). The browser runner runs the 129 that need no file access.
- Library mutation-tested: removing the guard against autosave writing into a deleted script fails the two-tab
  test; reusing a deleted script's id on reload fails; a 30-day boundary off by one fails a unit test; hard-deleting
  instead of soft-deleting crashes the Library section (an exception), so it cannot pass. (The first attempt at the autosave-guard mutation failed *nothing*, which
  exposed that the two-tab scenario was untested; it now is.)
- `npm run test:browser` passes: the same 129 unit tests + 319 app end-to-end checks (headless Edge, throwaway
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
- Phase 1 is complete (P1-01 to P1-10); P2-01, -02, -03, -05, -11, -12 are done.

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

1. **Get the user's eyes on the tour and Help** (read the copy; try the flow on the tablet, and as a first-time
   user by clearing site data or `localStorage.removeItem('frictionless_onboarded')`). The wording is mine and
   unreviewed. Adjust content, length and tone; decide whether a product name belongs in it.
2. **Ask the user how the typing helpers feel** (especially Enter starting a new paragraph after action, and cues
   needing a Tab). Adjust or add settings (P2-15) / cue suggestions (P2-14) accordingly.
3. **P2-04** autocomplete of character names and locations. The natural next typing helper now that cues exist:
   in Character mode, offer names already used in the script.
4. **P3-01** `.fountain` export is a five-minute win worth taking early. (Library management, P3-07, is done.)
5. **P4-09** the inline stylesheet (~770 lines) is now what makes `index.html` long; extract it when convenient.
   (P4-08, splitting the script, is done.)

## Open questions for the user

- ~~What is the product called?~~ **Plainchant** (D-012). Repo and folder renamed. Still open for the owner:
  register a domain, do a proper trademark search, make a logo (roadmap Phase 6).
- Is the tour the right length and tone (four steps), and is showing it once to existing users too?
- Enter after an action line starts a new paragraph (Shift+Enter for a line break). Right default?
- Cues need Tab or the Character button. Is that acceptable, or should "a short unpunctuated line after a blank
  line, then Enter" be treated as a cue automatically (P2-14)?
- Is a plain `<textarea>` editor acceptable long term, or is inline styling of the source text (P2-08) a must-have?

---

## Session log

Newest first. Copy the template for each new session.

### Session 7: 2026-09-20: Split the app script; `.fountain` export (P4-08, P3-01)

**Goal:** Take the growing inline script out of `index.html`, and add the quick `.fountain` export win.

**Done (part 1, the split):** P4-08. The ~925-line inline script is now eleven files in `src/app/` (D-014). The
split was mechanical: line ranges cut by script and de-indented, then a multiset comparison proved every original
code line exists exactly once (826 in; 827 out = two section-comment lines replaced by file headers, plus three
"Wiring" markers). All 319 e2e checks and 129 unit tests passed unchanged. `index.html` went from 1,931 to 1,019
lines. New `test/structure.test.js` (7 tests, Node only) guards the load list, duplicate declarations, inline
scripts, syntax, file size and headers; each guard was mutation-checked.

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
