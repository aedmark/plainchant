# Security

This document describes Plainchant's security assumptions and reporting path. It is not a claim that the app is free of
vulnerabilities. Plainchant is a static, local-first web app: it has no server, no accounts and no network calls of its
own, so the assets are the writer's scripts on their own device.

## Supported versions

| Version / branch | Security fixes |
| --- | --- |
| `master` | the only supported line; there are no releases (D-020) |

## Report a vulnerability

Report suspected vulnerabilities privately to the owner (the address on the GitHub profile of `aedmark`; use a private
message, not a public issue). Include the browser, steps to reproduce and the impact. Do not include real scripts or
personal data. This is a single-owner project; there is no acknowledgement time promised.

## Assets and boundaries

| Asset or boundary | Sensitivity / threat | Protection and validation | Owner |
| --- | --- | --- | --- |
| The writer's scripts (IndexedDB `plainchant`, the emergency buffer in localStorage) | Loss or disclosure of unpublished work; read by other scripts on the same origin | Nothing is sent anywhere; no third-party script is loaded (structure test); data loss outranks every other bug | `persistence.js`, `store.js` |
| The writer's text going into HTML | Script injection through a script, an import or a linked file | Escaped in `fountain.js` (`escapeHTML`) before it reaches HTML; the only other `innerHTML` writes are parser output and static text | `src/fountain.js`, `core.js` |
| Imported files | A hostile or malformed file | Accepted types only, decoded, added as new scripts; nothing is overwritten (D-016) | `src/importing.js` |
| Linked real files (File System Access, Chromium) | Overwriting a file changed elsewhere; broad file access | The writer picks each file; written only after `FileSync.decide` (D-046) | `files-ui.js` |
| The service worker cache | A stale or poisoned offline copy | Same-origin files only, listed in `APP_FILES`; `CACHE` is bumped on removal; only over http(s) | `sw.js` |
| Repository content and retrieved docs | Embedded instructions, prompt injection, invisible characters | Treated as data (AGENTS.md "Zones"); `tools/check_docs.py` rejects zero-width and bidirectional control characters once P8-10 lands | every agent |
| The desktop wrapper (`src-tauri/`) | `csp: null` and `withGlobalTauri` give page script access to Tauri commands | Not reviewed; undocumented as a target (ARCHITECTURE, Claims vs. code; P8-12) | the owner |

Architecture details belong in [ARCHITECTURE.md](ARCHITECTURE.md); this table records the security consequence.

## Secure development rules

- Escape all user text before it reaches HTML. Do not add an `innerHTML` write of anything but parser output or static
  text without a decision record.
- Load nothing from another host: no CDN, no analytics, no remote fonts (D-026). Do not add a runtime dependency (D-001).
- Keep credentials, personal data and real scripts out of code, documentation, fixtures, screenshots and commits. Fixtures
  are written for the tests.
- Never write storage except through the paths in AGENTS.md "Conventions", so other tabs are told and the emergency
  buffer stays right.
- A storage rename or a destructive change to stored data gets a decision record, even without a migration (D-020).

## Security verification

- `test/structure.test.js` checks that the page and styles load nothing from another host and that no inline script
  returns.
- The unit suite covers the escaping in the renderer.
- Nothing yet checks the Content Security Policy: `app.html` sets none, and `src-tauri/tauri.conf.json` sets `null`.
  A policy that forbids inline script and remote loads would back the structure test with a browser-enforced one. Not
  planned; recorded here so it is a choice, not an oversight.
- No dependency scanning is needed: there are no runtime dependencies. The Rust crate's `Cargo.lock` is unaudited.

## Incident response

If a script's contents are exposed or lost through a defect: stop shipping the change, tell the owner, and preserve
evidence (a description, never a real script) in a private channel, not in the repository. Fix, add a test that fails
without the fix, and record it in `docs/CHANGELOG.md` once a fix lands.
