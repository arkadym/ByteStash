import express from 'express';
import multer from 'multer';
import os from 'os';
import Logger from '../logger.js';
import attachmentService from '../services/attachmentService.js';

const router = express.Router({ mergeParams: true });

const MAX_SIZE_BYTES = parseInt(process.env.ATTACHMENT_MAX_SIZE_MB || '50') * 1024 * 1024;

// multer writes to OS temp dir; attachmentService.create() moves the file to its final location
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_SIZE_BYTES },
});

// GET /api/snippets/:snippetId/attachments
router.get('/', async (req, res) => {
  try {
    const { snippetId } = req.params;
    const result = await attachmentService.list(snippetId, req.user.id);
    if (result === null) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(result);
  } catch (error) {
    Logger.error('GET attachments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/snippets/:snippetId/attachments
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { snippetId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await attachmentService.create(snippetId, req.user.id, req.file);
    if (result === null) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.status(201).json(result);
  } catch (error) {
    Logger.error('POST attachment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/snippets/:snippetId/attachments/:attachmentId/download
router.get('/:attachmentId/download', async (req, res) => {
  try {
    const { snippetId, attachmentId } = req.params;

    const result = await attachmentService.getForDownload(snippetId, attachmentId, req.user.id);
    if (!result) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const { attachment, filePath } = result;

    // Force download (never inline) to prevent XSS from HTML/SVG files
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.original_name)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', attachment.size_bytes);

    res.sendFile(filePath, { root: '/' }, (err) => {
      if (err) {
        Logger.error('sendFile error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to send file' });
        }
      }
    });
  } catch (error) {
    Logger.error('GET attachment download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/snippets/:snippetId/attachments/:attachmentId
router.delete('/:attachmentId', async (req, res) => {
  try {
    const { snippetId, attachmentId } = req.params;

    const result = await attachmentService.delete(snippetId, attachmentId, req.user.id);
    if (result === null) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    res.json({ id: result.id });
  } catch (error) {
    Logger.error('DELETE attachment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
