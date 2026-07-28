import { useEffect, useState, useCallback } from 'react';
import { AdminApiService } from '../../services/adminApi';
import ConfirmActionDialog from '../../components/admin/ConfirmActionDialog';

interface SubscriptionSummary {
  plan: string;
  status: string;
  seats: number;
  current_period_end: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id: string | null;
  is_manual_override: boolean;
  override_reason: string | null;
  override_at: string | null;
  override_by_email: string | null;
}

interface PaymentRow {
  id: string;
  amount_cents: number;
  currency: string;
  status: 'paid' | 'failed' | 'refunded' | 'pending';
  description: string;
  hosted_invoice_url: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

interface AccountBilling {
  subscription: SubscriptionSummary;
  payments: PaymentRow[];
  paymentsTotal: number;
}

const PLANS = ['free', 'solo', 'team', 'scale'];

const PAYMENT_BADGES: Record<string, string> = {
  paid: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  failed: 'bg-red-950 text-red-300 border-red-800',
  refunded: 'bg-amber-950 text-amber-300 border-amber-800',
  pending: 'bg-slate-800 text-slate-400 border-slate-700',
};

/** Amounts are stored in minor units to avoid floating-point rounding. */
function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/**
 * Billing tab of the account detail view: current plan, manual-override state,
 * payment history, and the plan override control.
 */
function AdminAccountBillingTab({ accountId }: { accountId: string }) {
  const [billing, setBilling] = useState<AccountBilling | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [targetPlan, setTargetPlan] = useState<string>('');

  const load = useCallback(async (): Promise<void> => {
    const response = await AdminApiService.get<AccountBilling>(`/accounts/${accountId}/billing`);

    if (response.success && response.data) {
      setBilling(response.data);
      setError('');
    } else {
      setError(response.error || 'Failed to load billing');
    }

    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOverride = async (reason: string): Promise<{ ok: boolean; error?: string }> => {
    const response = await AdminApiService.postElevated<{ warning: string | null }>(
      `/accounts/${accountId}/plan`,
      { plan: targetPlan, reason }
    );

    if (!response.success) {
      return { ok: false, error: response.error };
    }

    await load();
    return { ok: true };
  };

  if (loading) {
    return <p className="text-slate-500 text-sm">Loading billing…</p>;
  }

  if (error || !billing) {
    return (
      <div className="bg-red-950 border border-red-900 text-red-300 px-4 py-3 rounded-lg text-sm">
        {error || 'No billing data'}
      </div>
    );
  }

  const { subscription } = billing;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-slate-500">Current plan</p>
            <p className="text-lg font-medium capitalize mt-1">
              {subscription.plan}
              <span className="text-sm text-slate-500 ml-2 capitalize">
                ({subscription.status.replace('_', ' ')})
              </span>
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {subscription.seats} seat{subscription.seats === 1 ? '' : 's'}
              {subscription.current_period_end &&
                ` · renews ${new Date(subscription.current_period_end).toLocaleDateString()}`}
            </p>
          </div>

          {subscription.is_manual_override && (
            <div className="text-xs px-3 py-2 rounded-lg border border-indigo-800 bg-indigo-950 text-indigo-300 max-w-xs">
              <p className="font-medium">Manual override</p>
              {subscription.override_reason && (
                <p className="mt-1 text-indigo-400/80">{subscription.override_reason}</p>
              )}
              {subscription.override_by_email && (
                <p className="mt-1 text-indigo-400/60">
                  by {subscription.override_by_email}
                  {subscription.override_at &&
                    ` on ${new Date(subscription.override_at).toLocaleDateString()}`}
                </p>
              )}
            </div>
          )}
        </div>

        {subscription.is_manual_override && subscription.stripe_subscription_id && (
          <div className="mt-4 text-xs px-3 py-2 rounded-lg border border-amber-900 bg-amber-950 text-amber-300">
            This account also has a live Stripe subscription. A future Stripe webhook will overwrite
            this manual override.
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-slate-800">
          <p className="text-sm text-slate-300 mb-1">Change plan</p>
          <p className="text-xs text-slate-500 mb-3">
            Applies a comp override. The subscription, the user's plan and this month's usage limit
            all move together.
          </p>
          <div className="flex flex-wrap gap-2">
            {PLANS.filter((plan) => plan !== subscription.plan).map((plan) => (
              <button
                key={plan}
                onClick={() => setTargetPlan(plan)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors capitalize"
              >
                Set to {plan}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-medium text-slate-300">
            Payment history
            <span className="text-slate-500 font-normal ml-2">{billing.paymentsTotal} records</span>
          </h2>
        </div>

        {billing.payments.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No payments recorded. Free-plan accounts have none, and history predating the payments
            table lives only in Stripe until the backfill script is run.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/50 text-slate-400">
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Description</th>
                  <th className="text-right px-5 py-3 font-medium">Amount</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {billing.payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">{payment.description || '—'}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatAmount(payment.amount_cents, payment.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          PAYMENT_BADGES[payment.status] || PAYMENT_BADGES.pending
                        }`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {payment.hosted_invoice_url ? (
                        <a
                          href={payment.hosted_invoice_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:text-indigo-300"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {targetPlan && (
        <ConfirmActionDialog
          title={`Change plan to ${targetPlan}?`}
          description={`This account moves from ${subscription.plan} to ${targetPlan} as a manual override. No payment is taken and nothing is charged.`}
          confirmLabel={`Set to ${targetPlan}`}
          onCancel={() => setTargetPlan('')}
          onConfirm={handleOverride}
        />
      )}
    </div>
  );
}

export default AdminAccountBillingTab;
