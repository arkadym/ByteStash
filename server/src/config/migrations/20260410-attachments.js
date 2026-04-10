import Logger from '../../logger.js';

function needsMigration(db) {
  try {
    const row = db.prepare(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='attachments'"
    ).get();
    return row.count === 0;
  } catch (error) {
    Logger.error('attachments - Error checking migration status:', error);
    throw error;
  }
}

export function up_attachments(db) {
  if (!needsMigration(db)) {
    Logger.debug('attachments - Migration not needed');
    return;
  }

  Logger.debug('attachments - Starting migration...');

  db.exec(`
    CREATE TABLE attachments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      snippet_id    INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      stored_name   TEXT NOT NULL,
      mime_type     TEXT NOT NULL,
      size_bytes    INTEGER NOT NULL,
      uploaded_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (snippet_id) REFERENCES snippets (id) ON DELETE CASCADE
    );

    CREATE INDEX idx_attachments_snippet_id ON attachments (snippet_id);
  `);

  Logger.debug('attachments - Migration completed successfully');
}
