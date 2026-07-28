import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminApiService } from '../../services/adminApi';

interface OverviewMetrics {
  totalAccounts: number;
  byAccessStatus: Record<string, number>;
  byPlan: Record<string, number>;
  bySubscriptionStatus: Record<string, number>;
  newAccountsThisMonth: number;
  documentsSentThisMonth: number;
}

const PLAN_ORDER = ['free', 'solo', 'team', 'scale'];

/** Tile linking through to the matching filtered account list. */
function Tile({ label, value, to, tone = 'default' }: {
  label: string;
  value: number;
  to?: string;
  tone?: 'default' | 'warn' | 'danger';
}) {
  const toneClass =
    tone === 'danger' ? 'text-red-400' : tone === 'warn' ? 'text-amber-400' : 'text-slate-100';

  const body = (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-full hover:border-slate-700 transition-colors">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold mt-2 ${toneClass}`}>{value.toLocaleString()}</p>
    </div>
  );

  return to ? <Link to={to}>{body}</Link> : body;
}

/**
 * Landing view for the admin portal.
 *
 * Backed by a single /metrics/overview call so the page does not fan out a
 * request per tile.
 */
function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const load = async (): Promise<void> => {
      const response = await AdminApiService.get<OverviewMetrics>('/metrics/overview');

      if (response.success && response.data) {
        setMetrics(response.data);
      } else {
        setError(response.error || 'Failed to load metrics');
      }

      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return <p className="text-slate-500 text-sm">Loading metrics…</p>;
  }

  if (error || !metrics) {
    return (
      <div className="bg-red-950 border border-red-900 text-red-300 px-4 py-3 rounded-lg text-sm">
        {error || 'No metrics available'}
      </div>
    );
  }

  const suspended = metrics.byAccessStatus.suspended || 0;
  const revoked = metrics.byAccessStatus.revoked || 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Platform overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          {metrics.totalAccounts.toLocaleString()} accounts ·{' '}
          {metrics.newAccountsThisMonth.toLocaleString()} new this month ·{' '}
          {metrics.documentsSentThisMonth.toLocaleString()} documents sent this month
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-slate-400 mb-3">Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Tile
            label="Active"
            value={metrics.byAccessStatus.active || 0}
            to="/admin-portal/accounts?access_status=active"
          />
          <Tile
            label="Suspended"
            value={suspended}
            tone={suspended > 0 ? 'warn' : 'default'}
            to="/admin-portal/accounts?access_status=suspended"
          />
          <Tile
            label="Revoked"
            value={revoked}
            tone={revoked > 0 ? 'danger' : 'default'}
            to="/admin-portal/accounts?access_status=revoked"
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-slate-400 mb-3">Plans</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {PLAN_ORDER.map((plan) => (
            <Tile
              key={plan}
              label={plan.charAt(0).toUpperCase() + plan.slice(1)}
              value={metrics.byPlan[plan] || 0}
              to={`/admin-portal/accounts?plan=${plan}`}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-slate-400 mb-3">Subscription status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(metrics.bySubscriptionStatus).map(([status, count]) => (
            <Tile
              key={status}
              label={status.replace('_', ' ')}
              value={count}
              tone={status === 'past_due' ? 'danger' : 'default'}
              to={`/admin-portal/accounts?status=${status}`}
            />
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-600">
        Payment failures, trial expiries and credit grants appear here once the billing and credit
        features land.
      </p>
    </div>
  );
}

export default AdminDashboardPage;
