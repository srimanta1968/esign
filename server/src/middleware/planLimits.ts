import { Response, NextFunction, RequestHandler } from 'express';
import { AuthenticatedRequest } from './auth';
import { SubscriptionService } from '../services/subscriptionService';

/**
 * Middleware that checks whether the authenticated user is within their plan's
 * document limit. If the limit has been reached, responds with 403.
 * On success, calls next() and then increments usage after the response.
 *
 * For team members, usage is tracked at the team level so all members
 * share the same quota.
 */
export const checkPlanLimit: RequestHandler = (async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { allowed, used, limit, plan } = await SubscriptionService.checkLimit(userId);

    if (!allowed) {
      res.status(403).json({
        success: false,
        error: 'Plan limit reached',
        plan_limit_reached: true,
        current_plan: plan,
        usage: used,
        limit,
        upgrade_url: '/pricing',
      });
      return;
    }

    // Call next and increment usage after response finishes
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        SubscriptionService.incrementUsage(userId).catch((err) => {
          console.error('Failed to increment usage:', err instanceof Error ? err.message : err);
        });
      }
    });

    next();
  } catch (error: unknown) {
    console.error('Plan limit check error:', error instanceof Error ? error.message : error);
    // Don't block request on billing errors
    next();
  }
}) as RequestHandler;
