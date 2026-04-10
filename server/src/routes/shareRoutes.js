import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { JWT_SECRET, authenticateToken } from '../middleware/auth.js';
import shareRepository from '../repositories/shareRepository.js';
import attachmentRepository from '../repositories/attachmentRepository.js';
import attachmentService from '../services/attachmentService.js';
import Logger from '../logger.js';

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { snippetId, requiresAuth, expiresIn } = req.body;
    const share = await shareRepository.createShare({
      snippetId,
      requiresAuth: !!requiresAuth,
      expiresIn: expiresIn ? parseInt(expiresIn) : null
    }, req.user.id);
    res.status(201).json(share);
  } catch (error) {
    Logger.error('Error creating share:', error);
    if (error.message === 'Unauthorized') {
      res.status(403).json({ error: 'You do not have permission to share this snippet' });
    } else if (error.message === 'Invalid snippet ID') {
      res.status(400).json({ error: 'Invalid snippet ID provided' });
    } else {
      res.status(500).json({ error: 'Failed to create share' });
    }
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const share = await shareRepository.getShare(id);
    
    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    if (share.share?.requiresAuth) {
      const authHeader = req.headers['bytestashauth'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      try {
        jwt.verify(token, JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    }

    if (share.share?.expired) {
      return res.status(410).json({ error: 'Share has expired' });
    }

    res.json(share);
  } catch (error) {
    Logger.error('Error getting share:', error);
    res.status(500).json({ error: 'Failed to get share' });
  }
});

router.get('/snippet/:snippetId', authenticateToken, async (req, res) => {
  try {
    const { snippetId } = req.params;
    const shares = await shareRepository.getSharesBySnippetId(snippetId, req.user.id);
    res.json(shares);
  } catch (error) {
    Logger.error('Error listing shares:', error);
    res.status(500).json({ error: 'Failed to list shares' });
  }
});

// GET /api/share/:shareId/attachments  — list attachments for a shared snippet (no auth required)
router.get('/:shareId/attachments', async (req, res) => {
  try {
    const share = await shareRepository.getShare(req.params.shareId);
    if (!share) return res.status(404).json({ error: 'Share not found' });
    if (share.share?.expired) return res.status(410).json({ error: 'Share has expired' });

    const attachments = attachmentRepository.findBySnippet(share.id);
    res.json(attachments);
  } catch (error) {
    Logger.error('Error listing share attachments:', error);
    res.status(500).json({ error: 'Failed to list attachments' });
  }
});

// GET /api/share/:shareId/attachments/:attachmentId/download  — serve attachment for shared snippet
router.get('/:shareId/attachments/:attachmentId/download', async (req, res) => {
  try {
    const share = await shareRepository.getShare(req.params.shareId);
    if (!share) return res.status(404).json({ error: 'Share not found' });
    if (share.share?.expired) return res.status(410).json({ error: 'Share has expired' });

    const attachment = attachmentRepository.findById(req.params.attachmentId);
    if (!attachment || String(attachment.snippet_id) !== String(share.id)) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const snippetDir = attachmentService.getSnippetAttachmentsDir(share.id);
    const filePath = path.join(snippetDir, attachment.stored_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const inlineMimeTypes = new Set([
      'application/pdf', 'image/png', 'image/jpeg',
      'image/gif', 'image/webp', 'image/bmp',
    ]);
    const disposition = inlineMimeTypes.has(attachment.mime_type)
      ? `inline; filename="${encodeURIComponent(attachment.original_name)}"`
      : `attachment; filename="${encodeURIComponent(attachment.original_name)}"`;

    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Content-Type', attachment.mime_type);
    res.setHeader('Content-Length', attachment.size_bytes);
    res.sendFile(filePath, { root: '/' }, (err) => {
      if (err && !res.headersSent) {
        Logger.error('sendFile error (share attachment):', err);
        res.status(500).json({ error: 'Failed to send file' });
      }
    });
  } catch (error) {
    Logger.error('Error downloading share attachment:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await shareRepository.deleteShare(id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    Logger.error('Error deleting share:', error);
    res.status(500).json({ error: 'Failed to delete share' });
  }
});

export default router;