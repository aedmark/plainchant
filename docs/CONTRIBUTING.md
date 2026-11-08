# Contributing

The workflow shared by human and automated contributors. Agent-specific standing instructions are in
[AGENTS.md](../AGENTS.md).

## Before changing code

1. Read the README, the roadmap item, the relevant part of [ARCHITECTURE.md](ARCHITECTURE.md) and
   [TESTING.md](TESTING.md). Verify the repository's actual conventions rather than importing a framework idiom: there
   is no build step, no framework and no runtime dependency, and the scripts are classic scripts, not modules.
2. Setup: none. Open `app.html` in a browser; `npm test` needs Node 18+; the browser suite needs Chromium or Chrome.
3. Check `git status` and confirm the change does not overlap unrelated work. The owner edits the homepage by hand.
4. For an ambiguous request or a large or irreversible change, ask first, or record an open question in
   [DECISIONS.md](DECISIONS.md), and agree on scope before editing.

## Make the change

- Keep each change reviewable and tied to one roadmap item (`P2-25`); name it in the commit message.
- If implementation or testing invalidates the agreed scope, pause and re-scope.
- Add or update tests for changed behaviour, and make a new test fail for the intended reason before trusting it.
- Add a line to Help (`app.html`) for each user-visible feature, and keep each phrase an e2e check looks for on one line.
- Update documentation by [the triggers](README.md#update-triggers).
- Do not include real scripts, personal data or local configuration.

## Verify

```bash
npm test
python3 tools/check_docs.py
npm run test:browser
```

Follow [TESTING.md](TESTING.md) for prerequisites and what each suite cannot prove. Report the exact checks run and any
skipped; a partial pass is not a full pass.

## Submit and review

The owner reviews and merges. Commit finished, tested work on the branch you were given; push when asked; never
force-push or rewrite history. A change is ready when its scope is clear, the checks pass, the docs it invalidated are
updated, and no real script or secret is in the diff.

## Compatibility and migrations

There is no production release, so storage names may change without a migration (D-020); say so in DECISIONS when they
do. A script exported as Fountain stays valid Fountain. A change to the database version needs the upgrade path
exercised against a database from the earlier version, not only a fresh profile.

## Reporting security issues

Do not open a public issue for a suspected vulnerability. Follow [SECURITY.md](SECURITY.md).
