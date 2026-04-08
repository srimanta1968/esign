import { Response } from 'express';
import { UserSignatureService } from '../services/userSignatureService';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * UserSignatureController handles HTTP requests for user signature endpoints.
 * Enhanced for EP-248 to support drawn, typed, and uploaded signature types.
 */
export class UserSignatureController {
  /**
   * Handle creating a user signature.
   * POST /api/user-signatures
   * Supports type=drawn (base64 SVG/PNG), type=typed (font_family), type=uploaded (image file).
   */
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const { signature_type, signature_data, font_family, input_method } = req.body;

      if (!signature_type) {
        res.status(400).json({
          success: false,
          error: 'signature_type is required',
        });
        return;
      }

      const validTypes = ['drawn', 'typed', 'uploaded'];
      if (!validTypes.includes(signature_type)) {
        res.status(400).json({
          success: false,
          error: `signature_type must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      let userSignature;

      if (signature_type === 'drawn') {
        if (!signature_data) {
          res.status(400).json({
            success: false,
            error: 'signature_data (base64 SVG/PNG) is required for drawn signatures',
          });
          return;
        }
        userSignature = await UserSignatureService.createDrawn(
          req.userId,
          signature_data,
          input_method
        );
      } else if (signature_type === 'typed') {
        if (!signature_data) {
          res.status(400).json({
            success: false,
            error: 'signature_data (text) is required for typed signatures',
          });
          return;
        }
        if (!font_family) {
          res.status(400).json({
            success: false,
            error: 'font_family is required for typed signatures',
          });
          return;
        }
        userSignature = await UserSignatureService.createTyped(
          req.userId,
          signature_data,
          font_family
        );
      } else if (signature_type === 'uploaded') {
        // File should be provided via multer middleware
        const file = (req as any).file;
        if (!file) {
          res.status(400).json({
            success: false,
            error: 'Image file is required for uploaded signatures (PNG/JPEG, max 2MB)',
          });
          return;
        }

        // Validate file type
        const allowedMimes = ['image/png', 'image/jpeg'];
        if (!allowedMimes.includes(file.mimetype)) {
          res.status(400).json({
            success: false,
            error: 'Invalid file type. Only PNG and JPEG are allowed for signature uploads',
          });
          return;
        }

        // Validate file size (2MB max)
        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
          res.status(400).json({
            success: false,
            error: 'File too large. Maximum size is 2MB',
          });
          return;
        }

        userSignature = await UserSignatureService.createUploaded(
          req.userId,
          file.path,
          file.originalname
        );
      }

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
   * Handle retrieving a single signature by ID.
   * GET /api/user-signatures/:id
   */
  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const signatureId = req.params.id;
      if (!signatureId) {
        res.status(400).json({ success: false, error: 'Signature ID is required' });
        return;
      }

      const userSignature = await UserSignatureService.getById(signatureId);

      if (!userSignature) {
        res.status(404).json({ success: false, error: 'Signature not found' });
        return;
      }

      // Ensure user can only access their own signatures
      if (userSignature.user_id !== req.userId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      res.status(200).json({
        success: true,
        data: { userSignature },
      });
    } catch (error: any) {
      console.error('Signature retrieval error:', error);
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
