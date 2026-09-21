# Session Handoff

Read this first. It is rewritten at the end of every session so the top half is always true *right now*.
The session log below it is append-only history.

Protocol: see [CLAUDE.md](../CLAUDE.md). Plan: [ROADMAP.md](../ROADMAP.md). Decisions: [DECISIONS.md](DECISIONS.md).

---

## Current state

_Last updated: 2026-09-20, end of session 1._

**What works**
- Two-pane app in `index.html`: raw Fountain text on the left, live screenplay preview on the right.
- Parser/renderer in `src/fountain.js` (pure UMD): scene headings (forced, numbered), action (forced), characters
  (forced `@`, extensions), dual dialogue `^`, parentheticals, dialogue, transitions (forced `>`), centered text,
  lyrics, sections, synopses, page breaks, notes, boneyard, title page, emphasis.
- The last-open script is restored on reload. **New** starts a blank script. The page saves on tab hide / unload as
  well as 2 s after the last keystroke.
- Scroll sync no longer divides by zero.

**Verified**
- `npm test` passes under Node 24: 45 unit tests.
- `npm run test:browser` passes: the same 45 unit tests + 27 app end-to-end checks (headless Edge, throwaway profile).
- Visually checked a rich sample (title page, dual dialogue, notes, emphasis, sections) in headless Edge.

**Not verified / not done**
- Not tested on a real phone or any browser other than Edge (Chromium).
- Phase 1 is complete (P1-01 to P1-10).

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

## Next steps (in order)

1. **P2-05 Mobile layout** is the biggest gap against the "responsive" promise: the fixed 50/50 split leaves little
   writing room once the keyboard opens. Single pane with a write/preview toggle.
2. **P2-01 / P2-02 / P2-03** (Tab cycling, smart Enter, auto-uppercase): the core "just type" experience. Design
   question to settle first: keep the plain `<textarea>` (Q-001 in DECISIONS.md) and implement these as key handlers.
3. **P3-01** `.fountain` export is a five-minute win worth taking early.

## Open questions for the user

- Is a plain `<textarea>` editor acceptable long term, or is inline styling of the source text (P2-08) a must-have?

---

## Session log

Newest first. Copy the template for each new session.

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
