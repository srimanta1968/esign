import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { DataService } from '../services/DataService';
import { AccessStatus, UserRole } from '../types/user';

/**
 * Request authenticated as a platform administrator.
 *
 * Distinct from RoleAuthenticatedRequest: `platform_admin` is an INTERNAL
 * staff role, not the tenant-level `admin` role that customers can hold.
 */
export interface PlatformAdminRequest extends AuthenticatedRequest {
  adminId?: string;
  adminEmail?: string;
}

interface AdminRow {
  id: string;
  email: string;
  role: UserRole;
  access_status: AccessStatus | null;
}

/**
 * Guard for every /api/admin route.
 *
 * Applied at the ROUTER level (router.use) rather than per-endpoint, so a new
 * admin endpoint cannot be added unguarded by omission.
 *
 * The role is re-read from the database on every request rather than trusted
 * from the JWT claim, so revoking a staff account takes effect immediately
 * instead of when their token happens to expire.
 */
export async function requirePlatformAdmin(
  req: PlatformAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const admin = await DataService.queryOne<AdminRow>(
      'SELECT id, email, role, access_status FROM users WHERE id = $1',
      [req.userId]
    );

    if (!admin) {
      res.status(401).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // A tenant-level 'admin' is NOT a platform admin. Only 'platform_admin'
    // passes, so customer admins cannot reach the platform console.
    if (admin.role !== 'platform_admin') {
      res.status(403).json({
        success: false,
        error: 'Platform administrator access required',
        code: 'NOT_PLATFORM_ADMIN',
      });
      return;
    }

    // A suspended or revoked staff account loses portal access immediately.
    if (admin.access_status && admin.access_status !== 'active') {
      res.status(403).json({
        success: false,
        error: 'Platform administrator access has been revoked',
        code: 'ACCESS_REVOKED',
      });
      return;
    }

    req.adminId = admin.id;
    req.adminEmail = admin.email;
    req.userRole = admin.role;

    next();
  } catch {
    res.status(500).json({
      success: false,
      error: 'Platform administrator authorization check failed',
    });
  }
}

export default requirePlatformAdmin;
