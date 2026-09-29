# {{PROJECT}} dev diary

Public write-ups of the project's progress, for readers who are not developers. Each entry is an HTML fragment (an
`<article class="dev-diary">`, no page around it) ready to paste into a blog or site; the owner publishes them.

**[index.html](index.html)** lists every entry, newest first. Each entry ends with links to the one before, the index
and the one after. The links are relative, so the files are published together under the same names.

| Date | Entry | Covers |
| --- | --- | --- |
| {{YYYY-MM-DD}} | [{{Title}}]({{YYYY-MM-DD-slug}}.html) | {{what, and which sessions}} |

## Writing an entry

- When a session finishes a feature or milestone a user would notice (CLAUDE.md, session protocol step 5); smaller
  changes wait in HANDOFF's "For the dev diary" list. Source: `docs/SESSION-LOG.md` since the last entry, DECISIONS
  and the git log. Check every claim against the code.
- One file per entry, `YYYY-MM-DD-slug.html`, dated when the work happened (copy `_entry-template.html`). Add it at the
  top of `index.html`, add a row above, and add the "next" link to the entry before it.
- Written for users, not developers: what changed for someone using it, and why; technical detail only where it tells
  a story (a measurement, a bug found). No roadmap IDs or decision numbers. No people's names without permission.
