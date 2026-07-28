import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminApiService } from '../../services/adminApi';

interface RevenueMetrics {
  paidLast30Days: number;
  failedLast30Days: number;
  refundedLast30Days: number;
  accountsPastDue: number;
  manualOverrides: number;
}

interface OverviewMetrics {
  bySubscriptionStatus: Record<string, number>;
  byPlan: Record<string, number>;
}

/** Amounts arrive in minor units (cents) to avoid floating-point rounding. */
function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function Stat({ label, value, hint, tone = 'default' }: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'danger';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-400'
      : tone === 'danger'
        ? 'text-red-400'
        : tone === 'warn'
          ? 'text-amber-400'
          : 'text-slate-100';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold mt-2 tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

/**
 * Revenue and billing-health view for the admin portal.
 *
 * Deliberately reports collected amounts over a trailing window rather than a
 * modelled MRR: MRR from a mixed monthly/annual price book needs assumptions
 * this data cannot support, and a wrong revenue number is worse than none.
 */
function AdminRevenueDashboardPage() {
  const [revenue, setRevenue] = useState<RevenueMetrics | null>(null);
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const load = async (): Promise<void> => {
      const [revenueResponse, overviewResponse] = await Promise.all([
        AdminApiService.get<RevenueMetrics>('/metrics/revenue'),
        AdminApiService.get<OverviewMetrics>('/metrics/overview'),
      ]);

      if (revenueResponse.success && revenueResponse.data) {
        setRevenue(revenueResponse.data);
      } else {
        setError(revenueResponse.error || 'Failed to load revenue metrics');
      }

      if (overviewResponse.success && overviewResponse.data) {
        setOverview(overviewResponse.data);
      }

      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return <p className="text-slate-500 text-sm">Loading revenue…</p>;
  }

  if (error || !revenue) {
    return (
      <div className="bg-red-950 border border-red-900 text-red-300 px-4 py-3 rounded-lg text-sm">
        {error || 'No revenue data'}
      </div>
    );
  }

  const pastDue = revenue.accountsPastDue;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Revenue</h1>
        <p className="text-sm text-slate-500 mt-1">Collected over the last 30 days.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Collected" value={formatCents(revenue.paidLast30Days)} tone="good" hint="Paid invoices" />
        <Stat
          label="Failed"
          value={formatCents(revenue.failedLast30Days)}
          tone={revenue.failedLast30Days > 0 ? 'danger' : 'default'}
          hint="Invoices that did not clear"
        />
        <Stat
          label="Refunded"
          value={formatCents(revenue.refundedLast30Days)}
          tone={revenue.refundedLast30Days > 0 ? 'warn' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/admin-portal/accounts?status=past_due">
          <Stat
            label="Accounts past due"
            value={String(pastDue)}
            tone={pastDue > 0 ? 'danger' : 'default'}
            hint={pastDue > 0 ? 'Needs attention — click to view' : 'None outstanding'}
          />
        </Link>
        <Stat
          label="Manual plan overrides"
          value={String(revenue.manualOverrides)}
          hint="Comped accounts with no Stripe subscription behind them"
        />
      </div>

      {overview && (
        <section>
          <h2 className="text-sm font-medium text-slate-400 mb-3">Subscriptions by status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(overview.bySubscriptionStatus).map(([status, count]) => (
              <Link key={status} to={`/admin-portal/accounts?status=${status}`}>
                <Stat
                  label={status.replace('_', ' ')}
                  value={String(count)}
                  tone={status === 'past_due' ? 'danger' : 'default'}
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-slate-600">
        Figures come from the local payment mirror. Invoices predating that table live only in
        Stripe until <code className="text-slate-500">backfill-payments</code> is run.
      </p>
    </div>
  );
}

export default AdminRevenueDashboardPage;
