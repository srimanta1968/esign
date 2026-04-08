import { Router, Response, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole, RoleAuthenticatedRequest } from '../middleware/authorizeRole';
import { AuditService } from '../services/auditService';
// @governance-tracked — API definitions added: GET /api/audit-logs

/**
 * Audit log routes configuration.
 * API Definition: tests/api_definitions/audit-logs-search.json
 */

const router: Router = Router();

/**
 * GET /api/audit-logs - Search and filter audit logs with pagination (admin only)
 */
router.get(
  '/',
  authenticateToken as RequestHandler,
  authorizeRole('admin') as RequestHandler,
  (async (req: RoleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        dateFrom,
        dateTo,
        userId,
        action,
        resourceType,
        page,
        limit,
      } = req.query;

      const result = await AuditService.getAuditLogs({
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
        userId: userId as string | undefined,
        action: action as string | undefined,
        resourceType: resourceType as string | undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch audit logs',
      });
    }
  }) as RequestHandler
);

export default router;
