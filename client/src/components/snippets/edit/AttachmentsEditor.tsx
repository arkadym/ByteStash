import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Paperclip, Trash2, Upload } from 'lucide-react';
import { Attachment } from '../../../types/attachments';
import { attachmentService } from '../../../service/attachmentService';

interface AttachmentsEditorProps {
  snippetId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AttachmentsEditor: React.FC<AttachmentsEditorProps> = ({ snippetId }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    attachmentService.list(snippetId).then(setAttachments).catch(() => setAttachments([]));
  }, [snippetId]);

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      if (fileArr.length === 0) return;

      setUploading(true);
      setError('');

      for (const file of fileArr) {
        try {
          const created = await attachmentService.upload(snippetId, file);
          setAttachments((prev) => [...prev, created]);
        } catch (err: any) {
          if (err?.status === 413) {
            showError(`File too large: ${file.name}`);
          } else {
            showError(`Upload failed: ${file.name}`);
          }
        }
      }

      setUploading(false);
    },
    [snippetId]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      uploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    try {
      await attachmentService.delete(snippetId, attachment.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch {
      showError('Failed to delete attachment');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm font-medium text-light-text dark:text-dark-text mb-2">
        <Paperclip size={14} />
        <span>Attachments</span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-md border border-dashed cursor-pointer transition-colors text-sm
          ${dragging
            ? 'border-light-primary dark:border-dark-primary bg-light-primary/5 dark:bg-dark-primary/5'
            : 'border-light-border dark:border-dark-border hover:border-light-primary dark:hover:border-dark-primary bg-light-hover/30 dark:bg-dark-hover/30'
          }`}
      >
        <Upload size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
        <span className="text-light-text-secondary dark:text-dark-text-secondary">
          {uploading ? 'Uploading…' : 'Click or drop files to attach'}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="flex flex-col gap-1 mt-2">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-light-hover/60 dark:bg-dark-hover/60 text-sm text-light-text dark:text-dark-text group"
            >
              <Paperclip size={14} className="shrink-0 text-light-text-secondary dark:text-dark-text-secondary" />
              <span className="flex-1 truncate">{a.original_name}</span>
              <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary shrink-0">
                {formatBytes(a.size_bytes)}
              </span>
              <a
                href={attachmentService.getDownloadUrl(snippetId, a.id)}
                download={a.original_name}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 p-1 rounded hover:bg-light-hover dark:hover:bg-dark-hover transition-colors text-light-text-secondary dark:text-dark-text-secondary"
                title="Download"
              >
                <Download size={13} />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(a)}
                className="shrink-0 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-light-text-secondary dark:text-dark-text-secondary hover:text-red-600 dark:hover:text-red-400"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttachmentsEditor;
