# Session Handoff

Read this first. It describes the project **as it is right now** and what comes next. It is rewritten at the end of
every session, and nothing in it is history: when something stops being true, change it or delete it.

History (what each session did) is in [SESSION-LOG.md](SESSION-LOG.md). Protocol: [CLAUDE.md](../CLAUDE.md).
Plan: [ROADMAP.md](../ROADMAP.md). Decisions: [DECISIONS.md](DECISIONS.md).

---

## Current state

_Last updated: {{YYYY-MM-DD}}, session {{N}}: {{what this session did, in a few words (IDs, decisions)}}.
{{What is merged into the main branch and what is still on the working branch.}} Tests: {{counts and how long they
take; say plainly if any are failing}}._

**Where things stand:** {{Which phases are done, what is left, and the biggest gap (often not code: "nothing has been
tried on a real phone yet").}}

**What the app does** (ROADMAP has every ticked item)
- **{{Area}}:** {{what a user can do, in a line or two, with the decisions that explain it (D-NNN)}}.

**Not checked yet** (what has only run in tests, and what nobody has seen; prune as things are checked)
- {{e.g. "Only run in headless Chromium: not seen in Firefox or on a real phone."}}

## Gotchas

- {{Traps a fresh session would fall into: flaky tests and why, tools that mangle files, test-page scope clashes.
  Group them (tests, code, storage, environment) once there are more than a handful.}}

## Next steps (in order)

0. **Merge the branch** (the owner does this).
1. {{The owner's hands-on checks: what to try, where, and what to look for.}}
2. **Then the next item, the owner's pick.** Candidates: {{IDs, one line each, roughly by value}}.

**For the dev diary** (smaller changes a user would notice, for the next entry; clear the list when it is written):
{{nothing yet}}.

## Open questions for the owner

- {{Question}} (my recommendation: {{...}})
