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

## D-009 Tablets: one pane below 1024px, screenplay responds to its column  (2026-09-20, status: accepted; supersedes the 767px breakpoint and phone-only indent overrides in D-008)
**Context:** The most likely writer is on a tablet. Measured at iPad sizes, the split layout was broken, not just
cramped: the two panes could not be narrower than 1109px (a `nowrap` transition line set the preview's minimum
width), so on every iPad in portrait the right 300px+ of the preview was clipped off-screen. That predates D-008
(the prototype's 768px breakpoint had it) but D-008 left it in place and I hadn't tested tablet widths.
**Decision:**
1. One pane at a time (top bar with Write | Preview) below 1024px, so portrait tablets get the phone pattern. From
   1024px (iPad landscape and up) keep the split. Landscape phones still count as one-pane.
2. From 700px within one-pane mode (tablet tier) the five actions sit inline in the bar instead of behind the ⋯
   menu, and the editor text is held to about 44rem in the middle of a full-width, fully tappable box.
3. The screenplay's responsiveness follows the width of the preview column, not the device: `#render-target` is a
   size container (`container: sheet / inline-size`) and `@container sheet (max-width: 36rem)` swaps character-count
   indents for percentages, wraps transitions and stacks dual dialogue; below 26rem the type steps to 14px. 36rem is
   60ch at 12pt, a true page. A tablet in portrait therefore gets the real page; a phone or a narrow split gets the
   compressed one; iPad Split View / Slide Over windows work without special cases.
4. Panes get `min-width: 0`; the preview's container is inline-size-contained. Either alone stops content from
   forcing a pane wider than the screen.
5. Any touch device (`pointer: coarse`), in any layout, gets a visualViewport-fitted body, 44px buttons and a 16px
   editor. `FIT_QUERY` mirrors the CSS.
**Consequences:** Two media queries are mirrored in JS (`MOBILE_QUERY`, `FIT_QUERY`); change both sides together.
A desktop window narrower than 1024px switches to one-pane mode. The `@container` rules require Chrome 105 /
Safari 16 / Firefox 110 or newer. `min-width: 0` is currently redundant with the container containment; it stays as
a second guard.

## D-010 Typing helpers: pure edit-returning module, applied through execCommand, explicit cues  (2026-09-20, status: accepted)
**Context:** The "just type" promise (P2-01..P2-03, P2-11). The editor is a plain `<textarea>` (Q-001), which is best
on touch, so the helpers are key handlers rather than a rich editor.
**Decision:**
1. `src/editing.js` is pure (D-003 style, UMD, no DOM). Each function takes text and caret and returns an *edit*
   `{from, to, insert, selStart, selEnd}`. The page applies it with `document.execCommand('insertText')`, which keeps
   the browser's undo history; assigning `.value` or `setRangeText` would wipe it. If `execCommand` fails the text
   is still set correctly (without undo).
2. What a line *is* comes from the real parser (`Fountain.classifyLines`), asked twice: once with a blank line after
   the current line and once with text after it, because the parser needs to see what follows before it will call
   something a cue or a transition. Sentence punctuation (`BANG!`, `SILENCE.`) reads as action, not a cue.
3. **Enter** is smart only at the end of a block at the end of the script or before a blank line: after a cue or a
   parenthetical it moves to the next line (the speech), after anything else it leaves a blank line (new element).
   Mid-block, mid-line, selections and **Shift+Enter** are left to the browser. Implemented on `beforeinput`, not
   `keydown`, because soft keyboards report Enter reliably only there. **This changes what Enter does after an action
   line: it starts a new paragraph. Shift+Enter is the plain line break.**
4. **Tab / Shift+Tab** cycle action -> character -> scene heading -> transition (inside a dialogue block: dialogue <->
   parenthetical). Converting keeps the words and changes their markers: uppercase, `INT. `, `( )`, and a forced
   marker (`!`, `@`, `.`, `> `) only when the plain form would parse as something else. A step that is impossible for
   the text (a line ending in `TO:` cannot be a cue) is skipped, so Tab never stalls. `Esc` then `Tab` moves focus out
   of the editor so keyboard users are not trapped.
5. A **blank line cannot say what it is**, so choosing an element there sets a per-line *mode* held by the page
   (`elementMode`): typed text is uppercased, `INT. ` is pre-filled for scenes, Enter finishes the line. Moving the
   caret to another line drops the mode.
6. **Cues are explicit.** There is no guessing that "john" is a character. The writer presses Tab (or the
   Character button); after that, uppercasing and Enter are automatic. Auto-uppercase without a mode is limited to
   what is unmistakable: `int.`/`ext.`/`est.`/`i/e` scene prefixes and `... to:` transitions, only at a line end,
   only after a blank line, only when *typing* (not paste, undo or IME composition).
7. The **element bar** under the editor shows the current element and changes it. It is shown in every layout, uses
   short names on phones, never takes focus from the editor (`mousedown` is cancelled so the keyboard stays up), and
   is hidden while previewing.
**Consequences:** Enter and Tab behave differently from a plain textarea; a writer who dislikes that needs a setting
(not built). Parsing for the current line runs on every caret move over a window of up to ~80 lines above it
(cheap; the full re-render per keystroke is the bigger cost, P4-01). `execCommand('insertText')` is deprecated but
has no replacement that preserves undo. Soft keyboards, Scribble and IME composition are handled by design
(`beforeinput`, `isComposing` checks) but not yet observed on a device (P2-09).

## D-011 Onboarding: a short welcome tour, a Help window, one shared dialog helper  (2026-09-20, status: accepted)
**Context:** New writers need to learn what the app does, that Tab / the element bar tell it what they are writing,
and that scripts live only in this browser. The app is meant to stay lightweight and out of the way.
**Decision:**
1. **Welcome tour**: four short steps in a dialog, shown once on first launch (localStorage `frictionless_onboarded`
   holds the tour version seen; bump `TOUR_VERSION` to show a revised tour to everyone), skippable at any point
   (Esc, x or Skip all count as seen), replayable from Help. It ends with **Start writing** or **Open the example
   script**. Wording adapts by device with CSS only (`@media (pointer: coarse)` swaps the keyboard hint for the
   touch hint). Its "You get" sample is rendered by the real parser. It is *not* shown if storage is unavailable
   (it could never be remembered, so it would nag every load).
2. **No spotlight / coach-mark tour.** Pointing at real UI elements would break across the three layouts (split,
   one-pane tablet, phone) and is fragile to maintain. Dialogs work everywhere.
3. **Help window** with four topics (Start here, Screenplay elements, Keys & touch, Troubleshooting). Opens from the
   Help button (a `?` where actions sit in a row, the word "Help" in the phone menu), F1, Ctrl/Cmd+/, and a `?` at
   the end of the element bar that jumps to the elements topic. In the Void/Canvas voice, but always with the plain
   Write/Preview words too.
4. **The cheat sheet is tested against the parser.** Every example carries `data-expect="scene,blank,..."` (the
   parser's per-line type) and the e2e suite runs each through `Fountain.classifyLines`. If the parser changes, the
   help must change with it or the build fails.
5. **One dialog helper** (`openModal` / `closeModal`) for Library, Help and the tour: role=dialog, aria-modal and
   labelled; focus moves in and Tab wraps; Esc or a backdrop click closes the top dialog; focus returns to the
   opener (or the menu button / editor if the opener is hidden). The Library, which had none of this, was moved
   onto it and its items became keyboard-operable.
6. The **example script** is a real script (saved straight into the Library), edited freely, showing every element.
   There is no delete yet, so examples accumulate until P3-07 (library management).
7. Copy avoids the product name: the page title says "SLASH", the repo says "NeuroFountain", and the panes say
   "Void" / "Canvas". Naming is the owner's call (open question in HANDOFF).
**Consequences:** Every test frame must set the `frictionless_onboarded` key first or a tour opens in it (the e2e
suite does). New user-visible features should get a line in Help. The inline app script keeps growing (~1500 lines):
splitting it into files is P4-08.

## D-012 The product is called Plainchant  (2026-09-20, status: accepted; resolves the naming point in D-011 item 7)
**Context:** Three names were in circulation: the page title ("SLASH Frictionless Screenwriter"), the repo
("NeuroFountain") and the pane names ("The Void" / "The Canvas"). A real app called "Fountain" already exists on the
App Store, next to a crowded field (Slugline, Highland, Beat, Fade In, Arc Studio). The audience is writers, many
neurodivergent, who get stuck on formatting and want to write; the tone is calm and whimsical.
**Decision:** **Plainchant.** Plainchant is unornamented, single-line, unaccompanied singing; plain text (Fountain)
works the same way, and the formatting is layered on afterwards. It is calm, a little whimsical, and it evokes
vellum manuscripts without the collision below.
**Considered and dropped, and why (web search, 2026-09-20):** Vellum (a well-known Mac book-*formatting* app, the
opposite of the pitch), Deckle (novel writing and formatting app, launched June 2026), Foolscap and Dormouse (both
already "quiet writing apps"), Inkling (novel apps), Rill (several apps), Paper Boat (a major Indian beverage brand;
also little to do with screenwriting), Plainsong (the same music, but two apps already use it: a macOS Markdown
editor and a dictation app). Ebb, Eddy and Lull surfaced nothing but are generic words that are hard to own.
**Checks done, and their limits:** no writing or screenwriting app called Plainchant surfaced; the only software hit
is a small open-source imageboard (GitHub `jgbyrne/plainchant`). `plainchant.com` and `.co` are registered;
`plainchant.app`, `.io` and variants such as `getplainchant.*` returned no DNS answer (not proof of availability:
confirm at a registrar). **No trademark clearance was done.** A search engine and a DNS lookup are a sanity check,
not legal advice.
**Where the name now appears:** page title ("Plainchant: screenwriting without the formatting"), the welcome dialog,
the first line of Help and a one-line note on what the word means, `package.json`, doc headings, test page titles. An
e2e check fails if "NeuroFountain" or "SLASH" reappears in `index.html`.
**Deliberately unchanged:** the project folder is still `NeuroFountain` (renaming it disturbs the PyCharm project;
the owner's call), the `frictionless_*` storage keys (D-005), and the Void / Canvas pane names.
**Consequences:** Domain registration, trademark search and a logo are the owner's follow-ups (roadmap P6-01..03).
**Update, same day:** the owner renamed the GitHub repo to `plainchant` and re-cloned into a `plainchant` folder, so
the "deliberately unchanged" folder name above no longer applies (roadmap P6-04). The rest stands.

## D-013 Library management: soft delete, rename through the text, data rules in a pure module  (2026-09-20, status: accepted)
**Context:** The Library could only list and open scripts (P3-07), and the example script (D-011) added a script
nobody could remove. Principle 3 is "never lose words", and on a touch screen an accidental tap is likely.
**Decision:**
1. **Deleting is soft.** A script gets a `deletedAt` timestamp and moves to a "Recently deleted" tab, where it can be
   restored. An Undo message appears at once. After **30 days** it is removed for good (checked on startup and
   whenever the Library opens). Deleting *forever* takes two deliberate clicks (the button turns red and asks
   "Really delete?", and disarms after 4 seconds).
2. **Rename rewrites the script's own `Title:` line** (creating the title page if there is none), rather than storing
   a separate label. That keeps D-002: the name travels with the text, exports with it and shows on the title page.
   Renaming the open script goes through the editor (`applyEdit` with the smallest diff, `Editing.diffEdit`), so the
   cursor and the undo history survive; other scripts are rewritten in storage.
3. **Duplicate** writes "<title> (copy)" into the copy's own text, so the two can be told apart everywhere.
4. **Search** matches titles and script text, case-insensitively.
5. **Nothing may resurrect a deleted script.** Deleting the open script leaves the writer on a blank page with a new
   id; on load a pointer to a deleted script is ignored (blank page, new id); and `saveScript` refuses to write into
   a deleted id (the words go to a new script). The last one exists for two browser tabs: another tab deletes the
   script this tab still has open.
6. **The rules are a pure module**, `src/library.js` (scripts object in, new object out, never mutated: the unit tests
   pass deeply frozen input). `index.html` draws the list and applies the results; script titles and text only ever
   become text nodes, never markup.
**Consequences:** Deleted scripts still occupy localStorage (about 5 MB total) for 30 days. `saveScript` now merges
into the stored record instead of replacing it, so new fields on a script survive. A rename adds a title page to a
script that had none. There is no UI yet for sort order, multi-select or per-script export (P3-09).

## Open questions

- Q-001 Should the editor stay a plain `<textarea>` (simple, great on mobile) or move to `contenteditable` / a custom
  editor for inline element styling (P2-08)? Prefer textarea plus an overlay until it proves insufficient.
- Q-002 Sync (Phase 5): local-file-first via the File System Access API, or hosted accounts?
