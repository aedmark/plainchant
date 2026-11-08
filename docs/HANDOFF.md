# Session Handoff

Read this first. It describes the project **as it is right now** and what comes next. It is rewritten at the end of
every session, and nothing in it is history: when something stops being true, change it or delete it. "Current state"
fits in about 80 lines; what does not fit is history (SESSION-LOG) or design (ARCHITECTURE).

History (what each session did) is in [SESSION-LOG.md](SESSION-LOG.md). Protocol: [AGENTS.md](../AGENTS.md).
Plan: [ROADMAP.md](../ROADMAP.md). Architecture: [ARCHITECTURE.md](ARCHITECTURE.md). Decisions:
[DECISIONS.md](DECISIONS.md). Tests: [TESTING.md](TESTING.md). Security: [SECURITY.md](SECURITY.md). Changes:
[CHANGELOG.md](CHANGELOG.md). Older material: [archive/](archive/README.md). The writer-facing story:
[devlog/](devlog/).

---

## Current state

_Last updated: 2026-11-08, session 34, on `master`: the Manifold adoption (Phase 8, D-069) is under way. P8-01 to P8-09
are done: `AGENTS.md` is the canonical instruction file, and ARCHITECTURE, TESTING, SECURITY, CONTRIBUTING, CHANGELOG,
the docs map and the archive exist. The linter upgrade (P8-10) and the consolidation (P8-11) are left. No app code
changed. `index.html` and `src/home.css` carry the owner's uncommitted edits._

**Session owner:** none. The last session was the Manifold adoption; nothing is held.

**Verified** (2026-11-08, on `a4fe0f5`, Arch Linux, Node 22.23, Google Chrome 157 headless): every row was run this
session.

| Suite | Result |
| --- | --- |
| `npm test` (Node: unit and structure) | **343/343** |
| `npm run test:browser`, unit | **331/331** |
| `npm run test:browser`, e2e | **742 passed, 0 failed** |
| `python3 tools/check_docs.py` | **0 errors, 0 warnings** |

**Where things stand:** Phases 1 to 4 are done apart from an optional idea (P2-20 first-use hints). Phase 3's output is done (Fountain and Final Draft export, print / save as
PDF, the page view while writing); what is left there is optional (P3-09, P3-10, P3-14). Phase 5 has real files on
disk (P5-01, Chromium only); cloud sync and sharing (P5-02, P5-03) are not planned. The owner dropped the brand and
Apple-platform phases and the device-pass items from the roadmap on 2026-09-29. The biggest gap is not code: most
features have only run in headless Chromium and the owner's Firefox, so the owner's hands-on checks (Next steps 1)
matter more than the next feature.

**Front door:** `index.html` is a five-page screenplay on warm paper sheets (P6-01, D-061 to D-063). It needs no
JavaScript and loads no new files; the owner edits it by hand.

**What the app does** (ROADMAP has every ticked item; the detailed notes as of session 29 are frozen at the end of
SESSION-LOG.md)
- **Writing:** Fountain text in a textarea with colour hints behind it (D-031, D-065); in-script Find & Replace with
  match highlights and undoable single or bulk replace (`Ctrl/Cmd+F`, `Ctrl/Cmd+H`, D-064); a live preview patched block
  by block (D-043) or shown as printed sheets (page view, D-054); caret-anchored scroll sync and Canvas-to-Void
  paragraph line highlight (D-066); on a desktop the editor, the preview or both (D-056); quick edits in the preview by
  double-click or press-and-hold (D-057). Under 1024px, one pane at a time (Void | Canvas, D-060).
- **Typing helpers:** Tab cycles elements, smart Enter, capitals as you type, character names guessed on Enter, the
  element bar, autocomplete chips for names, places and times of day (D-010, D-017, D-036, D-037); focus mode (D-025);
  the caret kept clear of the on-screen keyboard (D-030); tapping the one-pane preview goes to that line (D-033).
- **Library and storage:** IndexedDB (database `plainchant`, version 3), an emergency buffer for a tab closed
  mid-write, other tabs told of every change (D-018 to D-020); search, rename, duplicate, delete with 30-day restore
  (D-013); versions with scene-by-scene compare (D-034, D-044); asking the browser to keep the library (D-027).
- **In and out:** import `.fountain` / `.txt` / `.md` (D-016); download `.fountain` or `.fdx` (D-049, D-052); print /
  save as PDF on Letter or A4 (D-021, D-022, D-051); scripts linked to real files on disk, Chromium only (D-046).
- **Around the script:** stats with scenes, locations and the scene mix (D-023, D-028, D-029); the Outline (D-024);
  dockable Outline and Script stats drawer in the Canvas pane (`Ctrl/Cmd+Shift+O`, D-067); read-aloud time and YouTube
  chapters for narrated videos (D-038).
- **Everything else:** Settings (D-032); dark, light, retro (CGA) and system themes, text size, an accessibility sweep
  in the e2e (D-035, D-041, D-047); the welcome tour and Help (D-011); offline and installable when served (D-026);
  adventure-game replies in the retro theme (D-042, an Easter egg, not in Help).

