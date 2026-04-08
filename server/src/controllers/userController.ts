import { Response } from 'express';
import { UserService } from '../services/userService';
import { AuthenticatedRequest } from '../middleware/auth';
import { RoleAuthenticatedRequest } from '../middleware/authorizeRole';
import { UserRole } from '../types/user';

/**
 * UserController handles HTTP requests for user management endpoints.
 */
export class UserController {
  /**
   * List available roles.
   * GET /api/users/roles
   */
  static async getRoles(_req: RoleAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = UserService.getAvailableRoles();

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Get roles error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * List all users (admin only).
   * GET /api/users
   */
  static async listUsers(req: RoleAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const users = await UserService.listUsers(req.organizationId);

      res.status(200).json({
        success: true,
        data: users,
      });
    } catch (error: any) {
      console.error('List users error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Assign role to a user (admin only).
   * PUT /api/users/:id/role
   */
  static async assignRole(req: RoleAuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { role } = req.body as { role: UserRole };

      if (!role) {
        res.status(400).json({
          success: false,
          error: 'Role is required',
        });
        return;
      }

      const user = await UserService.assignRole(id, role);

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      if (error.message === 'Invalid role') {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      if (error.message === 'User not found') {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }

      console.error('Assign role error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
  /**
   * Update user's language preference.
   * PUT /api/users/language
   * EP-248: Multi-language support.
   */
  static async updateLanguage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const { language_preference } = req.body;

      if (!language_preference || typeof language_preference !== 'string') {
        res.status(400).json({
          success: false,
          error: 'language_preference is required and must be a string',
        });
        return;
      }

      // Validate language code format (e.g., en, es, fr, de, zh, ja, etc.)
      const validLanguagePattern = /^[a-z]{2}(-[A-Z]{2})?$/;
      if (!validLanguagePattern.test(language_preference)) {
        res.status(400).json({
          success: false,
          error: 'Invalid language code format. Use ISO 639-1 format (e.g., en, es, fr, de)',
        });
        return;
      }

      const result = await UserService.updateLanguagePreference(req.userId, language_preference);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'User not found') {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }
      console.error('Update language error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export default UserController;
