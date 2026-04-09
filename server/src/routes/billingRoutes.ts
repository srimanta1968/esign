import { Router, Request, Response, RequestHandler } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { StripeService } from '../services/stripeService';
import { SubscriptionService } from '../services/subscriptionService';
import { DataService } from '../services/DataService';

const router: Router = Router();

// POST /api/billing/checkout - create a Stripe Checkout session
router.post('/checkout', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const email = req.userEmail!;
    const { plan, interval } = req.body as { plan: string; interval: 'monthly' | 'annual' };

    if (!plan || !interval) {
      res.status(400).json({ success: false, error: 'plan and interval are required' });
      return;
    }

    if (!StripeService.isConfigured()) {
      res.status(503).json({ success: false, error: 'Stripe is not configured' });
      return;
    }

    // If user already has an active subscription, redirect to portal for upgrade
    const existing = await DataService.queryOne<{ stripe_customer_id: string; status: string }>(
      "SELECT stripe_customer_id, status FROM subscriptions WHERE user_id = $1 AND status IN ('active', 'trialing')",
      [userId]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (existing?.stripe_customer_id) {
      // Existing subscriber → portal for upgrade/downgrade (Stripe handles proration)
      const portalUrl = await StripeService.createPortalSession(existing.stripe_customer_id, `${frontendUrl}/settings/billing`);
      res.json({ success: true, url: portalUrl });
    } else {
      // New subscriber → checkout
      const url = await StripeService.createCheckoutSession(userId, email, plan, interval, frontendUrl);
      res.json({ success: true, url });
    }
  } catch (error: unknown) {
    console.error('Checkout error:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Checkout failed' });
  }
}) as RequestHandler);

// POST /api/billing/portal - create a Stripe Customer Portal session
router.post('/portal', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    if (!StripeService.isConfigured()) {
      res.status(503).json({ success: false, error: 'Stripe is not configured' });
      return;
    }

    const sub = await DataService.queryOne<{ stripe_customer_id: string }>(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1 AND stripe_customer_id IS NOT NULL',
      [userId]
    );

    if (!sub?.stripe_customer_id) {
      res.status(404).json({ success: false, error: 'No billing account found' });
      return;
    }

    const returnUrl = `${req.protocol}://${req.get('host')}`;
    const url = await StripeService.createPortalSession(sub.stripe_customer_id, returnUrl);
    res.json({ success: true, url });
  } catch (error: unknown) {
    console.error('Portal error:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: 'Portal session failed' });
  }
}) as RequestHandler);

// GET /api/billing/subscription - get current plan + usage
router.get('/subscription', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const planInfo = await SubscriptionService.getPlan(userId);
    res.json({ success: true, ...planInfo });
  } catch (error: unknown) {
    console.error('Subscription fetch error:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
  }
}) as RequestHandler);

// POST /api/billing/webhook - Stripe webhook (NO auth, raw body)
router.post('/webhook', (async (req: Request, res: Response): Promise<void> => {
  try {
    if (!StripeService.isConfigured()) {
      res.status(503).json({ error: 'Stripe not configured' });
      return;
    }

    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    const event = StripeService.verifyWebhookSignature(req.body as Buffer, signature);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        if (userId && plan) {
          await SubscriptionService.createOrUpdateSubscription(
            userId,
            plan,
            session.customer as string,
            session.subscription as string,
            null,
            null
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const sub = await DataService.queryOne<{ user_id: string }>(
          'SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1',
          [customerId]
        );
        if (sub) {
          const status = subscription.status;
          const periodStart = subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000)
            : null;
          const periodEnd = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null;

          // Detect plan change from price ID
          const priceId = subscription.items?.data?.[0]?.price?.id;
          let newPlan: string | null = null;
          if (priceId) {
            const { STRIPE_PRICE_SOLO_MONTHLY, STRIPE_PRICE_SOLO_ANNUAL, STRIPE_PRICE_TEAM_MONTHLY, STRIPE_PRICE_TEAM_ANNUAL, STRIPE_PRICE_SCALE_MONTHLY, STRIPE_PRICE_SCALE_ANNUAL } = process.env;
            if (priceId === STRIPE_PRICE_SOLO_MONTHLY || priceId === STRIPE_PRICE_SOLO_ANNUAL) newPlan = 'solo';
            else if (priceId === STRIPE_PRICE_TEAM_MONTHLY || priceId === STRIPE_PRICE_TEAM_ANNUAL) newPlan = 'team';
            else if (priceId === STRIPE_PRICE_SCALE_MONTHLY || priceId === STRIPE_PRICE_SCALE_ANNUAL) newPlan = 'scale';
          }

          await DataService.query(
            `UPDATE subscriptions SET status = $1, current_period_start = $2, current_period_end = $3${newPlan ? ', plan = $5' : ''}, updated_at = NOW() WHERE user_id = $4`,
            newPlan ? [status, periodStart, periodEnd, sub.user_id, newPlan] : [status, periodStart, periodEnd, sub.user_id]
          );

          // Also update user's plan column
          if (newPlan) {
            await DataService.query('UPDATE users SET plan = $1 WHERE id = $2', [newPlan, sub.user_id]);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const sub = await DataService.queryOne<{ user_id: string }>(
          'SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1',
          [customerId]
        );
        if (sub) {
          await SubscriptionService.cancelSubscription(sub.user_id);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;
        const sub = await DataService.queryOne<{ user_id: string }>(
          'SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1',
          [customerId]
        );
        if (sub) {
          await DataService.query(
            `UPDATE subscriptions SET status = 'past_due', updated_at = NOW() WHERE user_id = $1`,
            [sub.user_id]
          );
        }
        break;
      }

      default:
        // Unhandled event type - acknowledge receipt
        break;
    }

    res.json({ received: true });
  } catch (error: unknown) {
    console.error('Webhook error:', error instanceof Error ? error.message : error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
}) as RequestHandler);

export default router;
