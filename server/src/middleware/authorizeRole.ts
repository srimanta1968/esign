import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { DataService } from '../services/DataService';
import { User, UserRole } from '../types/user';

/**
 * Extended authenticated request that includes role information.
 */
export interface RoleAuthenticatedRequest extends AuthenticatedRequest {
  userRole?: UserRole;
  organizationId?: string | null;
}

/**
 * Middleware factory that authorizes users based on their roles.
 * Must be used after authenticateToken middleware.
 */
export function authorizeRole(...allowedRoles: UserRole[]) {
  return async (req: RoleAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const user = await DataService.queryOne<User>(
        'SELECT role, organization_id FROM users WHERE id = $1',
        [req.userId]
      );

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      const userRole: UserRole = user.role || 'user';
      req.userRole = userRole;
      req.organizationId = user.organization_id || null;

      if (!allowedRoles.includes(userRole)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      next();
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: 'Authorization check failed',
      });
    }
  };
}

export default authorizeRole;
