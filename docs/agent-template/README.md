# Agent project template

A starting kit for a project built in short sessions with an AI coding agent, where the agent's context resets
between sessions and **the repo carries the memory**. Distilled from Plainchant's own docs (this repo).

## What is here

| File | Role | Who writes it |
| --- | --- | --- |
| `CLAUDE.md` | The agent's standing instructions: session protocol, layout, conventions, how to test | Both; kept true |
| `ROADMAP.md` | The plan, every item with a permanent ID | Both; items ticked, never renumbered |
| `docs/HANDOFF.md` | Current state (rewritten every session), next steps, gotchas, session log (append-only) | The agent, every session |
| `docs/DECISIONS.md` | Why things are the way they are (append-only) | The agent, whenever a choice could be questioned |
| `docs/devlog/` | A public diary for non-developers, one HTML fragment per entry, with an index | The agent, per feature or milestone |

## How to start a project with it

1. Copy this folder's contents to the root of the new repo (keep the `docs/` layout).
2. Replace every `{{...}}` placeholder. Search for `{{` to find them all.
3. Write the first roadmap phase with the owner, then ask the agent to "read CLAUDE.md and HANDOFF, then do P1-01".
4. Delete sections that do not apply (the devlog, the web-only notes), but keep the session protocol.

## The rules that made it work

- **One item at a time, by ID**, in the commit message too. The owner picks the next item; the agent proposes.
- **Handoff docs that lie are worse than none.** "Current state" is rewritten, not appended to, at the end of
  every session. The session log below it is history and is never rewritten.
- **Decisions are append-only.** To reverse one, add a new entry that supersedes it.
- **Tests before "done"**, and the tests are tested: break the new code one line at a time (mutation testing) and
  check a test fails each time. A break that survives is a missing test or a line that was never needed.
- **Say what was not verified.** Every "What works" has a matching "Not verified" (real devices, other browsers).
- **The owner merges.** The agent works on its branch, pushes, and gives the merge command; it never force-pushes.
