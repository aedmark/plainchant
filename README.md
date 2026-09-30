# Plainchant

A lightweight, responsive screenwriting app. You type [Fountain](https://fountain.io)-style plain text; Plainchant
handles the formatting. Built for writers who would rather write than fuss over format.

Static HTML, CSS and JavaScript: no build step, no runtime dependencies, nothing loaded from the network.

## Features

- **Write in plain text** with colour hints in the editor and a live screenplay preview (or the preview as printed
  pages). Editor, preview or both on a desktop; one pane at a time on phones and tablets.
- **Typing helpers:** Tab cycles elements, smart Enter, capitals as you type, autocomplete for names, places and times
  of day, focus mode.
- **Library in your browser** (IndexedDB): autosave, restore on reload, an emergency buffer, 30-day restore for
  deleted scripts, versions with scene-by-scene compare.
- **In and out:** import `.fountain`, `.txt` and `.md`; export `.fountain` or Final Draft `.fdx`; print or save as PDF
  on Letter or A4; link a script to a real file on disk (Chromium only).
- **Around the script:** page count, screen time, scene and character stats, an outline, and read-aloud time with
  YouTube chapters for narrated videos.
- **Themes and offline:** dark, light, retro and system themes; works offline and can be installed when served over
  http(s).

Targets Firefox and Chromium-based browsers.

## Run it

Open `index.html` for the project homepage, then choose **Start writing**. The editor itself is `app.html`. Or serve
the folder with any static server:

```sh
python3 -m http.server
```

Served over http(s), the app also works offline and can be installed.

## Test

```sh
npm test                # unit suite under Node 18+
npm run test:browser    # unit suite and app e2e in headless Chromium/Chrome (about a minute)
```

`BROWSER=/path/to/chrome` picks the browser. On Windows use `npm run test:browser:windows`.

## Project docs

- [ROADMAP.md](ROADMAP.md): the plan, with stable item IDs
- [docs/HANDOFF.md](docs/HANDOFF.md): current state and next steps
- [docs/DECISIONS.md](docs/DECISIONS.md): why things are the way they are
- [docs/devlog/](docs/devlog/): the dev diary
- [CLAUDE.md](CLAUDE.md): code layout, conventions and the session protocol

## License

Plainchant is released under an MIT-style license with an acknowledgment of its AI-assisted authorship: see
[LICENSE](LICENSE). Fonts (Courier Prime and Inter) are under the SIL Open Font License; licences are in `fonts/`.
