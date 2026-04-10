# Decision: No PostgreSQL Support

This document records the architectural decision to keep SQLite as the only supported database for this fork, and to not implement PostgreSQL support.

---

## Context

The upstream ByteStash project uses **SQLite via `better-sqlite3`** — a synchronous, embedded, file-based database. This fork adds features (file attachments, improved expiry/recycle bin) that could theoretically motivate a switch to PostgreSQL.

During initial architecture review, PostgreSQL support was evaluated and explicitly rejected for this fork. The reasoning is recorded here so the decision isn't re-litigated later.

---

## What PostgreSQL Would Actually Require

The repository layer exists (`SnippetRepository`, `UserRepository`, etc.), which is the right pattern for swapping databases. However, SQLite-specific code has leaked through every layer:

| Problem | Detail |
|---------|--------|
| Driver coupling | `database.js` directly imports `better-sqlite3`. No abstraction layer. |
| Sync vs async API | `better-sqlite3` is fully synchronous. All PostgreSQL clients (`pg`, `postgres`) are async (Promise-based). Every repository method would need `async/await` added. |
| SQL dialect | `datetime('now', 'utc')`, `GROUP_CONCAT`, `AUTOINCREMENT`, `PRAGMA`, WAL mode — none of this is valid PostgreSQL SQL. |
| Prepared statements | SQLite's `.prepare().all()` / `.run()` / `.get()` API doesn't exist in `pg`. Completely different query interface. |
| Migration system | All migrations use `PRAGMA table_info()` and SQLite-specific schema introspection. The entire system would need replacing. |
| Transactions | `db.transaction(fn)()` is SQLite-specific. PostgreSQL uses explicit `BEGIN/COMMIT`. |
| Startup logic | WAL checkpoint, file-level backup — purely SQLite concepts with no PostgreSQL equivalent. |

A clean implementation would require: a DB driver abstraction layer, rewriting all SQL in all repositories, replacing the migration system (e.g. with Knex.js), and adjusting all datetime/aggregate expressions. This is a substantial rewrite, not an incremental change.

---

## Why the Effort Isn't Worth It For This Fork

### Deployment model doesn't need it

ByteStash is a single-container, self-hosted personal tool. SQLite in WAL mode handles:
- Concurrent reads: natively, with no contention
- Serialized writes: fine for one user or a small household

There are no horizontal scaling needs. There is no need for a managed cloud DB.

### File attachments don't require it

The main argument for PostgreSQL in similar apps is centralized BLOB storage. This fork stores attachments on disk (same Docker volume). Once the decision is "files go to disk", the remaining data (metadata, snippets, users) is tiny and SQLite handles it without issue.

### Ops burden

Moving to PostgreSQL would require a second service in `docker-compose.yaml`, connection management, credentials, and ongoing concern about PG version upgrades. The current setup is: run one container, mount one directory. That simplicity is valuable.

---

## When This Decision Should Be Revisited

If any of the following become true, reconsider:

1. **Multi-user / team use** — many concurrent writers start hitting SQLite's serialized write limits
2. **Object storage** — decision is made to move attachments to S3/MinIO instead of local disk; at that point adding PG is a similar level of effort
3. **Centralized backup** — need to back up via pg_dump into an existing DB infrastructure rather than copying a file

---

## Alternative: Knex.js as a Path Forward

If PostgreSQL support is ever added, the recommended approach is **Knex.js** as a query builder. It handles:
- Dialect differences (SQLite, PostgreSQL, MySQL) via unified API
- Migration system that works across DB types
- Transaction API that is consistent regardless of driver
- Async API throughout (which would require updating repository methods regardless)

This would be a significant but well-structured migration path.
