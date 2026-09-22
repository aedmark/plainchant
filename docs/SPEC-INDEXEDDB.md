# Spec: migrate storage from localStorage to IndexedDB

Roadmap item **P4-10**. Decision **D-018**. Status: **spec only — not implemented**.

This spec is the plan for moving Plainchant's script storage off localStorage and onto IndexedDB. It is written to
be implemented later (it is *not* the next step; P3-03 print/PDF is). Read it alongside D-018, which records the
decisions this spec depends on.

---

## 1. Why

Scripts live in one localStorage key, `frictionless_scripts`, as a single JSON blob:

```js
{ [id]: { id, title, content, updatedAt, deletedAt? } }
```

Every autosave (2 s debounce) does `getScripts()` → mutate → `JSON.stringify(entire library)` → `setItem`. That has
two problems:

1. **The ~5 MB cap.** A feature-length script is ~100 KB; a modest library outgrows 5 MB. localStorage is a hard
   ceiling, and "never lose words" (Principle 3) is in tension with it.
2. **The whole-library rewrite.** Every save re-serialises *every script ever written*, synchronously, on the main
   thread. Cost is O(total library size) per save and grows with the library.

IndexedDB fixes (1) — its quota is far larger (typically a fraction of disk, GBs) — and *can* fix (2) if the data
model becomes per-script records so a save writes only the changed script.

Note: (2) alone could be fixed without IndexedDB by splitting localStorage into per-script keys. That is a valid
stopgap if the cap is not yet the binding constraint, but it does not fix the cap, so it is not this spec's goal.

## 2. Goals and non-goals

**Goals**

- Remove the 5 MB ceiling as the binding constraint.
- Make autosave write only the changed script (O(1) per save, not O(library)).
- Keep "never lose words" intact across the async gap (pagehide cannot await an IDB write).
- Migrate existing scripts without data loss, and without deleting the old copy until the new path is proven.

**Non-goals**

- Not a change to the pure modules (`fountain.js`, `editing.js`, `library.js`, `importing.js`, `suggest.js`). They
  keep operating on the same in-memory `{ [id]: script }` object and their tests stand unchanged.
- Not a sync/collaboration feature (Phase 5). No File System Access API, no cloud.
- Not a schema for version snapshots (P4-05) or anything beyond scripts + the current pointer.

## 3. Data model

IndexedDB database `plainchant`, version `1`.

**Object store `scripts`** — `keyPath: 'id'`

```
{ id, title, content, updatedAt, deletedAt? }
```

One record per script. `deletedAt` is present only while a script is in "Recently deleted" (soft delete, D-013). The
record shape is identical to the value stored under `frictionless_scripts[id]` today, so the migration is a straight
copy.

**Object store `meta`** — `keyPath: 'key'`

| key | value |
| --- | --- |
| `currentScriptId` | the id of the last-open script |
| `migrated` | `"1"` once the one-time migration has completed |
| `schemaVersion` | `1` (for future migrations) |

`currentScriptId` moves out of the `frictionless_current` localStorage key and into `meta`.

## 4. Architecture

