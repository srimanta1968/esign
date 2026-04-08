import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { DataService } from '../services/DataService';
import { EmailService } from '../services/emailService';

/**
 * SignatureConfirmationController handles signature review and confirmation.
 * EP-248: Signature confirmation and email delivery API.
 */
export class SignatureConfirmationController {
  /**
   * Review and confirm/reject a signature application.
   * POST /api/signatures/:id/confirm
   */
  static async confirm(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const signatureId = req.params.id;
      const { confirmation_status } = req.body;

      if (!signatureId) {
        res.status(400).json({ success: false, error: 'Signature ID is required' });
        return;
      }

      const validStatuses = ['confirmed', 'rejected'];
      if (!confirmation_status || !validStatuses.includes(confirmation_status)) {
        res.status(400).json({
          success: false,
          error: `confirmation_status must be one of: ${validStatuses.join(', ')}`,
        });
        return;
      }

      // Get the signature
      const signature = await DataService.queryOne<{
        id: string;
        document_id: string;
        signer_email: string;
        status: string;
        confirmation_status: string;
      }>(
        'SELECT id, document_id, signer_email, status, confirmation_status FROM signatures WHERE id = $1',
        [signatureId]
      );

      if (!signature) {
        res.status(404).json({ success: false, error: 'Signature not found' });
        return;
      }

      // Update confirmation status
      const updated = await DataService.queryOne<{
        id: string;
        document_id: string;
        signer_email: string;
        status: string;
        confirmation_status: string;
      }>(
        `UPDATE signatures SET confirmation_status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, document_id, signer_email, status, confirmation_status`,
        [confirmation_status, signatureId]
      );

      if (!updated) {
        res.status(500).json({ success: false, error: 'Failed to update confirmation status' });
        return;
      }

      // Get document info for the email
      const document = await DataService.queryOne<{ id: string; title: string; user_id: string }>(
        'SELECT id, title, user_id FROM documents WHERE id = $1',
        [updated.document_id]
      );

      // Get user name for the email
      const user = await DataService.queryOne<{ name: string; email: string }>(
        'SELECT name, email FROM users WHERE id = $1',
        [req.userId]
      );

      // Send confirmation email
      let emailResult = null;
      try {
        emailResult = await EmailService.sendSignatureConfirmation(
          updated.signer_email,
          user?.name || user?.email || 'Unknown',
          {
            documentId: updated.document_id,
            documentName: document?.title,
          },
          confirmation_status
        );
      } catch (emailError: any) {
        console.error('Failed to send confirmation email:', emailError.message);
        // Don't fail the request if email fails
      }

      res.status(200).json({
        success: true,
        data: {
          signature: {
            id: updated.id,
            document_id: updated.document_id,
            signer_email: updated.signer_email,
            status: updated.status,
            confirmation_status: updated.confirmation_status,
          },
          email: emailResult ? {
            sent: emailResult.success,
            messageId: emailResult.messageId,
            previewUrl: emailResult.previewUrl || undefined,
          } : { sent: false },
        },
      });
    } catch (error: any) {
      console.error('Signature confirmation error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export default SignatureConfirmationController;
