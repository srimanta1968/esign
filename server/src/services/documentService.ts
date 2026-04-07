import { DataService } from './DataService';
import { Document, DocumentResponse } from '../types/document';

/**
 * DocumentService handles document-related database operations.
 */
export class DocumentService {
  /**
   * Upload a new document record.
   */
  static async upload(userId: string, filePath: string): Promise<DocumentResponse> {
    try {
      const now: Date = new Date();
      const document = await DataService.queryOne<Document>(
        'INSERT INTO documents (user_id, file_path, uploaded_at) VALUES ($1, $2, $3) RETURNING id, user_id, file_path, uploaded_at',
        [userId, filePath, now]
      );

      if (!document) {
        throw new Error('Failed to create document record');
      }

      return {
        id: document.id,
        user_id: document.user_id,
        file_path: document.file_path,
        uploaded_at: document.uploaded_at.toISOString(),
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Failed to create document record') {
        throw error;
      }
      throw new Error(`Document upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default DocumentService;