The working model stays **in memory**: on startup the whole library is read into a `{ [id]: script }` object, exactly
as `getScripts()` returns today. All reads (Library list, search, autocomplete's parse) come from that object. Writes
mutate the object and then persist **deltas** to IDB.

This is the key payoff of the existing separation: `src/library.js` is a pure module over that object (D-013) and is
fully unit-tested with deeply-frozen input. It is untouched. The refactor lands in the persistence layer:

- `src/app/persistence.js` — the load/save/migrate/reconcile logic (async now).
- `src/app/import.js` — import writes new records.
- `src/app/library-ui.js` — Library actions (rename/duplicate/delete) persist their deltas.

A new pure module, `src/storage.js` (UMD, D-003 style), holds the IDB plumbing and the pure transforms so they can be
unit-tested under Node with a fake IDB or an in-memory shim. It exposes:

```
Storage.open()                  -> Promise<db>          // opens, runs upgrade, then migration
Storage.loadAll(db)             -> Promise<{ scripts, currentId }>
Storage.putScript(db, record)   -> Promise<void>        // one record, one transaction
Storage.putMeta(db, key, value) -> Promise<void>
Storage.migrate(db, blob)       -> Promise<void>        // localStorage blob -> IDB records
Storage.reconcile(scripts, buffer) -> { scripts, currentId }   // pure: emergency buffer vs IDB
```

The pure `migrate` / `reconcile` transforms are the unit-testable heart; the IDB calls around them are thin.

## 5. Read path (startup)

`main.js`'s `DOMContentLoaded` handler becomes async:

1. `Storage.open()` — opens the DB; the `upgradeneeded` handler creates the two stores; then, if `meta.migrated` is
   not `"1"`, run the migration (§7).
2. `Storage.loadAll()` — read every `scripts` record into the in-memory object; read `currentScriptId`.
3. **Reconcile the emergency buffer** (§6): if `frictionless_emergency` exists and is newer than the corresponding
   record (or the record is missing), restore it and clear the buffer.
4. `restoreLastScript()` proceeds as today, but against the in-memory object instead of `getScripts()`.

`purgeTrash()` (the 30-day hard delete, D-013) runs after load, as today, and persists any removals.

## 6. Write path and the emergency buffer

**Autosave** (2 s debounce) becomes async:

1. Build the record for the current script.
2. `Storage.putScript(db, record)` — a single readwrite transaction that re-reads the existing record, refuses to
   write into a `deletedAt` record (the deleted-script guard, §8), then puts the record. On success, clear the
   emergency buffer (the words are now safely in IDB).
3. `Storage.putMeta(db, 'currentScriptId', id)`.

**The emergency buffer** is how "never lose words" survives the async gap. `pagehide` / `visibilitychange` cannot
await an IDB transaction — the page may be killed first. So `flushSave()` does two things:

1. **Synchronously** write *only the current script* to a small localStorage key, `frictionless_emergency`:

   ```js
   localStorage.setItem('frictionless_emergency',
     JSON.stringify({ id: currentScriptId, content: editor.value, updatedAt: Date.now() }));
   ```

   This is one script, ~100 KB, well within localStorage limits — it is not the whole library.
2. Fire-and-forget the async IDB put (best effort; it may or may not commit before the page dies).

A successful async autosave clears the buffer, so the buffer only ever holds "the latest content that has not yet
been confirmed in IDB". On next load, `reconcile` restores from the buffer when it is newer than the IDB record, then
clears it. This mirrors the existing `flushSave()` guarantee (the last 2 s of typing survive) without depending on an
async write completing during unload.

## 7. Migration (one-time, idempotent, non-destructive)

Run when `meta.migrated` is not `"1"`:

1. Read `frictionless_scripts` from localStorage and parse it into `{ [id]: script }`.
2. Put each script into the `scripts` store (one transaction, or batched).
3. Read `frictionless_current` and put it into `meta.currentScriptId`.
4. Put `meta.migrated = "1"`.

**Idempotency:** if the migration is interrupted before step 4, the flag is still unset, so it re-runs; the puts
overwrite the same keys, so re-running is harmless. There is no partial-state hazard.

**Non-destructive:** the `frictionless_scripts` and `frictionless_current` localStorage keys are **left in place** as
a fallback. They are removed only in a later cleanup step, after the IDB path has run in the wild without issue. If
the IDB path is ever found broken, the old copy is still there.

**Failure:** if IDB is unavailable (private mode in some browsers, quota denied), fall back to the current localStorage
behaviour rather than losing data. The app must not migrate-and-then-fail-to-store.

## 8. Concurrency (two tabs)

Today the deleted-script guard works because localStorage is synchronously shared across tabs: `getScripts()` always
sees another tab's delete. An in-memory cache loaded once at startup goes stale.

The guard is therefore re-checked **inside the write transaction**: `Storage.putScript` re-reads the record for `id`
within the same readwrite transaction and, if it has a `deletedAt`, refuses to write (the words go to a new id, as
today). This preserves the existing two-tab behaviour without needing a cache-invalidation channel.

Optional (later): a `BroadcastChannel` to invalidate other tabs' caches on rename/duplicate/delete, so a second tab's
Library list refreshes. Not required for correctness of the delete guard; defer.

## 9. Quota and persistence

- `navigator.storage.estimate()` becomes available for the storage-usage indicator (P3-09).
- `navigator.storage.persist()` (request persistent storage so the browser does not evict IDB under pressure) is a
  natural companion to P4-02 (offline/PWA); note it here so it is not forgotten, but do not implement it in P4-10.

## 10. Testing

- **Pure transforms** (`migrate`, `reconcile`, the deleted-script check) are unit-tested under Node with an in-memory
  IDB shim, in the style of the existing `library.test.js` / `importing.test.js`.
- **e2e** (Chromium supports IDB headlessly): the harness must snapshot and restore IDB state the way it already does
  for localStorage, and must seed `frictionless_onboarded` etc. New checks cover:
  - migration: seed localStorage, load, assert IDB populated **and** localStorage intact;
  - save/restore: type, reload, assert content restored from IDB;
  - emergency buffer: simulate `pagehide` without the async put committing, reload, assert the buffer restored the
    words;
  - two-tab delete guard: delete in one "tab", assert the other cannot resurrect it;
  - quota/fallback: IDB unavailable → localStorage fallback still works.
- **Mutation tests** for the critical invariants: the emergency buffer is written synchronously on `pagehide`; a
  successful autosave clears it; the migration is idempotent; the delete guard is re-checked in the transaction.

## 11. Open questions to settle before implementing

- Confirm the DB name and store names (`plainchant` / `scripts` / `meta`) — cosmetic, but settle once.
- Decide whether to keep the in-memory object as the source of truth (this spec assumes yes) versus reading IDB on
  every access. Load-all-at-startup is simpler and matches current behaviour; the memory cost is trivial for a
  screenwriting library. Revisit only if libraries get very large.
- Decide when to remove the `frictionless_*` localStorage keys (the fallback) — a later cleanup after the IDB path is
  proven, not part of P4-10 itself.
- Whether to add the `BroadcastChannel` cache invalidation now or defer (§8).
