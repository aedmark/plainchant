# Session Handoff

Read this first. It is rewritten at the end of every session so the top half is always true *right now*.
The session log below it is append-only history.

Protocol: see [CLAUDE.md](../CLAUDE.md). Plan: [ROADMAP.md](../ROADMAP.md). Decisions: [DECISIONS.md](DECISIONS.md).

---

## Current state

_Last updated: {{YYYY-MM-DD}}, session {{N}}: {{what this session did (IDs, decisions)}}. {{What is merged into the
main branch and what is still on the working branch.}} Tests: {{counts and how long they take}}._

**Where things stand, in one paragraph:** {{Which phases are done, what is left, and the biggest gap (often not
code: "nothing has been tried on a real phone yet").}}

**What works**
- **{{Feature}}** ({{IDs, decisions; main files}}). {{What a user can do, in plain words; its limits.}}

**Not verified** (say what has only run in tests, and what nobody has seen)
- {{e.g. "Only run in headless Chromium: not seen in Firefox or on a real phone."}}

**Gotchas for the next session**
- {{Traps a fresh session would fall into: flaky tests and why, tools that mangle files, test-page scope clashes.}}

## Next steps (in order)

0. **Merge the branch** (the owner does this).
   **For the dev diary** (smaller changes a user would notice, for the next entry; clear the list when it is
   written): {{nothing yet}}.
1. {{The owner's hands-on checks: what to try, where, and what to look for.}}
2. **Then the next item, the owner's pick.** Candidates: {{IDs, one line each, roughly by value}}.

## Open questions for the owner

- {{Question}} (my recommendation: {{...}})

## Session log

### Template

```
### Session N: YYYY-MM-DD: short title

**Goal:**
**Done:** roadmap IDs
**Changed:** files / behaviour
**Decisions:** D-numbers added
**Verified:** tests, and mutation runs (how many breaks, how many caught; what survived and why)
**Problems / surprises:**
**Left undone:**
**Next session should start with:**
```
