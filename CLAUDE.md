# Plainchant

Lightweight, responsive screenwriting app: the writer types Fountain-style plain text, the app handles formatting.
Built for writers who would rather write than fuss over format. Static HTML/CSS/JS, no build step, no runtime
dependencies (see docs/DECISIONS.md). The project folder is still called NeuroFountain (its former working name).

## Session protocol

Sessions are short-lived and context resets between them, so the repo carries the memory.

**Start of every session**
1. Read `docs/HANDOFF.md`: "Current state" and the latest session-log entry.
2. Read `ROADMAP.md` for the item(s) you are about to work on. Skim `docs/DECISIONS.md` if you are about to make a
   design choice.
3. Confirm the plan with the user in one or two lines, then work on roadmap items by ID.

**While working**
- Work one roadmap item at a time; keep each commit scoped to it. Reference IDs (`P1-06`) in commit messages.
- If you make a choice a future session might question, add an entry to `docs/DECISIONS.md`.
- If you discover new work, append a new item to ROADMAP.md (never renumber existing IDs).
- Run the tests before declaring anything done (see below).

**End of every session (or when the user says to wrap up)**
1. Tick / update items in `ROADMAP.md`.
2. Rewrite the **Current state** and **Next steps** sections of `docs/HANDOFF.md` so they are true right now.
3. Add a session-log entry at the top of the log using the template in HANDOFF.md.
4. Never leave "Current state" describing something that is no longer true. Handoff docs that lie are worse than none.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | The app: markup, styles, UI glue |
| `src/fountain.js` | Fountain parser + HTML renderer. Pure, UMD, no DOM (D-003) |
| `src/editing.js` | Typing helpers (Tab, smart Enter, auto-uppercase): text + caret in, edit out. Pure, UMD (D-010) |
| `test/` | `fountain.test.js` (parser), `editing.test.js` (typing helpers), `app.e2e.html` (app behaviour), `harness.js`, runners: `index.html`, `run-headless.ps1`, `run.js` |
| `ROADMAP.md` | The plan, with stable item IDs |
| `docs/HANDOFF.md` | Current state, next steps, session log |
| `docs/DECISIONS.md` | Append-only decision record |

## Conventions

- Vanilla JS, no frameworks. Modern syntax is fine (evergreen browsers).
- Classic `<script>` files, not ES modules (`file://` blocks module imports).
- The parser must never touch the DOM, `window` or Node-only APIs. Escape all user text before it reaches HTML.
- Match existing CSS variable names and class names (`script-*` for rendered screenplay elements).
- Do not change the localStorage keys without a migration (D-005).

## Running and testing

- App: open `index.html` directly in a browser, or serve the folder statically.
- Tests (Windows, nothing to install): `npm run test:browser`, or directly
  `powershell -NoProfile -ExecutionPolicy Bypass -File test/run-headless.ps1`. Runs the unit suite and the app e2e in
  headless Edge/Chrome with a throwaway profile; exit code 0 = pass.
- Or open `test/index.html` (unit) / `test/app.e2e.html` (app, needs http or `--allow-file-access-from-files`) in a
  browser; a green banner means pass.
- `npm test` runs `test/run.js` under Node (unit suite only; needs Node 18+, developed on 24). If `node` is not
  found in a session that was already open when Node was installed, refresh PATH or restart the session.
- Never run a headless browser against `file://` pages with your real profile. See D-007.
- When you add a parser rule, add a test in `test/fountain.test.js` first. When you change app behaviour (restore,
  save, library), extend `test/app.e2e.html`.
