import { getDb } from '../config/database.js';
import Logger from '../logger.js';

class AttachmentRepository {
  #initStatements() {
    const db = getDb();

    if (!this.insertStmt) {
      this.insertStmt = db.prepare(`
        INSERT INTO attachments (snippet_id, original_name, stored_name, mime_type, size_bytes)
        VALUES (?, ?, ?, ?, ?)
      `);

      this.findBySnippetStmt = db.prepare(`
        SELECT id, snippet_id, original_name, stored_name, mime_type, size_bytes,
               datetime(uploaded_at) || 'Z' as uploaded_at
        FROM attachments
        WHERE snippet_id = ?
        ORDER BY uploaded_at ASC
      `);

      this.findByIdStmt = db.prepare(`
        SELECT id, snippet_id, original_name, stored_name, mime_type, size_bytes,
               datetime(uploaded_at) || 'Z' as uploaded_at
        FROM attachments
        WHERE id = ?
      `);

      this.deleteStmt = db.prepare(`
        DELETE FROM attachments WHERE id = ? RETURNING *
      `);

      // Check snippet ownership to authorize attachment operations
      this.checkSnippetOwnerStmt = db.prepare(`
        SELECT id FROM snippets WHERE id = ? AND user_id = ?
      `);
    }
  }

  findBySnippet(snippetId) {
    this.#initStatements();
    try {
      return this.findBySnippetStmt.all(snippetId);
    } catch (error) {
      Logger.error('AttachmentRepository.findBySnippet:', error);
      throw error;
    }
  }

  findById(id) {
    this.#initStatements();
    try {
      return this.findByIdStmt.get(id) || null;
    } catch (error) {
      Logger.error('AttachmentRepository.findById:', error);
      throw error;
    }
  }

  create({ snippetId, originalName, storedName, mimeType, sizeBytes }) {
    this.#initStatements();
    try {
      const result = this.insertStmt.run(snippetId, originalName, storedName, mimeType, sizeBytes);
      return this.findByIdStmt.get(result.lastInsertRowid);
    } catch (error) {
      Logger.error('AttachmentRepository.create:', error);
      throw error;
    }
  }

  delete(id) {
    this.#initStatements();
    try {
      const rows = this.deleteStmt.all(id);
      return rows[0] || null;
    } catch (error) {
      Logger.error('AttachmentRepository.delete:', error);
      throw error;
    }
  }

  isSnippetOwnedBy(snippetId, userId) {
    this.#initStatements();
    try {
      return !!this.checkSnippetOwnerStmt.get(snippetId, userId);
    } catch (error) {
      Logger.error('AttachmentRepository.isSnippetOwnedBy:', error);
      throw error;
    }
  }
}

export default new AttachmentRepository();
