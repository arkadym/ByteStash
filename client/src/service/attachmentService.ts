import { Attachment } from '../types/attachments';
import { API_ENDPOINTS } from '../constants/api';
import { apiClient } from '../utils/api/apiClient';

const base = API_ENDPOINTS.SNIPPETS;

export const attachmentService = {
  async list(snippetId: string): Promise<Attachment[]> {
    return apiClient.get<Attachment[]>(`${base}/${snippetId}/attachments`, {
      requiresAuth: true,
    });
  },

  async upload(snippetId: string, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.append('file', file);

    const basePath = (window as any).__BASE_PATH__ || '';
    const token = localStorage.getItem('token');

    const headers: HeadersInit = {};
    if (token) {
      headers['bytestashauth'] = `Bearer ${token}`;
    }

    const response = await fetch(`${basePath}${base}/${snippetId}/attachments`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw { ...err, status: response.status };
    }

    return response.json();
  },

  getDownloadUrl(snippetId: string, attachmentId: number): string {
    const basePath = (window as any).__BASE_PATH__ || '';
    return `${basePath}${base}/${snippetId}/attachments/${attachmentId}/download`;
  },

  async delete(snippetId: string, attachmentId: number): Promise<void> {
    return apiClient.delete(`${base}/${snippetId}/attachments/${attachmentId}`, {
      requiresAuth: true,
    });
  },
};
