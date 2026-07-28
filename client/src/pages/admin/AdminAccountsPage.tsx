import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminApiService } from '../../services/adminApi';

interface AccountRow {
  id: string;
  name: string;
  email: string;
  role: string;
  access_status: string;
  plan: string;
  subscription_status: string;
  documents_sent: number;
  documents_limit: number;
  team_name: string | null;
  document_count: number;
  created_at: string;
  last_login: string | null;
}

interface AccountListResult {
  items: AccountRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const SEARCH_DEBOUNCE_MS = 300;

const ACCESS_BADGES: Record<string, string> = {
  active: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  suspended: 'bg-amber-950 text-amber-300 border-amber-800',
  revoked: 'bg-red-950 text-red-300 border-red-800',
};

/** Usage bar, showing consumption against the plan's monthly ceiling. */
function UsageBar({ sent, limit }: { sent: number; limit: number }) {
  if (!limit) {
    return <span className="text-slate-600 text-xs">—</span>;
  }

  const pct = Math.min(100, Math.round((sent / limit) * 100));
  const tone = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-500';

  return (
    <div className="w-28">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{sent}</span>
        <span>{limit}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Searchable, filterable list of every account on the platform.
 *
 * Filters live in the query string so a filtered view is linkable — the
 * dashboard tiles link straight into it.
 */
function AdminAccountsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [result, setResult] = useState<AccountListResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>(searchParams.get('search') || '');

  const plan = searchParams.get('plan') || '';
  const status = searchParams.get('status') || '';
  const accessStatus = searchParams.get('access_status') || '';
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput === search) {
        return;
      }
      const next = new URLSearchParams(searchParams);
      if (searchInput) {
        next.set('search', searchInput);
      } else {
        next.delete('search');
      }
      next.delete('page');
      setSearchParams(next, { replace: true });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput, search, searchParams, setSearchParams]);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const query = AdminApiService.toQuery({
      search,
      plan,
      status,
      access_status: accessStatus,
      page,
      limit: 25,
    });

    const response = await AdminApiService.get<AccountListResult>(`/accounts${query}`);

    if (response.success && response.data) {
      setResult(response.data);
      setError('');
    } else {
      setError(response.error || 'Failed to load accounts');
    }

    setLoading(false);
  }, [search, plan, status, accessStatus, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key: string, value: string): void => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete('page');
    setSearchParams(next);
  };

  const goToPage = (target: number): void => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(target));
    setSearchParams(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Accounts</h1>
        <p className="text-sm text-slate-500 mt-1">
          {result ? `${result.total.toLocaleString()} matching accounts` : 'Loading…'}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name or email…"
          className="flex-1 min-w-[220px] px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />

        <select
          value={plan}
          onChange={(e) => setFilter('plan', e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm outline-none"
        >
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="solo">Solo</option>
          <option value="team">Team</option>
          <option value="scale">Scale</option>
        </select>

        <select
          value={status}
          onChange={(e) => setFilter('status', e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm outline-none"
        >
          <option value="">Any subscription</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past due</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={accessStatus}
          onChange={(e) => setFilter('access_status', e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm outline-none"
        >
          <option value="">Any access</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-900 text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-800 text-slate-400">
                <th className="text-left px-4 py-3 font-medium">Account</th>
                <th className="text-left px-4 py-3 font-medium">Plan</th>
                <th className="text-left px-4 py-3 font-medium">Subscription</th>
                <th className="text-left px-4 py-3 font-medium">Usage</th>
                <th className="text-left px-4 py-3 font-medium">Team</th>
                <th className="text-left px-4 py-3 font-medium">Access</th>
                <th className="text-left px-4 py-3 font-medium">Last login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {result?.items.map((account) => (
                <tr key={account.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin-portal/accounts/${account.id}`}
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      {account.name || 'Unnamed'}
                    </Link>
                    <p className="text-xs text-slate-500">{account.email}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{account.plan}</td>
                  <td className="px-4 py-3 text-slate-400 capitalize">
                    {account.subscription_status.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <UsageBar sent={account.documents_sent} limit={account.documents_limit} />
                  </td>
                  <td className="px-4 py-3 text-slate-400">{account.team_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        ACCESS_BADGES[account.access_status] || ACCESS_BADGES.active
                      }`}
                    >
                      {account.access_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {account.last_login ? new Date(account.last_login).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && <div className="p-8 text-center text-slate-500 text-sm">Loading accounts…</div>}
        {!loading && result?.items.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">No accounts match these filters.</div>
        )}
      </div>

      {result && result.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {result.page} of {result.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(result.page - 1)}
              disabled={result.page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => goToPage(result.page + 1)}
              disabled={result.page >= result.totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminAccountsPage;
