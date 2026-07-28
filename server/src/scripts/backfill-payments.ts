/**
 * Backfill historical Stripe invoices into the local `payments` table.
 *
 * Payment history that predates the payments table exists only in Stripe, so
 * the admin portal would show an empty list for long-standing customers until
 * their next invoice. This walks every account with a stripe_customer_id and
 * mirrors its invoices.
 *
 * Idempotent: upserts key on the UNIQUE stripe_invoice_id, so re-running is
 * safe and produces no duplicates.
 *
 * Usage (from server/):
 *   npx ts-node src/scripts/backfill-payments.ts [--dry-run] [--since=2026-01-01]
 */

import Stripe from 'stripe';
import { DataService } from '../services/DataService';
import { AdminBillingService, PaymentStatus } from '../services/adminBillingService';

/** Stripe's maximum page size for list endpoints. */
const STRIPE_PAGE_SIZE = 100;

/** Pause between pages so a large backfill stays within Stripe's rate limits. */
const PAGE_DELAY_MS = 250;

interface BackfillOptions {
  dryRun: boolean;
  since: number | null;
}

function parseArgs(argv: string[]): BackfillOptions {
  const dryRun = argv.includes('--dry-run');
  const sinceArg = argv.find((arg) => arg.startsWith('--since='));

  let since: number | null = null;
  if (sinceArg) {
    const value = sinceArg.split('=')[1];
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      throw new Error(`--since must be a parseable date, got "${value}"`);
    }
    since = Math.floor(parsed / 1000);
  }

  return { dryRun, since };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The invoice fields this script consumes.
 *
 * Declared locally rather than via the Stripe namespace, which this version of
 * the SDK's typings does not re-export.
 */
interface StripeInvoiceLike {
  id?: string;
  status?: string | null;
  attempt_count?: number;
  amount_paid?: number;
  amount_due?: number;
  currency?: string;
  description?: string | null;
  charge?: string | { id: string } | null;
  invoice_pdf?: string | null;
  hosted_invoice_url?: string | null;
  period_start?: number | null;
  period_end?: number | null;
  status_transitions?: { paid_at?: number | null };
  lines?: { data?: { description?: string | null }[] };
}

interface StripeInvoicePage {
  data: StripeInvoiceLike[];
  has_more: boolean;
}

/** Map a Stripe invoice status onto our payment status set. */
function toPaymentStatus(invoice: StripeInvoiceLike): PaymentStatus {
  if (invoice.status === 'paid') {
    return 'paid';
  }
  if (invoice.status === 'uncollectible' || ((invoice.attempt_count ?? 0) > 0 && invoice.status === 'open')) {
    return 'failed';
  }
  return 'pending';
}

async function backfill(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set — cannot reach Stripe');
  }

  const stripe = new Stripe(secretKey);

  const customers = await DataService.queryAll<{ user_id: string; stripe_customer_id: string }>(
    `SELECT user_id, stripe_customer_id FROM subscriptions
     WHERE stripe_customer_id IS NOT NULL AND stripe_customer_id != ''`
  );

  console.log(
    `Backfilling invoices for ${customers.length} Stripe customer(s)` +
      `${options.since ? ` since ${new Date(options.since * 1000).toISOString()}` : ''}` +
      `${options.dryRun ? ' [DRY RUN — nothing will be written]' : ''}`
  );

  let mirrored = 0;
  let skipped = 0;

  for (const customer of customers) {
    let startingAfter: string | undefined;

    for (;;) {
      const page = (await stripe.invoices.list({
        customer: customer.stripe_customer_id,
        limit: STRIPE_PAGE_SIZE,
        starting_after: startingAfter,
        ...(options.since ? { created: { gte: options.since } } : {}),
      })) as unknown as StripeInvoicePage;

      for (const invoice of page.data) {
        if (!invoice.id) {
          skipped++;
          continue;
        }

        if (options.dryRun) {
          console.log(
            `  would mirror ${invoice.id} (${invoice.status}, ` +
              `${(invoice.amount_paid ?? 0) / 100} ${invoice.currency}) for ${customer.user_id}`
          );
          mirrored++;
          continue;
        }

        await AdminBillingService.upsertPayment({
          userId: customer.user_id,
          stripeInvoiceId: invoice.id,
          stripeChargeId: typeof invoice.charge === 'string' ? invoice.charge : null,
          amountCents: invoice.amount_paid ?? invoice.amount_due ?? 0,
          currency: invoice.currency || 'usd',
          status: toPaymentStatus(invoice),
          description: invoice.description || invoice.lines?.data?.[0]?.description || 'Subscription',
          invoicePdfUrl: invoice.invoice_pdf || null,
          hostedInvoiceUrl: invoice.hosted_invoice_url || null,
          periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
          periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
          paidAt: invoice.status_transitions?.paid_at
            ? new Date(invoice.status_transitions.paid_at * 1000)
            : null,
        });

        mirrored++;
      }

      if (!page.has_more || page.data.length === 0) {
        break;
      }

      startingAfter = page.data[page.data.length - 1].id;
      await delay(PAGE_DELAY_MS);
    }
  }

  console.log(`Done. ${mirrored} invoice(s) ${options.dryRun ? 'would be ' : ''}mirrored, ${skipped} skipped.`);
}

backfill()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Backfill failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
