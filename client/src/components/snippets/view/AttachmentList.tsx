import React, { useEffect, useState } from 'react';
import { Paperclip, Download, ExternalLink } from 'lucide-react';
import { Attachment } from '../../../types/attachments';
import { attachmentService } from '../../../service/attachmentService';

// SVG intentionally excluded — it can contain <script> tags.
const INLINE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
]);

interface AttachmentListProps {
  snippetId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AttachmentList: React.FC<AttachmentListProps> = ({ snippetId }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attachmentService
      .list(snippetId)
      .then(setAttachments)
      .catch(() => setAttachments([]))
      .finally(() => setLoading(false));
  }, [snippetId]);

  if (loading || attachments.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2">
        <Paperclip size={13} />
        <span>Attachments ({attachments.length})</span>
      </div>
      <div className="flex flex-col gap-1">
        {attachments.map((a) => {
          const isInline = INLINE_MIME_TYPES.has(a.mime_type);
          return (
            <a
              key={a.id}
              href={attachmentService.getDownloadUrl(snippetId, a.id)}
              {...(isInline
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : { download: a.original_name })}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-light-hover/60 dark:bg-dark-hover/60 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors group text-sm text-light-text dark:text-dark-text"
            >
              <Paperclip size={14} className="shrink-0 text-light-text-secondary dark:text-dark-text-secondary" />
              <span className="flex-1 truncate">{a.original_name}</span>
              <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary shrink-0">
                {formatBytes(a.size_bytes)}
              </span>
              {isInline
                ? <ExternalLink size={14} className="shrink-0 text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                : <Download size={14} className="shrink-0 text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
              }
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default AttachmentList;
