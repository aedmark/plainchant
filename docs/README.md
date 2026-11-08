# Documentation map

This directory stores durable project knowledge. Each fact has one authoritative home; other documents link to it
instead of copying it (D-069).

## Audiences and ownership

| Document | Primary audience | Owns | Does not own |
| --- | --- | --- | --- |
| `../README.md` | Writers and newcomers | Purpose, quick start, public entry points | Internal workflow or session state |
| `../AGENTS.md` | Coding agents and the owner | Standing rules, authority, preferences, protected areas, the code layout and conventions | Feature history or design rationale |
| `../CLAUDE.md` | Claude Code | A pointer that imports `AGENTS.md` | Anything else |
| `../ROADMAP.md` | The owner and contributors | Planned scope and status, with stable IDs | Implementation notes |
| `HANDOFF.md` | The next work session | Current state, what is unverified, gotchas, next steps (the present only, D-058) | History, permanent design rules |
| `SESSION-LOG.md` | Anyone asking what happened | One entry per session, newest first, append-only | What is true now |
| `ARCHITECTURE.md` | Developers | System shape, invariants, boundaries, state, failure modes, claims that outrun the code | Chronological history |
| `DECISIONS.md` | Future decision-makers | Rationale and alternatives for durable choices, held tensions, open questions | Routine implementation detail |
| `TESTING.md` | Contributors | Commands, what each suite proves and does not, pitfalls | Current test counts (HANDOFF's Verified table) |
| `SECURITY.md` | Users and developers | Assets, trust boundaries, secure defaults, reporting | Incident history |
| `CONTRIBUTING.md` | Contributors | Setup, change, review and submission workflow | Agent-only instructions |
| `CHANGELOG.md` | Writers | User-visible changes, newest first | Commit-by-commit history |
| `devlog/` | Writers and readers of the diary | Public write-ups, one HTML fragment per entry (D-053) | Developer detail |
| `manual/` | Writers | A standalone HTML manual and codex (`index.html`, `codex.html`); not read by `tools/check_docs.py` | The rules in `AGENTS.md` |
| `archive/` | Anyone searching for old reasons | Historical session logs and finished roadmap phases | Anything current |

## Update triggers

Update documents because a relevant fact changed, not merely because a session ended.

| Change | Required documentation |
| --- | --- |
| User-visible behaviour | README if onboarding changed; CHANGELOG; Help (`app.html`) and the dev diary (AGENTS.md, ending a session) |
| Component, interface, dependency or data-flow change | ARCHITECTURE |
| Durable trade-off or reversal, or a tension held or resolved | DECISIONS; mark the old decision superseded, or resolve the held tension |
| Test command, coverage, fixture or environment change | TESTING |
| Secret, trust boundary, sensitive data or reporting-path change | SECURITY |
| Work pauses with context another session needs | HANDOFF |
| Contribution or release workflow change | CONTRIBUTING and, if agents are affected, AGENTS |
| New planned work | ROADMAP, with origin and acceptance evidence |
| A session ends | HANDOFF (rewritten), SESSION-LOG (new entry), ROADMAP (ticks) |

## Optional documents

Create these only when needed, and add them to the table above: `GLOSSARY.md` when the "Names and terms" table in
`AGENTS.md` outgrows it; `runbooks/` for repeatable procedures with prerequisites, rollback and verification;
`SUPPORT.md` or a code of conduct if the project takes outside contributors.

## Style and evidence

- Lead with the reader's task or the current truth. Declarative present tense; no em dashes in new prose.
- Use exact commands and repository-relative paths. Label examples as examples.
- Date volatile observations and name the environment or commit when it affects reproducibility.
- Link to the source of truth instead of restating it. If duplication is necessary, say which copy is canonical.
- Keep real scripts, personal information and secrets out of documentation and fixtures.
