import { Response } from 'express';
import { SignatureService } from '../services/signatureService';
import { AuthenticatedRequest } from '../middleware/auth';
import { CreateSignatureRequest } from '../types/signature';

/**
 * SignatureController handles HTTP requests for signature endpoints.
 */
export class SignatureController {
  /**
   * Handle creating a signature request.
   * POST /api/signatures
   */
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const { document_id, signer_email }: CreateSignatureRequest = req.body;

      if (!document_id || !signer_email) {
        res.status(400).json({
          success: false,
          error: 'document_id and signer_email are required',
        });
        return;
      }

      const signature = await SignatureService.create(document_id, signer_email);

      res.status(201).json({
        success: true,
        data: { signature },
      });
    } catch (error: any) {
      console.error('Signature request error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Handle getting signature status by document.
   * GET /api/signatures/:documentId
   */
  static async getByDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const documentId: string = req.params.documentId;

      if (!documentId) {
        res.status(400).json({ success: false, error: 'documentId is required' });
        return;
      }

      const signatures = await SignatureService.getByDocumentId(documentId);

      res.status(200).json({
        success: true,
        data: { signatures },
      });
    } catch (error: any) {
      console.error('Signature retrieval error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
  /**
   * Handle signing a document (applying signature).
   * PATCH /api/signatures/:id/sign
   */
  static async sign(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const signatureId: string = req.params.id;
      const { user_signature_id }: { user_signature_id?: string } = req.body;

      if (!signatureId) {
        res.status(400).json({ success: false, error: 'Signature ID is required' });
        return;
      }

      const signature = await SignatureService.sign(signatureId, user_signature_id || '');

      if (!signature) {
        res.status(404).json({ success: false, error: 'Signature request not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: { signature },
      });
    } catch (error: any) {
      console.error('Signing error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export default SignatureController;
