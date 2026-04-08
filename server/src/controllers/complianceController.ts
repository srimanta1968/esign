import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ComplianceService } from '../services/complianceService';

/**
 * ComplianceController handles ESIGN/UETA compliance metadata endpoints.
 * EP-248: Multi-language and compliance API.
 */
export class ComplianceController {
  /**
   * Get ESIGN/UETA compliance data for a signature.
   * GET /api/compliance/esign-metadata/:signatureId
   */
  static async getEsignMetadata(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const { signatureId } = req.params;

      if (!signatureId) {
        res.status(400).json({ success: false, error: 'signatureId is required' });
        return;
      }

      const metadata = await ComplianceService.getBySignatureId(signatureId);

      if (!metadata) {
        res.status(404).json({ success: false, error: 'Compliance metadata not found for this signature' });
        return;
      }

      res.status(200).json({
        success: true,
        data: { complianceMetadata: metadata },
      });
    } catch (error: any) {
      console.error('Compliance metadata retrieval error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Create compliance metadata for a signature (internal/automatic use).
   * POST /api/compliance/esign-metadata
   */
  static async createEsignMetadata(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const { signature_id, consent_given } = req.body;

      if (!signature_id) {
        res.status(400).json({ success: false, error: 'signature_id is required' });
        return;
      }

      if (typeof consent_given !== 'boolean') {
        res.status(400).json({ success: false, error: 'consent_given (boolean) is required' });
        return;
      }

      const signerIp = req.ip || req.headers['x-forwarded-for'] as string || '';
      const userAgent = req.headers['user-agent'] || '';

      const metadata = await ComplianceService.create(
        signature_id,
        signerIp,
        userAgent,
        consent_given
      );

      res.status(201).json({
        success: true,
        data: { complianceMetadata: metadata },
      });
    } catch (error: any) {
      console.error('Compliance metadata creation error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export default ComplianceController;
