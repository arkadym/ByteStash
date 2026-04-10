# Feature: Note Expiry & Recycle Bin (Improved)

This document describes the current state of expiry/recycle bin in upstream ByteStash, the design problems found during review, and the improved design implemented in this fork.

---

## Current State (Upstream)

The upstream project partially implements this feature. What exists:

- `expiry_date DATETIME DEFAULT NULL` column on the `snippets` table
- "Move to recycle bin" sets `expiry_date = datetime('now', '+30 days')` (hardcoded)
- Active snippets query filters: `WHERE expiry_date IS NULL`
- Recycled snippets query: `WHERE expiry_date IS NOT NULL`
- "Restore snippet" sets `expiry_date = NULL`
- `deleteExpiredSnippets()` hard-deletes rows where `expiry_date <= NOW()`
- A `/recycled` UI view exists

This is roughly 80% of the feature. However there are two significant problems.

---

## Problems in the Current Design

### Problem 1: `expiry_date` is overloaded

The same column is used for two distinct concepts:

1. **Soft delete (recycle bin)**: User pressed delete → set `expiry_date` to now + 30 days
2. **Snippet TTL**: User configured this snippet to expire on a specific date

There is no way to distinguish these two cases. If a user sets a snippet to expire in 7 days and then forgets about it, it will appear in the recycle bin (correct), but 30 days later the cleanup job will permanently delete it — using the wrong deadline. If a user sets expiry to tomorrow and the cleanup runs tonight, the snippet is gone before the user can react.

### Problem 2: No background job — cleanup is lazy

`deleteExpiredSnippets()` is only called when a user visits `GET /api/snippets?recycled=true`. If no one visits the recycle bin, expired snippets accumulate indefinitely. The "expiry" feature does not actually expire anything autonomously.

---

## Improved Design

### Schema: Split the two concerns

Replace the single `expiry_date` column with two:

```sql
-- When user pressed "Delete" (recycle bin soft-delete timestamp)
ALTER TABLE snippets ADD COLUMN deleted_at DATETIME DEFAULT NULL;

-- User-configured TTL: snippet auto-expires at this datetime
ALTER TABLE snippets ADD COLUMN expires_at DATETIME DEFAULT NULL;
```

- `deleted_at IS NOT NULL` → snippet is in the recycle bin (soft-deleted)
- `expires_at IS NOT NULL AND deleted_at IS NULL` → snippet is active but has a TTL
- `deleted_at IS NULL AND expires_at IS NULL` → normal active snippet
- Both set → impossible in normal flow (TTL expiry sets `deleted_at`, then grace period starts)

Active snippets filter becomes: `WHERE deleted_at IS NULL`  
Recycled snippets filter becomes: `WHERE deleted_at IS NOT NULL`

### Background Scheduler

A proper scheduler runs inside `app.js` using `setInterval`. It fires every 5 minutes (configurable via `EXPIRY_CHECK_INTERVAL_MS` env var).

Each run does two things in order:

**Step 1 — Move expired-TTL snippets to recycle bin:**
```sql
UPDATE snippets
SET deleted_at = datetime('now', 'utc')
WHERE expires_at IS NOT NULL
  AND deleted_at IS NULL
  AND datetime(expires_at) <= datetime('now', 'utc')
```

**Step 2 — Hard-delete snippets past their recycle bin grace period:**
```sql
DELETE FROM snippets
WHERE deleted_at IS NOT NULL
  AND datetime(deleted_at, '+' || ? || ' days') <= datetime('now', 'utc')
```

The grace period (default 30 days) is configurable via `RECYCLE_BIN_GRACE_DAYS` env var.

### User-Configurable Expiry

In the snippet editor, an optional "Expires on" date picker lets users set `expires_at`. This is separate from the recycle bin. When the scheduler detects `expires_at` has passed, it moves the snippet to the recycle bin — the user then has the full grace period to recover it.

This means: **expiry never results in instant permanent deletion**. The recycle bin always acts as a safety net.

---

## UX Flow

```
[Active snippet]
     │
     ├── User sets expires_at (optional, in editor)
     │        │
     │        └── Scheduler detects expiry → moves to recycle bin
     │
     ├── User presses Delete → moves to recycle bin (deleted_at = now)
     │
     └── [Recycle bin]
              │
              ├── User presses Restore → deleted_at = NULL (back to active)
              │
              └── Grace period passes → scheduler hard-deletes permanently
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RECYCLE_BIN_GRACE_DAYS` | `30` | Days a snippet stays in recycle bin before permanent deletion |
| `EXPIRY_CHECK_INTERVAL_MS` | `300000` | How often the scheduler runs (ms). Default: 5 minutes |

---

## Affected Files

| Layer | File | Change |
|-------|------|--------|
| DB | `server/src/config/schema/init.sql` | replace `expiry_date` with `deleted_at` + `expires_at` |
| DB | new migration | rename columns, backfill data |
| DB | `server/src/config/database.js` | import migration, start scheduler |
| Server | `server/src/repositories/snippetRepository.js` | update all queries |
| Server | `server/src/services/snippetService.js` | update moveToRecycle, restore, expiry logic |
| Server | `server/src/app.js` | add scheduler startup/shutdown |
| Client | `client/src/types/snippets.ts` | update `Snippet` type fields |
| Client | snippet editor component | add "Expires on" date picker |
| Client | recycle bin view | show `deleted_at` + `expires_at` clearly in UI |

---

## Migration Notes

The existing `expiry_date` column needs to be mapped to the new columns. Since SQLite doesn't support `ALTER COLUMN RENAME`, the migration will:
1. Add `deleted_at` and `expires_at` columns
2. Backfill: rows where `expiry_date IS NOT NULL` → set `deleted_at = expiry_date` (treat existing recycled items as soft-deleted)
3. Leave `expiry_date` in place temporarily (for rollback safety), then drop it in a subsequent migration

---

## Edge Cases

- **Snippet with both `expires_at` set and manually deleted**: The manual delete wins — `deleted_at` is set, `expires_at` is irrelevant until restore.
- **Restore a snippet that had `expires_at`**: After restore, `deleted_at` is cleared but `expires_at` remains. The snippet will expire again on schedule. This is intentional — restoring should not silently remove the user's expiry setting. The UI should make this visible.
- **Scheduler crash**: The scheduler is a simple `setInterval` inside the app process. If the process crashes, the scheduler stops. On restart it runs again within the configured interval. For a personal tool this is acceptable — no persistent job queue needed.
- **File attachments + expiry**: When the scheduler hard-deletes a snippet, `ON DELETE CASCADE` handles the `attachments` DB rows. The service layer must also delete the physical attachment directory.
