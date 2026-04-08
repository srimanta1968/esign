import { DataService } from './DataService';
import {
  Document,
  DocumentResponse,
  DocumentVersion,
  DocumentVersionResponse,
  DocumentTemplate,
  DocumentTemplateResponse,
  DocumentTag,
  DocumentTagResponse,
} from '../types/document';

/**
 * Allowed MIME types for document upload validation.
 */
const ALLOWED_MIME_TYPES: string[] = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
  'image/png',
  'image/jpeg',
];

/**
 * Map MIME type to a simple file_type label.
 */
function detectFileType(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'text/plain': 'txt',
    'image/png': 'png',
    'image/jpeg': 'jpeg',
  };
  return map[mimeType] || 'unknown';
}

/**
 * DocumentService handles document-related database operations.
 */
export class DocumentService {
  /**
   * Ensure the original_name column exists (safe migration).
   */
  static async ensureSchema(): Promise<void> {
    try {
      await DataService.query(
        `ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_name VARCHAR(255) DEFAULT ''`
      );
    } catch {
      // Column might already exist, ignore
    }
  }

  /**
   * Validate that the MIME type is allowed.
   */
  static validateMimeType(mimeType: string): boolean {
    return ALLOWED_MIME_TYPES.includes(mimeType);
  }

  /**
   * Upload a new document record with multi-format support.
   */
  static async upload(
    userId: string,
    filePath: string,
    originalName: string = '',
    mimeType: string = '',
    fileSize: number = 0
  ): Promise<DocumentResponse> {
    try {
      await DocumentService.ensureSchema();
      const now: Date = new Date();
      const fileType: string = detectFileType(mimeType);
      const document = await DataService.queryOne<Document>(
        `INSERT INTO documents (user_id, file_path, original_name, mime_type, file_type, file_size, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, user_id, file_path, original_name, mime_type, file_type, file_size, uploaded_at`,
        [userId, filePath, originalName, mimeType, fileType, fileSize, now]
      );

      if (!document) {
        throw new Error('Failed to create document record');
      }

      return {
        id: document.id,
        user_id: document.user_id,
        file_path: document.file_path,
        original_name: document.original_name || '',
        mime_type: document.mime_type,
        file_type: document.file_type,
        file_size: document.file_size,
        uploaded_at: document.uploaded_at.toISOString(),
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Failed to create document record') {
        throw error;
      }
      throw new Error(`Document upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all documents for a user.
   */
  static async getByUserId(userId: string): Promise<DocumentResponse[]> {
    try {
      const documents = await DataService.queryAll<Document>(
        `SELECT id, user_id, file_path, COALESCE(original_name, file_path) as original_name,
                COALESCE(mime_type, '') as mime_type, COALESCE(file_type, '') as file_type,
                COALESCE(file_size, 0) as file_size, uploaded_at
         FROM documents WHERE user_id = $1 ORDER BY uploaded_at DESC`,
        [userId]
      );

      return documents.map((doc: Document): DocumentResponse => ({
        id: doc.id,
        user_id: doc.user_id,
        file_path: doc.file_path,
        original_name: doc.original_name || doc.file_path,
        mime_type: doc.mime_type,
        file_type: doc.file_type,
        file_size: doc.file_size,
        uploaded_at: doc.uploaded_at.toISOString(),
      }));
    } catch (error: unknown) {
      throw new Error(`Failed to retrieve documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a single document by ID, scoped to user.
   */
  static async getById(documentId: string, userId: string): Promise<DocumentResponse | null> {
    try {
      const document = await DataService.queryOne<Document>(
        `SELECT id, user_id, file_path, COALESCE(original_name, file_path) as original_name,
                COALESCE(mime_type, '') as mime_type, COALESCE(file_type, '') as file_type,
                COALESCE(file_size, 0) as file_size, uploaded_at
         FROM documents WHERE id = $1 AND user_id = $2`,
        [documentId, userId]
      );

      if (!document) {
        return null;
      }

      return {
        id: document.id,
        user_id: document.user_id,
        file_path: document.file_path,
        original_name: document.original_name || document.file_path,
        mime_type: document.mime_type,
        file_type: document.file_type,
        file_size: document.file_size,
        uploaded_at: document.uploaded_at.toISOString(),
      };
    } catch (error: unknown) {
      throw new Error(`Failed to retrieve document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a document by ID, scoped to user.
   */
  static async deleteById(documentId: string, userId: string): Promise<boolean> {
    try {
      const result = await DataService.query(
        'DELETE FROM documents WHERE id = $1 AND user_id = $2',
        [documentId, userId]
      );

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error: unknown) {
      throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===================== VERSIONING =====================

  /**
   * Create a new version for a document.
   */
  static async createVersion(
    documentId: string,
    userId: string,
    filePath: string,
    fileSize: number
  ): Promise<DocumentVersionResponse> {
    try {
      // Get the latest version number
      const latest = await DataService.queryOne<{ max_version: number }>(
        'SELECT COALESCE(MAX(version_number), 0) as max_version FROM document_versions WHERE document_id = $1',
        [documentId]
      );
      const nextVersion: number = (latest?.max_version || 0) + 1;

      const version = await DataService.queryOne<DocumentVersion>(
        `INSERT INTO document_versions (document_id, version_number, file_path, file_size, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, document_id, version_number, file_path, file_size, created_by, created_at`,
        [documentId, nextVersion, filePath, fileSize, userId]
      );

      if (!version) {
        throw new Error('Failed to create document version');
      }

      return {
        id: version.id,
        document_id: version.document_id,
        version_number: version.version_number,
        file_path: version.file_path,
        file_size: version.file_size,
        created_by: version.created_by,
        created_at: version.created_at.toISOString(),
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Failed to create document version') throw error;
      throw new Error(`Version creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all versions for a document.
   */
  static async getVersions(documentId: string): Promise<DocumentVersionResponse[]> {
    try {
      const versions = await DataService.queryAll<DocumentVersion>(
        `SELECT id, document_id, version_number, file_path, file_size, created_by, created_at
         FROM document_versions WHERE document_id = $1 ORDER BY version_number DESC`,
        [documentId]
      );

      return versions.map((v: DocumentVersion): DocumentVersionResponse => ({
        id: v.id,
        document_id: v.document_id,
        version_number: v.version_number,
        file_path: v.file_path,
        file_size: v.file_size,
        created_by: v.created_by,
        created_at: v.created_at.toISOString(),
      }));
    } catch (error: unknown) {
      throw new Error(`Failed to retrieve versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Revert document to a specific version.
   */
  static async revertToVersion(
    documentId: string,
    versionId: string,
    userId: string
  ): Promise<DocumentVersionResponse> {
    try {
      // Get the version to revert to
      const version = await DataService.queryOne<DocumentVersion>(
        'SELECT * FROM document_versions WHERE id = $1 AND document_id = $2',
        [versionId, documentId]
      );

      if (!version) {
        throw new Error('Version not found');
      }

      // Update the document's file_path to the version's file_path
      await DataService.query(
        'UPDATE documents SET file_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
        [version.file_path, documentId, userId]
      );

      // Create a new version entry recording the revert
      const revertedVersion = await DocumentService.createVersion(
        documentId,
        userId,
        version.file_path,
        version.file_size
      );

      return revertedVersion;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Version not found') throw error;
      throw new Error(`Version revert failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===================== TEMPLATES =====================

  /**
   * Create a template from a document or from scratch.
   */
  static async createTemplate(
    userId: string,
    name: string,
    description: string,
    filePath: string
  ): Promise<DocumentTemplateResponse> {
    try {
      const template = await DataService.queryOne<DocumentTemplate>(
        `INSERT INTO document_templates (user_id, name, description, file_path)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, name, description, file_path, created_at, updated_at`,
        [userId, name, description, filePath]
      );

      if (!template) {
        throw new Error('Failed to create template');
      }

      return {
        id: template.id,
        user_id: template.user_id,
        name: template.name,
        description: template.description,
        file_path: template.file_path,
        created_at: template.created_at.toISOString(),
        updated_at: template.updated_at.toISOString(),
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Failed to create template') throw error;
      throw new Error(`Template creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all templates for a user.
   */
  static async getTemplates(userId: string): Promise<DocumentTemplateResponse[]> {
    try {
      const templates = await DataService.queryAll<DocumentTemplate>(
        `SELECT id, user_id, name, description, file_path, created_at, updated_at
         FROM document_templates WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );

      return templates.map((t: DocumentTemplate): DocumentTemplateResponse => ({
        id: t.id,
        user_id: t.user_id,
        name: t.name,
        description: t.description,
        file_path: t.file_path,
        created_at: t.created_at.toISOString(),
        updated_at: t.updated_at.toISOString(),
      }));
    } catch (error: unknown) {
      throw new Error(`Failed to retrieve templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a single template by ID.
   */
  static async getTemplateById(templateId: string, userId: string): Promise<DocumentTemplateResponse | null> {
    try {
      const template = await DataService.queryOne<DocumentTemplate>(
        `SELECT id, user_id, name, description, file_path, created_at, updated_at
         FROM document_templates WHERE id = $1 AND user_id = $2`,
        [templateId, userId]
      );

      if (!template) return null;

      return {
        id: template.id,
        user_id: template.user_id,
        name: template.name,
        description: template.description,
        file_path: template.file_path,
        created_at: template.created_at.toISOString(),
        updated_at: template.updated_at.toISOString(),
      };
    } catch (error: unknown) {
      throw new Error(`Failed to retrieve template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a template by ID.
   */
  static async deleteTemplate(templateId: string, userId: string): Promise<boolean> {
    try {
      const result = await DataService.query(
        'DELETE FROM document_templates WHERE id = $1 AND user_id = $2',
        [templateId, userId]
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error: unknown) {
      throw new Error(`Failed to delete template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===================== TAGS =====================

  /**
   * Add tags to a document.
   */
  static async addTags(documentId: string, tags: string[]): Promise<DocumentTagResponse[]> {
    try {
      const results: DocumentTagResponse[] = [];
      for (const tag of tags) {
        const trimmed = tag.trim().toLowerCase();
        if (!trimmed) continue;
        const existing = await DataService.queryOne<DocumentTag>(
          'SELECT * FROM document_tags WHERE document_id = $1 AND tag = $2',
          [documentId, trimmed]
        );
        if (existing) {
          results.push({
            id: existing.id,
            document_id: existing.document_id,
            tag: existing.tag,
            created_at: existing.created_at.toISOString(),
          });
          continue;
        }
        const tagRow = await DataService.queryOne<DocumentTag>(
          `INSERT INTO document_tags (document_id, tag) VALUES ($1, $2)
           RETURNING id, document_id, tag, created_at`,
          [documentId, trimmed]
        );
        if (tagRow) {
          results.push({
            id: tagRow.id,
            document_id: tagRow.document_id,
            tag: tagRow.tag,
            created_at: tagRow.created_at.toISOString(),
          });
        }
      }
      return results;
    } catch (error: unknown) {
      throw new Error(`Failed to add tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all tags for a document.
   */
  static async getTags(documentId: string): Promise<DocumentTagResponse[]> {
    try {
      const tags = await DataService.queryAll<DocumentTag>(
        'SELECT id, document_id, tag, created_at FROM document_tags WHERE document_id = $1 ORDER BY tag ASC',
        [documentId]
      );
      return tags.map((t: DocumentTag): DocumentTagResponse => ({
        id: t.id,
        document_id: t.document_id,
        tag: t.tag,
        created_at: t.created_at.toISOString(),
      }));
    } catch (error: unknown) {
      throw new Error(`Failed to retrieve tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove a tag from a document.
   */
  static async removeTag(documentId: string, tag: string): Promise<boolean> {
    try {
      const result = await DataService.query(
        'DELETE FROM document_tags WHERE document_id = $1 AND tag = $2',
        [documentId, tag.trim().toLowerCase()]
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error: unknown) {
      throw new Error(`Failed to remove tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search documents by query, tags, type, with sorting.
   */
  static async search(
    userId: string,
    options: { q?: string; tags?: string; type?: string; sort?: string }
  ): Promise<DocumentResponse[]> {
    try {
      let query = `
        SELECT DISTINCT d.id, d.user_id, d.file_path,
               COALESCE(d.original_name, d.file_path) as original_name,
               COALESCE(d.mime_type, '') as mime_type,
               COALESCE(d.file_type, '') as file_type,
               COALESCE(d.file_size, 0) as file_size,
               d.uploaded_at
        FROM documents d
      `;
      const params: any[] = [userId];
      let paramIndex = 2;
      const conditions: string[] = ['d.user_id = $1'];

      // Join tags table if filtering by tags
      if (options.tags) {
        const tagList = options.tags.split(',').map(t => t.trim().toLowerCase());
        query += ` INNER JOIN document_tags dt ON d.id = dt.document_id`;
        conditions.push(`dt.tag = ANY($${paramIndex})`);
        params.push(tagList);
        paramIndex++;
      }

      // Text search on original_name
      if (options.q) {
        conditions.push(`LOWER(COALESCE(d.original_name, '')) LIKE $${paramIndex}`);
        params.push(`%${options.q.toLowerCase()}%`);
        paramIndex++;
      }

      // Filter by file type
      if (options.type) {
        conditions.push(`d.file_type = $${paramIndex}`);
        params.push(options.type.toLowerCase());
        paramIndex++;
      }

      query += ` WHERE ${conditions.join(' AND ')}`;

      // Sorting
      const sortMap: Record<string, string> = {
        'name_asc': 'original_name ASC',
        'name_desc': 'original_name DESC',
        'date_asc': 'uploaded_at ASC',
        'date_desc': 'uploaded_at DESC',
        'size_asc': 'file_size ASC',
        'size_desc': 'file_size DESC',
      };
      const sortClause = sortMap[options.sort || ''] || 'uploaded_at DESC';
      query += ` ORDER BY d.${sortClause}`;

      const documents = await DataService.queryAll<Document>(query, params);

      return documents.map((doc: Document): DocumentResponse => ({
        id: doc.id,
        user_id: doc.user_id,
        file_path: doc.file_path,
        original_name: doc.original_name || doc.file_path,
        mime_type: doc.mime_type,
        file_type: doc.file_type,
        file_size: doc.file_size,
        uploaded_at: doc.uploaded_at.toISOString(),
      }));
    } catch (error: unknown) {
      throw new Error(`Document search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default DocumentService;
