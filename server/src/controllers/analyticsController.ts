import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AnalyticsService } from '../services/analyticsService';

/**
 * AnalyticsController handles signature engagement event tracking endpoints.
 * EP-248: Multi-language and compliance API.
 */
export class AnalyticsController {
  /**
   * Track a signature engagement event.
   * POST /api/analytics/signature-event
   */
  static async trackSignatureEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const { event_type, metadata } = req.body;

      if (!event_type) {
        res.status(400).json({ success: false, error: 'event_type is required' });
        return;
      }

      const event = await AnalyticsService.trackEvent(
        event_type,
        req.userId,
        metadata || {}
      );

      res.status(201).json({
        success: true,
        data: { event },
      });
    } catch (error: any) {
      console.error('Analytics event tracking error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export default AnalyticsController;
