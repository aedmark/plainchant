# Changelog

User-visible changes, newest first, in plain words: what a writer using Plainchant would notice. It is not a copy of
the git log or the session log. Add to "Unreleased" as changes land. There are no releases yet (D-020), so everything
before this file existed is summarised once under "Before this changelog", from the dev diary.

## Unreleased

## v1.0.0 (2026-11-27)

### Added
- Cross-platform desktop installers (Linux, Windows, macOS universal) built and staged as a GitHub Release via GitHub Actions.
- Find and Replace in the script (`Ctrl/Cmd+F`, `Ctrl/Cmd+H`), with highlighted matches and undoable replace.
- A dockable Outline and Script stats drawer beside or below the Canvas (`Ctrl/Cmd+Shift+O`).

### Changed
- The desktop build now only reads and writes files you picked in a dialog. A script linked to a file by an earlier
  build shows a notice the first time; choose the file again (Library > Open a file).
- A stricter content policy in the desktop build.
- On a desktop the Canvas follows the line being written, and clicking a Canvas paragraph highlights its lines in the
  Void.
- The colour hints recover on their own if they ever misalign.

## Before this changelog

The story of each step is in the [dev diary](devlog/index.html).

- **2026-09-20 to 2026-09-25:** a Fountain editor with a live preview; never losing words (autosave, restore, an
  emergency buffer, IndexedDB); phones and tablets; typing helpers (Tab, smart Enter, autocomplete); the Library with
  30-day restore; import and export; print and save as PDF.
- **2026-09-26 to 2026-09-28:** stats, outline, focus mode, colour hints, versions with scene-by-scene compare,
  offline and installable, Settings, light, dark and retro themes, read-aloud time and video chapters, real files on
  disk (Chromium), Final Draft export, the page view, one pane or both, quick edits in the preview.
- **2026-09-30 and 2026-10-31:** a public homepage, then a homepage written as a five-page screenplay.
