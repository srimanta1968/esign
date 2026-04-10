import StripeConstructor from 'stripe';

type StripeInstance = InstanceType<typeof StripeConstructor>;

const PLAN_PRICES: Record<string, { monthly: string; annual: string }> = {
  solo: {
    monthly: process.env.STRIPE_PRICE_SOLO_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_SOLO_ANNUAL || '',
  },
  team: {
    monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_TEAM_ANNUAL || '',
  },
  scale: {
    monthly: process.env.STRIPE_PRICE_SCALE_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_SCALE_ANNUAL || '',
  },
};

// Plan document limits
export const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  solo: 50,
  team: 200,
  scale: 1000,
};

// Max team members per plan (0 = teams not supported)
export const TEAM_MEMBER_LIMITS: Record<string, number> = {
  free: 0,
  solo: 0,
  team: 10,
  scale: 999,
};

export class StripeService {
  private static stripe: StripeInstance | null = null;

  static getStripe(): StripeInstance {
    if (!StripeService.stripe) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
      StripeService.stripe = new StripeConstructor(key, { apiVersion: '2024-12-18.acacia' as any });
    }
    return StripeService.stripe;
  }

  static isConfigured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY;
  }

  static async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    // check DB first
    const { DataService } = await import('./DataService');
    const existing = await DataService.queryOne<{ stripe_customer_id: string }>(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1 AND stripe_customer_id IS NOT NULL',
      [userId]
    );
    if (existing?.stripe_customer_id) return existing.stripe_customer_id;

    const stripe = StripeService.getStripe();
    const customer = await stripe.customers.create({ email, metadata: { userId } });
    return customer.id;
  }

  static async createCheckoutSession(
    userId: string, email: string, plan: string, interval: 'monthly' | 'annual' | 'year', returnUrl: string
  ): Promise<string> {
    const stripe = StripeService.getStripe();
    const customerId = await StripeService.getOrCreateCustomer(userId, email);
    const prices = PLAN_PRICES[plan];
    if (!prices) throw new Error(`Invalid plan: ${plan}`);
    const isAnnual = interval === 'annual' || interval === 'year';
    const priceId = isAnnual ? prices.annual : prices.monthly;
    if (!priceId) throw new Error(`Price not configured for ${plan} ${interval}`);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${returnUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}/checkout/cancel`,
      metadata: { userId, plan },
    });

    return session.url!;
  }

  static async createPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const stripe = StripeService.getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session.url;
  }

  static verifyWebhookSignature(payload: Buffer, signature: string): any {
    const stripe = StripeService.getStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    return stripe.webhooks.constructEvent(payload, signature, secret);
  }
}
