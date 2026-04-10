import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Logger from '../logger.js';
import attachmentRepository from '../repositories/attachmentRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolves to /data/snippets/attachments in Docker (same volume as the DB)
const ATTACHMENTS_BASE = join(__dirname, '../../../data/snippets/attachments');

function getSnippetDir(snippetId) {
  return join(ATTACHMENTS_BASE, String(snippetId));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

class AttachmentService {
  getAttachmentsBaseDir() {
    return ATTACHMENTS_BASE;
  }

  getSnippetAttachmentsDir(snippetId) {
    return getSnippetDir(snippetId);
  }

  async list(snippetId, userId) {
    if (!attachmentRepository.isSnippetOwnedBy(snippetId, userId)) {
      return null; // caller should 403
    }
    return attachmentRepository.findBySnippet(snippetId);
  }

  async create(snippetId, userId, file) {
    if (!attachmentRepository.isSnippetOwnedBy(snippetId, userId)) {
      return null; // caller should 403
    }

    const ext = path.extname(file.originalname);
    const storedName = `${crypto.randomUUID()}${ext}`;
    const dir = getSnippetDir(snippetId);
    ensureDir(dir);
    const destPath = join(dir, storedName);

    // multer writes to OS tmp which may be on a different fs/device than the data volume.
    // fs.renameSync fails across devices (EXDEV), so copy then remove instead.
    fs.copyFileSync(file.path, destPath);
    fs.unlinkSync(file.path);

    return attachmentRepository.create({
      snippetId,
      originalName: file.originalname,
      storedName,
      mimeType: file.mimetype || 'application/octet-stream',
      sizeBytes: file.size,
    });
  }

  async getForDownload(snippetId, attachmentId, userId) {
    const attachment = attachmentRepository.findById(attachmentId);
    if (!attachment || String(attachment.snippet_id) !== String(snippetId)) {
      return null;
    }

    // Allow if user owns the snippet OR snippet is public (checked by caller via snippet service)
    if (!attachmentRepository.isSnippetOwnedBy(snippetId, userId)) {
      return null;
    }

    const filePath = join(getSnippetDir(snippetId), attachment.stored_name);
    if (!fs.existsSync(filePath)) {
      Logger.error(`Attachment file missing on disk: ${filePath}`);
      return null;
    }

    return { attachment, filePath };
  }

  async delete(snippetId, attachmentId, userId) {
    if (!attachmentRepository.isSnippetOwnedBy(snippetId, userId)) {
      return null;
    }

    const attachment = attachmentRepository.findById(attachmentId);
    if (!attachment || String(attachment.snippet_id) !== String(snippetId)) {
      return null;
    }

    // Remove physical file first, then DB row
    const filePath = join(getSnippetDir(snippetId), attachment.stored_name);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      Logger.error(`Failed to delete attachment file ${filePath}:`, err);
      // Continue — still remove DB row so UI stays consistent
    }

    return attachmentRepository.delete(attachmentId);
  }

  // Called when a snippet is hard-deleted (supplemental to ON DELETE CASCADE for DB rows)
  deleteSnippetAttachments(snippetId) {
    const dir = getSnippetDir(snippetId);
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (err) {
      Logger.error(`Failed to delete attachments dir for snippet ${snippetId}:`, err);
    }
  }
}

export default new AttachmentService();
