# Decisions

Short, append-only record of choices that a future session might otherwise re-litigate. One entry per decision.
Newest at the bottom. To reverse a decision, add a new entry that supersedes it; do not edit the old one.

Format:

```
## D-NNN Title  (YYYY-MM-DD, status: accepted | superseded by D-MMM)
**Context:** why this came up.
**Decision:** what we chose.
**Consequences:** what it costs or constrains.
```

---

## D-001 Static site, no build step  (2026-09-20, status: accepted)
**Context:** The app must be lightweight and easy to open on any device.
**Decision:** Plain HTML/CSS/JS served as static files. No bundler, no framework, no runtime dependencies.
**Consequences:** No `import` of modules over `file://` (browsers block it), so shared code uses classic `<script>`
files. No npm dependencies to install; tooling stays optional.

## D-002 Fountain plain text is the canonical format  (2026-09-20, status: accepted)
**Context:** Writers must own their work.
**Decision:** Store and export Fountain text. Everything else (render, outline, stats) is derived from it.
**Consequences:** Features that need extra per-script metadata must encode it in the text or be kept out of scope.

## D-003 Parser is a UMD module in `src/fountain.js`  (2026-09-20, status: accepted)
**Context:** The parser needs unit tests, and the app cannot use ES modules over `file://` (see D-001).
**Decision:** `src/fountain.js` is a UMD script: `window.Fountain` in the browser, `module.exports` in Node. It has no
DOM access. `parse(text)` returns tokens; `toHTML(tokens)` renders them.
**Consequences:** Tests import the same file the app ships. Keep it free of DOM and Node-only APIs.

## D-004 Spec-strict parsing, leniency added by the editor  (2026-09-20, status: accepted)
**Context:** The prototype guessed (for example, matched `cut to:` in any case). Guessing makes behaviour unpredictable
and untestable.
**Decision:** The parser follows the Fountain 1.1 rules. Where the writer expects leniency (typing lowercase cues),
the *editor* fixes the text (P2-03) so the parser can stay strict.
**Consequences:** Until P2-03 ships, lowercase transitions and character cues render as action. Small allowlist of
common transitions (`FADE OUT.`, `SMASH CUT:` and similar) is kept because writers expect them without a `>` prefix.

## D-005 Keep the existing localStorage keys  (2026-09-20, status: accepted)
**Context:** Users may already have scripts saved by the prototype.
**Decision:** Library stays at `frictionless_scripts`. The last-open pointer is `frictionless_current`.
**Consequences:** The `frictionless_` prefix is legacy naming. Renaming needs a migration.

## D-006 Emptying the editor does not overwrite the saved script  (2026-09-20, status: accepted)
**Context:** With restore-on-load (P1-02), select-all + delete followed by a reload brings the old text back, because
autosave skips blank content.
**Decision:** Keep it. "Never lose words" outranks "the editor should match what I last saw". **New** is the
sanctioned way to start clean, and typing anything into a cleared editor overwrites the script normally.
**Consequences:** A writer can't delete a script's text by emptying the editor. Real deletion belongs to library
management (P3-07), with undo.

## D-007 Tests run in a browser first, Node second  (2026-09-20, status: accepted)
**Context:** The dev machine has no Node or Python (the `python.exe` on PATH is the Microsoft Store stub; PyCharm
does not bundle an interpreter).
**Decision:** Test files are environment-agnostic (`test/harness.js`). `test/index.html` (unit) and
`test/app.e2e.html` (app behaviour) run in any browser; `test/run-headless.ps1` drives them with Edge or Chrome and
needs nothing installed. `test/run.js` covers Node when it exists.
**Consequences:** Always run headless with a throwaway profile (`--user-data-dir`): `file://` pages share
localStorage across the whole origin, so a test could otherwise touch a writer's real scripts. The e2e page also
snapshots and restores the app's keys.

## D-008 Mobile is a CSS media query, mirrored in JS  (2026-09-20, status: accepted)
**Context:** Phones need one pane at a time (P2-05). Layout must not depend on JS having run, but behaviour (focus,
blur, viewport sizing) must know which mode it is in.
**Decision:** `@media (max-width: 767px), (pointer: coarse) and (max-height: 500px)` in the stylesheet decides the
layout. The same string is `MOBILE_QUERY` in the script, used through `matchMedia`. Desktop-first CSS; the mobile
block only overrides. Screenplay indents are CSS variables so mobile swaps `ch` for `%`. Keyboard handling uses
`interactive-widget=resizes-content` plus `visualViewport` (`--app-height`, `--app-top`) for Safari.
In Preview, `.pane-void` is `display: contents` so its menu stays reachable.
**Consequences:** The query is duplicated and must be edited in both places. `display: contents` is load-bearing.
The keyboard code is verified only against a fake viewport until P2-09 is done on real devices.

## Open questions

- Q-001 Should the editor stay a plain `<textarea>` (simple, great on mobile) or move to `contenteditable` / a custom
  editor for inline element styling (P2-08)? Prefer textarea plus an overlay until it proves insufficient.
- Q-002 Sync (Phase 5): local-file-first via the File System Access API, or hosted accounts?
