import { DataService } from './DataService';
import { AnalyticsEvent, AnalyticsEventResponse } from '../types/compliance';

/**
 * AnalyticsService handles signature engagement event tracking.
 */
export class AnalyticsService {
  /**
   * Track a signature engagement event.
   */
  static async trackEvent(
    eventType: string,
    userId: string,
    metadata: Record<string, any> = {}
  ): Promise<AnalyticsEventResponse> {
    try {
      const event = await DataService.queryOne<AnalyticsEvent>(
        `INSERT INTO analytics_events (event_type, user_id, metadata)
         VALUES ($1, $2, $3)
         RETURNING id, event_type, user_id, metadata, created_at`,
        [eventType, userId, JSON.stringify(metadata)]
      );

      if (!event) {
        throw new Error('Failed to track analytics event');
      }

      return {
        id: event.id,
        event_type: event.event_type,
        user_id: event.user_id,
        metadata: event.metadata,
        created_at: event.created_at.toISOString(),
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Failed to track analytics event') {
        throw error;
      }
      throw new Error(`Analytics event tracking failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get events by user ID.
   */
  static async getByUserId(userId: string): Promise<AnalyticsEventResponse[]> {
    try {
      const events = await DataService.queryAll<AnalyticsEvent>(
        'SELECT id, event_type, user_id, metadata, created_at FROM analytics_events WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );

      return events.map((evt: AnalyticsEvent): AnalyticsEventResponse => ({
        id: evt.id,
        event_type: evt.event_type,
        user_id: evt.user_id,
        metadata: evt.metadata,
        created_at: evt.created_at.toISOString(),
      }));
    } catch (error: unknown) {
      throw new Error(`Failed to retrieve analytics events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default AnalyticsService;
