# {{PROJECT}}

{{One paragraph: what it is, who it is for, and the technical shape (e.g. static site, no build step).}}

## Session protocol

Sessions are short-lived and context resets between them, so the repo carries the memory.

**Start of every session**
1. Read `docs/HANDOFF.md` (current state, gotchas, next steps) and the latest entry in `docs/SESSION-LOG.md`.
2. Read `ROADMAP.md` for the item(s) you are about to work on. Skim `docs/DECISIONS.md` if you are about to make a
   design choice.
3. Confirm the plan with the owner in one or two lines, then work on roadmap items by ID.

**While working**
- Work one roadmap item at a time; keep each commit scoped to it. Reference IDs (`P1-06`) in commit messages.
- If you make a choice a future session might question, add an entry to `docs/DECISIONS.md`.
- If you discover new work, append a new item to `ROADMAP.md` (never renumber existing IDs).
- Measure before optimising; check a claim against the code before writing it down.
- Run the tests before declaring anything done (see below). Then test the tests: break the new code one line at a
  time and check that some test fails each time. A mutation script must restore the file even when interrupted, and
  nothing is committed while a mutated file is on disk (check `git diff` after any interrupted run).

**End of every session (or when the owner says to wrap up)**
1. Tick / update items in `ROADMAP.md`.
2. Rewrite the **Current state** and **Next steps** sections of `docs/HANDOFF.md` so they are true right now.
   HANDOFF holds only the present and the plan: no session history, no "done in session N".
3. Add an entry at the top of `docs/SESSION-LOG.md` using the template there.
4. Never leave "Current state" describing something that is no longer true. Handoff docs that lie are worse than none.
5. Track the work in the dev diary (`docs/devlog/`, see its README). A session that finishes a feature or milestone a
   user would notice gets an entry of its own. Smaller changes a user would notice are listed under "For the dev
   diary" in HANDOFF's Next steps and go into the next entry, which then clears that list.

## Git

- Develop on `{{branch}}`; push with `git push -u origin {{branch}}`. The owner merges into `{{main}}` and says so;
  then catch up with `git fetch origin && git merge --ff-only origin/{{main}}`.
- After pushing, give the owner the merge command: `git fetch origin && git merge origin/{{branch}} && git push`.
- Never force-push or rewrite history. Commit finished, tested work without asking.

## Layout

| Path | Purpose |
| --- | --- |
| `{{path}}` | {{what it owns; the decision that explains it (D-NNN)}} |
| `ROADMAP.md` | The plan, with stable item IDs |
| `docs/HANDOFF.md` | Current state, what is not checked yet, gotchas, next steps, open questions: the present only |
| `docs/SESSION-LOG.md` | Append-only history, one entry per session, newest first |
| `docs/DECISIONS.md` | Append-only decision record |
| `docs/devlog/` | The public dev diary: one HTML fragment per entry and `index.html` listing them |

## Conventions

- {{Language, style and framework rules, e.g. "Vanilla JS, no frameworks".}}
- {{Targets: which browsers / platforms are supported, and which are explicitly not (and where that is recorded).}}
- {{Architecture rules a future session must not break, each with its decision number.}}
- {{Storage / data rules: where data lives, what may write it, whether legacy formats are supported.}}
- Name files for what they are, and not like trackers if the project runs in a browser: ad blockers refuse files
  called `pageview.js`, `analytics.js`, `ads.js` and the like, and headless tests never notice.

## Running and testing

- Run: `{{command}}`.
- Tests: `{{command}}` (what it covers), `{{command}}` (what it covers). Exit code 0 = pass.
- {{Where each kind of test goes: "a parser rule gets a unit test first; app behaviour gets an end-to-end check".}}
- {{Known slow or timing-sensitive tests, and what to do when they fail under load.}}
