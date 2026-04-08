import { Response } from 'express';
import { OrganizationService } from '../services/organizationService';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * OrganizationController handles HTTP requests for organization endpoints.
 */
export class OrganizationController {
  /**
   * Create a new organization.
   * POST /api/organizations
   */
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          error: 'Organization name is required',
        });
        return;
      }

      if (!req.userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const org = await OrganizationService.create(name, req.userId);

      res.status(201).json({
        success: true,
        data: org,
      });
    } catch (error: any) {
      if (error.message === 'Organization with this name already exists') {
        res.status(409).json({
          success: false,
          error: error.message,
        });
        return;
      }

      console.error('Create organization error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get organization by ID.
   * GET /api/organizations/:id
   */
  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const org = await OrganizationService.getById(id);

      if (!org) {
        res.status(404).json({
          success: false,
          error: 'Organization not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: org,
      });
    } catch (error: any) {
      console.error('Get organization error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}

export default OrganizationController;
