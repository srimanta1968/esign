import { Response } from 'express';
import { UserSignatureService } from '../services/userSignatureService';
import { AuthenticatedRequest } from '../middleware/auth';
import { CreateUserSignatureRequest } from '../types/userSignature';

/**
 * UserSignatureController handles HTTP requests for user signature endpoints.
 */
export class UserSignatureController {
  /**
   * Handle creating a user signature.
   * POST /api/user-signatures
   */
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const { signature_type }: CreateUserSignatureRequest = req.body;

      if (!signature_type) {
        res.status(400).json({
          success: false,
          error: 'signature_type is required',
        });
        return;
      }

      const userSignature = await UserSignatureService.create(req.userId, signature_type);

      res.status(201).json({
        success: true,
        data: { userSignature },
      });
    } catch (error: any) {
      console.error('Signature creation error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Handle retrieving user's signatures.
   * GET /api/user-signatures
   */
  static async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const userSignatures = await UserSignatureService.getByUserId(req.userId);

      res.status(200).json({
        success: true,
        data: { userSignatures },
      });
    } catch (error: any) {
      console.error('Signature retrieval error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export default UserSignatureController;
