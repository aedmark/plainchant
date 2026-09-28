# Plainchant dev diary

Public write-ups of the project's progress, for readers who are not developers. Each entry is an HTML fragment (an
`<article class="dev-diary">`, no page around it) ready to paste into a blog or site; the owner publishes them. The
format follows the owner's template (D-053).

**[index.html](index.html)** is the diary's front page: every entry, newest first, with a line about each. Each
entry ends with links to the one before, the index and the one after. The links are relative, so the files are
published together under the same names.

| Date | Entry | Covers |
| --- | --- | --- |
| 2026-09-20 | [Writing Before Formatting](2026-09-20-writing-before-formatting.html) | The prototype, the repo's memory, the parser, never losing words, phones and tablets, typing helpers (sessions 1 to 3) |
| 2026-09-20 | [A Name and a Front Door](2026-09-20-a-name-and-a-front-door.html) | Tour and Help, the name, the Library, export and import, the split into files (sessions 4 to 9) |
| 2026-09-25 | [Somewhere Safer for the Words](2026-09-25-somewhere-safer-for-the-words.html) | Autocomplete, IndexedDB, the emergency buffer, no legacy support (sessions 10 to 12) |
| 2026-09-25 | [Paper](2026-09-25-paper.html) | Print and PDF on the Courier grid (session 12) |
| 2026-09-26 | [Sixteen Small Things](2026-09-26-sixteen-small-things.html) | Stats, outline, focus, colour hints, versions, offline, settings, themes, accessibility (session 13) |
| 2026-09-27 | [For the Narrators](2026-09-27-for-the-narrators.html) | Read-aloud time, video chapters, the retro theme, adventure commands, browsers (sessions 14 to 16) |
| 2026-09-27 | [Real Files and Final Draft](2026-09-27-real-files-and-final-draft.html) | Fast typing, comparing versions, screen reader and thank-you, real files, Final Draft export and layout (sessions 17 to 23) |

## Writing an entry

- Only when the owner asks, usually after a milestone. Source: the session log in `docs/HANDOFF.md` since the last
  entry, DECISIONS, and the git log. Check every claim against the code.
- One file per entry, `YYYY-MM-DD-slug.html`, dated when the work happened. Add it at the top of `index.html` (date,
  title, one line), add a row to the table above, give it the same `<nav class="dev-diary-nav">` as the others, and
  add the "next" link to the entry before it.
- Structure as the others: `<header>` with `<h1>Plainchant Dev Diary: Title</h1>`, the date, the repo link; a short
  opening; `<h2>` sections in plain words; then **Where the Project Stands**, **Next: ...** and the nav.
- Written for writers, not developers: what changed for someone using the app, and why; technical detail only where
  it tells a story (a measurement, a bug found). No roadmap IDs or decision numbers.
- No names of people: the creator thanked in Help is described, not named (D-045 keeps the name to Help).
