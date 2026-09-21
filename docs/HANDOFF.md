# Session Handoff

Read this first. It is rewritten at the end of every session so the top half is always true *right now*.
The session log below it is append-only history.

Protocol: see [CLAUDE.md](../CLAUDE.md). Plan: [ROADMAP.md](../ROADMAP.md). Decisions: [DECISIONS.md](DECISIONS.md).

---

## Current state

_Last updated: 2026-09-20, end of session 2._

**What works**
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
- `npm test` passes under Node 24: 45 unit tests.
- `npm run test:browser` passes: the same 45 unit tests + 137 app end-to-end checks (headless Edge, throwaway
  profile). Frames: a 375px phone (31 checks), the preview-column position at desktop/phone/1800px (9), and
  tablets at 744, 768, 810, 1023 and 640px (one-pane behaviour) plus 1024-1366px (split, no clipping) (70).
- Mutation-tested: a 14px editor font and an unreachable menu in Preview fail 4 checks; a shrink-to-fit column fails
  6; disabling the container query fails 10. Removing `min-width: 0` alone fails nothing, because the container
  containment is a second guard against the same clipping; removing both fails the broad set.
- Visually checked at 375x667 (phone), iPad 810px (Write and Preview) and 1024x768 in headless Edge.

**Not verified / not done**
- **No real phone or tablet yet.** Keyboard behaviour is the risk: `fitToViewport()` is tested only with a fake
  `visualViewport`, and `interactive-widget=resizes-content` / iOS Safari's behaviour is from documentation, not
  observation. See P2-09 (roadmap) for how to test it.
- Only Edge (Chromium) has been used. Firefox and Safari are untested. iPad Safari's "desktop-class" browsing mode
  and Split View / Stage Manager window widths are reasoned about, not observed.
- Apple Pencil handwriting and hardware-keyboard use on tablets are unchecked (P2-13).
- Phase 1 is complete (P1-01 to P1-10); P2-05 is done.

**Gotchas for the next session**
- Node 24.19.0 and Python 3.13.15 were installed via winget at the end of session 1. Sessions that were already
  running need PATH refreshed (or a restart) before `node`/`npm`/`python` resolve. Neither is needed to run the app.
- PyCharm may still need its interpreter pointed at `%LOCALAPPDATA%\Programs\Python\Python313\python.exe`
  (Settings > Project > Python Interpreter) if the user wants Python features there. The project is JavaScript.
- Headless Edge quirks on Windows: pass URL unquoted via `Start-Process -ArgumentList`; quote any path that contains
  a space (`C:\Users\Gordon Knot\...`); use `--virtual-time-budget=NNNN` so timers fire; redirect stdout to a file
  rather than piping. `test/run-headless.ps1` already handles all of this.
- Blank lines are structure, not spacers: the parser emits no spacer tokens, spacing is CSS margins only.
- The parser is deliberately spec-strict (D-004). Lowercase cues are action until P2-03.
- `frictionless_*` localStorage keys are legacy naming and must stay (D-005).
- Two media queries each live in two places: the CSS "one pane" block and `MOBILE_QUERY`, and the CSS fixed-body
  rule and `FIT_QUERY` (both in the script). Change each pair together (D-008, D-009). The 1024px / 700px
  breakpoints and the 36rem / 26rem container thresholds are explained in D-009.
- Do not put a `nowrap` or a large `ch` margin on anything in the preview without checking it at 744-1024px wide:
  one such line once forced the preview pane to 627px and clipped it off every iPad in portrait.
- In Preview on mobile, `.pane-void` is `display: contents` so its fixed-position menu stays reachable. Don't
  change it to `display: none`; a test guards this.
- `fitToViewport(vv)` and `setView()` / `setMenu()` are global functions on purpose: the e2e page calls them.
- `#render-target` (full-width scroll area) and `#page` (the fixed-width screenplay column, `.screenplay-font`) are
  separate elements on purpose. Merged into one flex item with `margin: 0 auto`, the column shrank to its widest
  line and floated to the middle. Render into `#page`, scroll `#render-target`.

## Next steps (in order)

1. **P2-09 Real-device pass** (needs the user). Python is now installed, so from the project folder run
   `python -m http.server 8000`, find the PC's LAN IP, and open `http://<ip>:8000` on a phone AND a tablet (same
   Wi-Fi; Windows may prompt to allow Python through the firewall). Check: keyboard doesn't cover the caret line,
   no zoom on focus, Write/Preview and the menu/inline actions feel right, rotate, and on an iPad try Split View.
   Fix whatever it finds.
2. **P2-01 / P2-02 / P2-03** (Tab cycling, smart Enter, auto-uppercase): the core "just type" experience. On a phone
   there is no Tab key, so P2-01 needs an on-screen element-cycle button too. Design question to settle first: keep
   the plain `<textarea>` (Q-001 in DECISIONS.md) and implement these as key handlers.
3. **P3-01** `.fountain` export is a five-minute win worth taking early.

## Open questions for the user

- Is a plain `<textarea>` editor acceptable long term, or is inline styling of the source text (P2-08) a must-have?

---

## Session log

Newest first. Copy the template for each new session.

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