**Not verified** (the tests cannot, or have not; T-002)
- **Real touch devices (Android):** keyboard room at the bottom of a long script, tapping the preview, quick edits by
  press-and-hold (does Android's own long-press menu compete?), soft-keyboard Enter and composition (GBoard may delay
  auto-uppercase), the element bar keeping the keyboard up. The owner reported in September that the app works on
  their tablet and that import, export and real files work on Android, without these specifics.
- **Firefox:** the owner reports it works well, but quick edits (P2-24), the panes switch (P2-23) and the page view's
  scaling (CSS `zoom`, P3-12) were built after that report and have not been seen there.
- **Quick edits (P2-24):** two tests are missing (session 28's mutation run): a finger that moves while holding
  cancels the hold (scrolling never opens the box), and a mouse held down never opens it (selecting text).
- **Final Draft export** has never been opened in Final Draft.
- **Versions on a real library:** the database upgrades (to version 2, then 3) have only run in fresh test profiles.
  With two tabs open, the older tab loses its database when the newer one upgrades (reload it).
- **Persistent storage** has not met a real browser's yes: Firefox's prompt, an installed copy in Chrome.
- **Narration:** 150 words a minute, counting words only, is an estimate; no chapter list has been pasted into
  YouTube yet.
- **Printing** has only run in headless Chromium, deliberately: the owner chose (2026-09-26) to assume it works until a
  bug report says otherwise.
- **Also unobserved:** a real tab closed mid-write; colour hints with IME or dictation; Windows high-contrast mode; a
  screen reader hearing the autocomplete chips; the ad-blocker fix (D-055) confirmed with the owner's blocker on; the
  Windows test runner (not run since session 11).
- Whether Enter / Tab, name guessing and Tab-takes-the-suggestion *feel* right is the owner's judgement (Settings can
  switch most of it off).

## Gotchas

- **Tests:** pitfalls and how to run them are in [TESTING.md](TESTING.md); app-code and storage traps are in
  [ARCHITECTURE.md](ARCHITECTURE.md), "Working rules for app code and storage".
- The owner works on Arch Linux: `npm run test:browser` runs the Linux runner. `origin` is
  `https://github.com/aedmark/plainchant.git`. There is no `gh` CLI; GitHub-side changes are the owner's.
- The owner also commits from PyCharm, often with one-word messages ("0", "copy"). Commits between sessions get a short
  entry in SESSION-LOG, written by whoever notices.
- The old name (NeuroFountain) appears in DECISIONS and the session log as history: never bulk-replace it.

## Next steps (in order)

0. **Finish Phase 8:** P8-10 (upgrade `tools/check_docs.py`: `T-` checks, invisible characters, the new documents, a
   log limit, planted-failure test), then P8-11 (consolidation, a SESSION-LOG entry for session 34). Then P8-12 once
   Q-004 is answered.

1. **The owner's hands-on checks,** each a few minutes (whatever feels wrong is the next session's first job):
   - After a day of writing, **Library > Versions** on a real script: Go back, then Ctrl+Z.
   - **On an Android phone or tablet:** type at the bottom of a long script (three lines of room above the keyboard?);
     tap a line in Preview (does the keyboard come up?); press and hold a line for a quick edit; Focus mode; the times
     of day offered after `INT. X - `.
   - **In Firefox:** double-click a line for a quick edit; the panes switch; the page view (does it scale?), and typing
     on a long script with it on (does the short pause feel right?).
   - **Name guessing:** write normally for a while. If Enter ever takes an action line for a character, the planned fix
     is to require a known name for single words (D-036).
   - **Firefox's "keep your data" prompt:** does it appear, and what does the foot of the Library say after?
   - **Narration:** read a page aloud against a clock and set that speed in Settings; paste the chapters into an
     unlisted YouTube upload and see whether YouTube accepts them.
   - If anyone you send scripts to has Final Draft, a real `.fdx` opened there.
2. **Small loose end:** the two quick-edit tests listed under "Not checked yet".
3. **Then the next feature, the owner's pick.** Candidates: **P3-14** importing `.fdx`; **P3-09 / P3-10** Library and
   export extras; **P5-04** real-file extras; **P2-20** first-use hints.

**For the dev diary:** nothing waiting (Phase 8 changes no writer-visible behaviour); the 2026-10-31 entry, "A Screenplay in Five Pages", covers the homepage's redesign.

The latest entry, "Touching Up the Page", covers everything up to session 28.

## Open questions for the owner

Blocking: Q-004 (is the `src-tauri/` wrapper a supported target? blocks P8-12). Held tensions: T-001, T-002. The
rest are product questions, not yet in DECISIONS.

- Is the tour the right length and tone (four steps)? It has not been revised since session 8.
- Enter after an action line starts a new paragraph (Shift+Enter for a line break): the right default? (Switchable,
  D-032.)
- Name guessing on Enter (D-036): does it guess wrong in real writing?
- Tab takes the first suggestion (names, places, times of day, D-037): right?
- Should the preview follow the theme (a dark page), or stay paper as now (D-035)?
- Narration (D-038): is 150 words a minute the right default; should chapters also be offered from scenes (for scripts
  with no sections); should the header's page count show the read-aloud time for narrated scripts?
