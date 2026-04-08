import { Router, Response, RequestHandler } from 'express';
import { AnalyticsController } from '../controllers/analyticsController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
// @governance-tracked — API definitions added: POST /api/analytics/signature-event

/**
 * Analytics routes configuration.
 * EP-248: Signature engagement event tracking.
 * API Definitions: tests/api_definitions/analytics-signature-event.json
 */

interface AnalyticsRouter {
  trackSignatureEvent: RequestHandler;
}

const analyticsHandlers: AnalyticsRouter = {
  trackSignatureEvent: (req: AuthenticatedRequest, res: Response): void => {
    AnalyticsController.trackSignatureEvent(req, res);
  },
};

const router: Router = Router();

router.post('/signature-event', authenticateToken as RequestHandler, analyticsHandlers.trackSignatureEvent);

export default router;
