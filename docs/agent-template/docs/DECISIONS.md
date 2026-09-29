# Decisions

Short, append-only record of choices that a future session might otherwise re-litigate. One entry per decision.
Newest at the bottom. To reverse a decision, add a new entry that supersedes it; do not edit the old one (an
"Update, same session" note at the end of an entry is fine while it is still on the working branch).

Format:

```
## D-NNN Title  (YYYY-MM-DD, status: accepted | superseded by D-MMM)
**Context:** why this came up.
**Decision:** what we chose (numbered points if there are several).
**Consequences:** what it costs or constrains; what was left out and why.
```

---

## D-001 {{The first architectural choice, e.g. "Static site, no build step"}}  ({{YYYY-MM-DD}}, status: accepted)
**Context:** {{...}}
**Decision:** {{...}}
**Consequences:** {{...}}

## Open questions

- {{Q-001 A question the owner has not answered yet.}} (answer it here with the decision number when it is settled)
