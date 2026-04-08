import { Router, Response, RequestHandler } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authorizeRole, RoleAuthenticatedRequest } from '../middleware/authorizeRole';
import { AuditService } from '../services/auditService';
import { ComplianceController } from '../controllers/complianceController';
// @governance-tracked — API definitions added: GET /api/compliance/report, POST /api/compliance/alerts/config, GET /api/compliance/alerts, GET /api/compliance/export, GET /api/compliance/esign-metadata/:signatureId, POST /api/compliance/esign-metadata

/**
 * Compliance routes configuration.
 * Enhanced for EP-248 with ESIGN/UETA compliance metadata endpoints.
 * API Definitions: tests/api_definitions/compliance-report.json, compliance-alerts-config.json, compliance-alerts.json, compliance-export.json, compliance-esign-metadata.json
 */

const router: Router = Router();

/**
 * GET /api/compliance/report - Generate compliance report for a date range
 */
router.get(
  '/report',
  authenticateToken as RequestHandler,
  authorizeRole('admin') as RequestHandler,
  (async (req: RoleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { dateFrom, dateTo } = req.query;

      if (!dateFrom || !dateTo) {
        res.status(400).json({
          success: false,
          error: 'dateFrom and dateTo query parameters are required',
        });
        return;
      }

      const report = await AuditService.getComplianceReport(
        dateFrom as string,
        dateTo as string
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: unknown) {
      console.error('Error generating compliance report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate compliance report',
      });
    }
  }) as RequestHandler
);

/**
 * POST /api/compliance/alerts/config - Configure alert rules (admin only)
 */
router.post(
  '/alerts/config',
  authenticateToken as RequestHandler,
  authorizeRole('admin') as RequestHandler,
  (async (req: RoleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { rule_type, threshold, enabled } = req.body;

      if (!rule_type || threshold === undefined) {
        res.status(400).json({
          success: false,
          error: 'rule_type and threshold are required',
        });
        return;
      }

      const rule = await AuditService.createAlertRule({
        rule_type,
        threshold,
        enabled,
      });

      res.status(201).json({
        success: true,
        data: rule,
      });
    } catch (error: unknown) {
      console.error('Error creating alert rule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create alert rule',
      });
    }
  }) as RequestHandler
);

/**
 * GET /api/compliance/alerts - Get triggered alerts
 */
router.get(
  '/alerts',
  authenticateToken as RequestHandler,
  authorizeRole('admin') as RequestHandler,
  (async (_req: RoleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const alerts = await AuditService.getTriggeredAlerts();

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error: unknown) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch alerts',
      });
    }
  }) as RequestHandler
);

/**
 * GET /api/compliance/export - Export audit logs as CSV
 */
router.get(
  '/export',
  authenticateToken as RequestHandler,
  authorizeRole('admin') as RequestHandler,
  (async (req: RoleAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { dateFrom, dateTo } = req.query;

      if (!dateFrom || !dateTo) {
        res.status(400).json({
          success: false,
          error: 'dateFrom and dateTo query parameters are required',
        });
        return;
      }

      const csv = await AuditService.exportAuditLogs(
        dateFrom as string,
        dateTo as string
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${dateFrom}-${dateTo}.csv`);
      res.send(csv);
    } catch (error: unknown) {
      console.error('Error exporting audit logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export audit logs',
      });
    }
  }) as RequestHandler
);

/**
 * GET /api/compliance/esign-metadata/:signatureId - Get ESIGN/UETA compliance data
 * EP-248: Multi-language and compliance API
 */
router.get(
  '/esign-metadata/:signatureId',
  authenticateToken as RequestHandler,
  ((req: AuthenticatedRequest, res: Response): void => {
    ComplianceController.getEsignMetadata(req, res);
  }) as RequestHandler
);

/**
 * POST /api/compliance/esign-metadata - Create ESIGN/UETA compliance metadata
 * EP-248: Multi-language and compliance API
 */
router.post(
  '/esign-metadata',
  authenticateToken as RequestHandler,
  ((req: AuthenticatedRequest, res: Response): void => {
    ComplianceController.createEsignMetadata(req, res);
  }) as RequestHandler
);

export default router;
