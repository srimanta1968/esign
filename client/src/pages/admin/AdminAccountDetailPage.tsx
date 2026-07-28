import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminApiService } from '../../services/adminApi';
import ConfirmActionDialog from '../../components/admin/ConfirmActionDialog';
import AdminAccountBillingTab from './AdminAccountBillingTab';
import AdminAccountCreditsTab from './AdminAccountCreditsTab';
import AdminAccountMessagesTab from './AdminAccountMessagesTab';

interface AccountDetail {
  account: {
    id: string;
    name: string;
    email: string;
    role: string;
    access_status: string;
    access_reason: string | null;
    access_changed_at: string | null;
    access_changed_by_email: string | null;
    email_verified: boolean;
    plan: string;
    subscription_status: string;
    trial_ends_at: string | null;
    credit_balance: number;
    documents_sent: number;
    documents_limit: number;
    team_name: string | null;
    document_count: number;
    created_at: string;
    last_login: string | null;
  };
  usageHistory: { month_year: string; documents_sent: number; documents_limit: number }[];
  workflowCount: number;
}

type AccessAction = 'suspend' | 'revoke' | 'restore';

const ACTION_COPY: Record<AccessAction, { title: string; description: string; label: string; destructive: boolean }> = {
  suspend: {
    title: 'Suspend this account?',
    description:
      'The user will be signed out immediately and cannot sign in again until access is restored. Their data is untouched.',
    label: 'Suspend account',
    destructive: true,
  },
  revoke: {
    title: 'Revoke this account?',
    description:
      'The user will be signed out immediately and permanently blocked from signing in. Their data is untouched, and access can still be restored later.',
    label: 'Revoke account',
    destructive: true,
  },
  restore: {
    title: 'Restore access?',
    description: 'The user will be able to sign in again immediately.',
    label: 'Restore access',
    destructive: false,
  },
};

const TABS = ['Overview', 'Billing', 'Credits & Trial', 'Messages'] as const;
type Tab = (typeof TABS)[number];

/**
 * Full detail for one account, and the place access is suspended, revoked or
 * restored.
 */
function AdminAccountDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [tab, setTab] = useState<Tab>('Overview');
  const [pendingAction, setPendingAction] = useState<AccessAction | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!id) {
      return;
    }

    const response = await AdminApiService.get<AccountDetail>(`/accounts/${id}`);

    if (response.success && response.data) {
      setDetail(response.data);
      setError('');
    } else {
      setError(response.error || 'Failed to load account');
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccessChange = async (
    action: AccessAction,
    reason: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const response = await AdminApiService.postElevated(`/accounts/${id}/access`, { action, reason });

    if (!response.success) {
      return { ok: false, error: response.error };
    }

    await load();
    return { ok: true };
  };

  if (loading) {
    return <p className="text-slate-500 text-sm">Loading account…</p>;
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <div className="bg-red-950 border border-red-900 text-red-300 px-4 py-3 rounded-lg text-sm">
          {error || 'Account not found'}
        </div>
        <Link to="/admin-portal/accounts" className="text-indigo-400 text-sm hover:text-indigo-300">
          ← Back to accounts
        </Link>
      </div>
    );
  }

  const { account } = detail;
  const isActive = account.access_status === 'active';

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin-portal/accounts" className="text-indigo-400 text-sm hover:text-indigo-300">
          ← Accounts
        </Link>
        <h1 className="text-xl font-semibold mt-2">{account.name || 'Unnamed account'}</h1>
        <p className="text-sm text-slate-500">{account.email}</p>
      </div>

      {!isActive && (
        <div className="bg-amber-950 border border-amber-900 text-amber-200 px-4 py-3 rounded-lg text-sm">
          <p className="font-medium capitalize">Access {account.access_status}</p>
          {account.access_reason && <p className="mt-1 text-amber-300/80">{account.access_reason}</p>}
          {account.access_changed_by_email && (
            <p className="mt-1 text-xs text-amber-400/70">
              by {account.access_changed_by_email}
              {account.access_changed_at &&
                ` on ${new Date(account.access_changed_at).toLocaleString()}`}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-800">
        {TABS.map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === name
                ? 'border-indigo-500 text-slate-100'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Plan', value: account.plan },
              { label: 'Subscription', value: account.subscription_status.replace('_', ' ') },
              { label: 'Documents', value: String(account.document_count) },
              { label: 'Workflows', value: String(detail.workflowCount) },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className="text-lg font-medium mt-1 capitalize">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-slate-300 mb-4">Usage history</h2>
            {detail.usageHistory.length === 0 ? (
              <p className="text-sm text-slate-600">No recorded usage.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-800">
                  {detail.usageHistory.map((row) => (
                    <tr key={row.month_year}>
                      <td className="py-2 text-slate-400">{row.month_year}</td>
                      <td className="py-2 text-right">
                        {row.documents_sent} / {row.documents_limit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-slate-300">Account access</h2>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Suspending or revoking signs the user out immediately. Every change requires a reason
              and is recorded in the audit log.
            </p>
            <div className="flex flex-wrap gap-2">
              {isActive ? (
                <>
                  <button
                    onClick={() => setPendingAction('suspend')}
                    className="px-3 py-2 text-sm rounded-lg border border-amber-800 text-amber-300 hover:bg-amber-950 transition-colors"
                  >
                    Suspend
                  </button>
                  <button
                    onClick={() => setPendingAction('revoke')}
                    className="px-3 py-2 text-sm rounded-lg border border-red-800 text-red-300 hover:bg-red-950 transition-colors"
                  >
                    Revoke
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setPendingAction('restore')}
                  className="px-3 py-2 text-sm rounded-lg border border-emerald-800 text-emerald-300 hover:bg-emerald-950 transition-colors"
                >
                  Restore access
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'Billing' && id && <AdminAccountBillingTab accountId={id} />}
      {tab === 'Credits & Trial' && id && (
        <AdminAccountCreditsTab
          accountId={id}
          trial={{
            status: account.subscription_status,
            plan: account.plan,
            trial_ends_at: account.trial_ends_at,
          }}
        />
      )}
      {tab === 'Messages' && id && <AdminAccountMessagesTab accountId={id} />}

      {pendingAction && (
        <ConfirmActionDialog
          title={ACTION_COPY[pendingAction].title}
          description={ACTION_COPY[pendingAction].description}
          confirmLabel={ACTION_COPY[pendingAction].label}
          destructive={ACTION_COPY[pendingAction].destructive}
          onCancel={() => setPendingAction(null)}
          onConfirm={(reason) => handleAccessChange(pendingAction, reason)}
        />
      )}
    </div>
  );
}

export default AdminAccountDetailPage;
