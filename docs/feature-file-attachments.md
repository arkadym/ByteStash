# Feature: File Attachments

Allow users to attach any file to a snippet. Attachments are stored on disk alongside the SQLite database, within the same Docker volume that already persists snippet data.

---

## Why

Code snippets often live alongside supporting files — configs, sample data, patches, diagrams, scripts. Right now users work around this by pasting file content as a code fragment, which is awkward for binary files or anything that isn't plain text. Native attachment support removes that friction.

---

## UX

- In the snippet editor, a new **Attachments** section appears below the code fragments.
- Users can drag-and-drop or browse to upload one or more files.
- Each attachment shows its name, size, and a download/delete button.
- In the snippet view (read mode), attachments are listed with individual download links.
- Attachments are preserved when a snippet is moved to the recycle bin, and are permanently deleted when the snippet is hard-deleted.

---

## Technical Design

### Why not PostgreSQL?

`better-sqlite3` (current DB) is synchronous and embedded — zero infrastructure. If files were stored as BLOBs in the database we might justify switching to PostgreSQL for its better BLOB handling. However, files stored on disk is simpler, faster for large files, and keeps the deployment model unchanged (single container, single mounted volume). PostgreSQL would add a second service and significant migration effort for no real gain here. See [docs/decision-no-postgresql.md](decision-no-postgresql.md) for full reasoning.

### Storage layout

Files are stored at `/data/snippets/attachments/<snippet_id>/<uuid>.<ext>`.

- The UUID-based stored name prevents path traversal and filename collisions.
- The `/data/snippets` path is already the persisted Docker volume — no new mount needed.
- Directory per snippet keeps cleanup trivial (delete the directory on hard-delete).

### Database

A new `attachments` table:

```sql
CREATE TABLE attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  snippet_id  INTEGER NOT NULL REFERENCES snippets(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,   -- display name shown in UI
  stored_name   TEXT NOT NULL,   -- UUID-based filename on disk
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  uploaded_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attachments_snippet_id ON attachments(snippet_id);
```

`ON DELETE CASCADE` ensures DB rows are removed automatically when a snippet is hard-deleted. Physical file cleanup (the disk directory) is handled explicitly in the service layer at delete time, since filesystem and DB cannot be atomically coupled.

### Server

New routes under `/api/snippets/:id/attachments`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/snippets/:id/attachments` | List all attachments for a snippet |
| `POST` | `/api/snippets/:id/attachments` | Upload a new attachment (multipart/form-data) |
| `GET` | `/api/snippets/:id/attachments/:attachmentId/download` | Download a file |
| `DELETE` | `/api/snippets/:id/attachments/:attachmentId` | Delete a single attachment |

**multer** is already a declared dependency in `server/package.json`. It handles multipart parsing and disk storage.

Security constraints applied at the multer middleware layer:
- **File size limit**: configurable via `ATTACHMENT_MAX_SIZE_MB` env var (default: 50 MB).
- **No MIME allowlist** by default — this is a personal self-hosted tool, not a public service. Trust the user.
- Download route sets `Content-Disposition: attachment` (forced download, not inline rendering) to prevent XSS from HTML/SVG uploads.
- Download route serves from the stored UUID filename, never from user-supplied path input.

New files:
- `server/src/repositories/attachmentRepository.js`
- `server/src/services/attachmentService.js`
- `server/src/routes/attachmentRoutes.js`
- `server/src/config/migrations/<date>-attachments.js`

### Client

- `client/src/types/snippets.ts` — add `Attachment` interface
- `client/src/service/attachmentService.ts` — API calls (upload uses `FormData`, not JSON)
- `client/src/components/editor/AttachmentsEditor.tsx` — upload zone + list in edit mode
- `client/src/components/snippets/AttachmentList.tsx` — read-only list in view mode

---

## Affected Files Summary

| Layer | File | Change |
|-------|------|--------|
| DB | `server/src/config/schema/init.sql` | add `attachments` table |
| DB | `server/src/config/database.js` | import new migration |
| DB | new migration file | create table |
| Server | `server/src/app.js` | mount attachment routes |
| Server | new repository, service, routes | full implementation |
| Client | `client/src/types/snippets.ts` | `Attachment` type |
| Client | new service + 2 components | UI implementation |

---

## Edge Cases & Risks

- **Disk quota**: No per-user quota exists. For personal use this is acceptable. If needed, add a check in the service layer before writing.
- **Recycle bin interaction**: When a snippet is moved to recycle bin (`expiry_date` set), attachments remain on disk. They are only deleted when the snippet is permanently removed. This is intentional — restoring a snippet restores its attachments too.
- **Concurrent uploads**: SQLite in WAL mode handles concurrent reads fine; writes are serialized, which is acceptable for a personal-use tool.
