import { Response } from 'express';
import { DocumentService } from '../services/documentService';
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

      const { file_path, original_name }: UploadDocumentRequest = req.body;

      if (!file_path) {
        res.status(400).json({
          success: false,
          error: 'file_path is required',
        });
        return;
      }

      const document = await DocumentService.upload(userId, file_path);

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
        error: 'Internal server error',
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
}

export default DocumentController;
