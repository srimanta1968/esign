import { Response } from 'express';
import fs from 'fs';
import { DocumentService } from '../services/documentService';
import { StorageService } from '../services/storageService';
import { AuthenticatedRequest } from '../middleware/auth';
import { UploadDocumentRequest } from '../types/document';

/**
 * DocumentController handles HTTP requests for document endpoints.
 */
export class DocumentController {
  /**
   * Handle document upload.
   * POST /api/documents
   */
  static async upload(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId: string | undefined = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      const file: Express.Multer.File | undefined = req.file;

      if (!file) {
        res.status(400).json({
          success: false,
          error: 'File is required',
        });
        return;
      }

      // Validate MIME type server-side
      if (!DocumentService.validateMimeType(file.mimetype)) {
        res.status(400).json({
          success: false,
          error: 'Invalid file type. Allowed: PDF, DOC, DOCX, XLSX, XLS, TXT, PNG, JPEG',
        });
        return;
      }

      // Generate a temporary document ID for the S3 key
      const tempDocId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

      // Upload to S3 via StorageService
      const storageResult = await StorageService.store(file.path, 'originals', {
        userId,
        documentId: tempDocId,
        filename: file.originalname,
      });

      if (!storageResult.success) {
        res.status(500).json({ success: false, error: 'Failed to store document' });
        return;
      }

      // Delete the temp file
      fs.unlink(file.path, () => {});

      const document = await DocumentService.upload(userId, storageResult.path, file.originalname, file.mimetype, file.size);

      res.status(201).json({
        success: true,
        data: {
          document,
        },
      });
    } catch (error: any) {
      console.error('Document upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  }
  /**
   * Handle document retrieval for authenticated user.
   * GET /api/documents
   */
  static async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId: string | undefined = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      const documents = await DocumentService.getByUserId(userId);

      res.status(200).json({
        success: true,
        data: {
          documents,
        },
      });
    } catch (error: any) {
      console.error('Document retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
  /**
   * Handle getting a single document by ID.
   * GET /api/documents/:id
   */
  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const documentId: string = req.params.id;
      const document = await DocumentService.getById(documentId, req.userId);

      if (!document) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: { document },
      });
    } catch (error: any) {
      console.error('Document retrieval error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Handle deleting a document by ID.
   * DELETE /api/documents/:id
   */
  static async deleteById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const documentId: string = req.params.id;
      const deleted: boolean = await DocumentService.deleteById(documentId, req.userId);

      if (!deleted) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      res.status(200).json({ success: true, message: 'Document deleted' });
    } catch (error: any) {
      console.error('Document deletion error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Handle document download.
   * GET /api/documents/:id/download
   */
  static async download(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const documentId: string = req.params.id;
      const document = await DocumentService.getById(documentId, req.userId);

      if (!document) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      const downloadName: string = document.original_name || 'document';

      try {
        const fileBuffer = await StorageService.getFile(document.file_path);
        if (document.mime_type) {
          res.setHeader('Content-Type', document.mime_type);
        }
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.send(fileBuffer);
      } catch (err) {
        console.error('Download error:', err);
        res.status(404).json({ success: false, error: 'File not found' });
      }
    } catch (error: any) {
      console.error('Document download error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export default DocumentController;
