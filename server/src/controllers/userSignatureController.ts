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
            error: 'signature_data is required for typed signatures',
          });
          return;
        }
        userSignature = await UserSignatureService.createTyped(
          req.userId,
          signature_data,
          font_family || 'default'
        );
      } else if (signature_type === 'uploaded') {
        // Accept either a multer file upload or a base64 data URL in signature_data
        const file = (req as any).file;
        if (file) {
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
          if (file.size > 2 * 1024 * 1024) {
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
        } else if (signature_data) {
          // Base64 data URL from frontend (file already read client-side)
          userSignature = await UserSignatureService.createDrawn(
            req.userId,
            signature_data,
            'uploaded'
          );
        } else {
          res.status(400).json({
            success: false,
            error: 'Either an image file or signature_data (base64) is required for uploaded signatures',
          });
          return;
        }
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
  /**
   * Handle updating a user signature (re-draw).
   * PUT /api/user-signatures/:id
   */
  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const signatureId = req.params.id;
      const { signature_data } = req.body;

      if (!signature_data) {
        res.status(400).json({ success: false, error: 'signature_data is required' });
        return;
      }

      const userSignature = await UserSignatureService.updateDrawn(signatureId, req.userId, signature_data);

      if (!userSignature) {
        res.status(404).json({ success: false, error: 'Signature not found' });
        return;
      }

      res.status(200).json({ success: true, data: { userSignature } });
    } catch (error: any) {
      console.error('Signature update error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Handle deleting a user signature.
   * DELETE /api/user-signatures/:id
   */
  static async deleteById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const signatureId = req.params.id;
      const deleted = await UserSignatureService.deleteById(signatureId, req.userId);

      if (!deleted) {
        res.status(404).json({ success: false, error: 'Signature not found' });
        return;
      }

      res.status(200).json({ success: true, message: 'Signature deleted' });
    } catch (error: any) {
      console.error('Signature deletion error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export default UserSignatureController;
