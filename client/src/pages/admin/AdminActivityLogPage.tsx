import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AdminApiService } from '../../services/adminApi';

interface AdminActionRow {
  id: string;
  action: string;
  created_at: string;
  ip_address: string;
  metadata: {
    reason?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  };
  admin_email: string | null;
  target_user_id: string | null;
  target_email: string | null;
}

interface ActivityResult {
  items: AdminActionRow[];
  total: number;
  page: number;
  totalPages: number;
}

/** Render a before/after pair as "was → now", skipping absent values. */
function Transition({ before, after }: { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }) {
  if (!before && !after) {
    return <span className="text-slate-600">—</span>;
  }

  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));

  return (
    <div className="space-y-0.5">
      {keys.map((key) => (
        <div key={key} className="text-xs">
          <span className="text-slate-500">{key}: </span>
          <span className="text-slate-400">{String(before?.[key] ?? '—')}</span>
          <span className="text-slate-600"> → </span>
          <span className="text-slate-200">{String(after?.[key] ?? '—')}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Oversight view for the admin portal itself.
 *
 * Shows only privileged admin actions, not general user activity — that stays
 * on the tenant-facing audit log page.
 */
function AdminActivityLogPage() {
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const query = AdminApiService.toQuery({ action: actionFilter, page, limit: 50 });
    const response = await AdminApiService.get<ActivityResult>(`/activity${query}`);

    if (response.success && response.data) {
      setResult(response.data);
      setError('');
    } else {
      setError(response.error || 'Failed to load activity');
    }

    setLoading(false);
  }, [actionFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin activity</h1>
        <p className="text-sm text-slate-500 mt-1">
          Privileged actions taken from this portal.
          {result ? ` ${result.total.toLocaleString()} recorded.` : ''}
        </p>
      </div>

      <select
        value={actionFilter}
        onChange={(e) => {
          setActionFilter(e.target.value);
          setPage(1);
        }}
        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm outline-none"
      >
        <option value="">All actions</option>
        <option value="account">Account access</option>
        <option value="plan">Plan overrides</option>
        <option value="credit">Credits</option>
        <option value="trial">Trials</option>
        <option value="message">Messages</option>
      </select>

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
                <th className="text-left px-4 py-3 font-medium">When</th>
                <th className="text-left px-4 py-3 font-medium">Admin</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-left px-4 py-3 font-medium">Target</th>
                <th className="text-left px-4 py-3 font-medium">Change</th>
                <th className="text-left px-4 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {result?.items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/40 transition-colors align-top">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{row.admin_email || '—'}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs text-indigo-300">{row.action}</code>
                  </td>
                  <td className="px-4 py-3">
                    {row.target_user_id ? (
                      <Link
                        to={`/admin-portal/accounts/${row.target_user_id}`}
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        {row.target_email || row.target_user_id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Transition before={row.metadata?.before} after={row.metadata?.after} />
                  </td>
                  <td className="px-4 py-3 text-slate-400 max-w-xs">
                    {row.metadata?.reason || <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && <div className="p-8 text-center text-slate-500 text-sm">Loading activity…</div>}
        {!loading && result?.items.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">No admin actions recorded yet.</div>
        )}
      </div>

      {result && result.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {result.page} of {result.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={result.page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
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

export default AdminActivityLogPage;
