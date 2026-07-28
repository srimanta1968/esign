import { useEffect, useState, useCallback } from 'react';
import { AdminApiService } from '../../services/adminApi';
import ConfirmActionDialog from '../../components/admin/ConfirmActionDialog';

interface LedgerRow {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  source: 'admin_grant' | 'admin_revoke' | 'consumption' | 'expiry';
  expires_at: string | null;
  granted_by_email: string | null;
  created_at: string;
}

interface CreditsResponse {
  balance: number;
  ledger: { items: LedgerRow[]; total: number };
}

interface TrialState {
  status: string;
  plan: string;
  trial_ends_at: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  admin_grant: 'Granted',
  admin_revoke: 'Revoked',
  consumption: 'Used',
  expiry: 'Expired',
};

const TRIALABLE_PLANS = ['solo', 'team', 'scale'];

/** Whole days remaining until a date, floored at zero. */
function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Credits & Trial tab: balance, grant/revoke controls, the append-only ledger,
 * and trial management.
 */
function AdminAccountCreditsTab({ accountId, trial }: { accountId: string; trial: TrialState }) {
  const [credits, setCredits] = useState<CreditsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [grantAmount, setGrantAmount] = useState<string>('25');
  const [grantExpiry, setGrantExpiry] = useState<string>('');
  const [pending, setPending] = useState<'grant' | 'revoke' | 'trial' | 'cancel-trial' | null>(null);
  const [trialPlan, setTrialPlan] = useState<string>('team');
  const [trialDays, setTrialDays] = useState<string>('14');

  const load = useCallback(async (): Promise<void> => {
    const response = await AdminApiService.get<CreditsResponse>(`/accounts/${accountId}/credits`);

    if (response.success && response.data) {
      setCredits(response.data);
      setError('');
    } else {
      setError(response.error || 'Failed to load credits');
    }

    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitCredits = async (
    action: 'grant' | 'revoke',
    reason: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const response = await AdminApiService.postElevated(`/accounts/${accountId}/credits`, {
      action,
      amount: action === 'revoke' ? 'all' : Number(grantAmount),
      reason,
      ...(action === 'grant' && grantExpiry ? { expires_at: grantExpiry } : {}),
    });

    if (!response.success) {
      return { ok: false, error: response.error };
    }

    await load();
    return { ok: true };
  };

  const submitTrial = async (reason: string): Promise<{ ok: boolean; error?: string }> => {
    const response = await AdminApiService.postElevated(`/accounts/${accountId}/trial`, {
      plan: trialPlan,
      duration_days: Number(trialDays),
      reason,
    });

    if (!response.success) {
      return { ok: false, error: response.error };
    }

    window.location.reload();
    return { ok: true };
  };

  const cancelTrial = async (): Promise<{ ok: boolean; error?: string }> => {
    const response = await AdminApiService.request(`/accounts/${accountId}/trial`, {
      method: 'DELETE',
      elevated: true,
    });

    if (!response.success) {
      return { ok: false, error: response.error };
    }

    window.location.reload();
    return { ok: true };
  };

  if (loading) {
    return <p className="text-slate-500 text-sm">Loading credits…</p>;
  }

  if (error || !credits) {
    return (
      <div className="bg-red-950 border border-red-900 text-red-300 px-4 py-3 rounded-lg text-sm">
        {error || 'No credit data'}
      </div>
    );
  }

  const onTrial = trial.status === 'trialing';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500">Credit balance</p>
          <p className="text-2xl font-semibold mt-1 tabular-nums">{credits.balance}</p>
          <p className="text-xs text-slate-600 mt-2">
            Spent only after the monthly plan quota is exhausted.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500">Trial</p>
          {onTrial && trial.trial_ends_at ? (
            <>
              <p className="text-2xl font-semibold mt-1 capitalize">{trial.plan}</p>
              <p className="text-xs text-amber-400 mt-2">
                {daysUntil(trial.trial_ends_at)} day(s) remaining · ends{' '}
                {new Date(trial.trial_ends_at).toLocaleDateString()}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-semibold mt-1 text-slate-600">None</p>
              <p className="text-xs text-slate-600 mt-2">No trial running on this account.</p>
            </>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-slate-300">Grant credits</h2>
          <p className="text-xs text-slate-500 mt-1">
            Extra document sends on top of the plan quota. Optionally set an expiry — unused credits
            are clawed back automatically once it passes.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="credit-amount" className="block text-xs text-slate-500 mb-1.5">
              Amount
            </label>
            <input
              id="credit-amount"
              type="number"
              min={1}
              value={grantAmount}
              onChange={(e) => setGrantAmount(e.target.value)}
              className="w-28 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="credit-expiry" className="block text-xs text-slate-500 mb-1.5">
              Expires (optional)
            </label>
            <input
              id="credit-expiry"
              type="date"
              value={grantExpiry}
              onChange={(e) => setGrantExpiry(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={() => setPending('grant')}
            disabled={!grantAmount || Number(grantAmount) < 1}
            className="px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Grant credits
          </button>

          {credits.balance > 0 && (
            <button
              onClick={() => setPending('revoke')}
              className="px-3 py-2 text-sm rounded-lg border border-red-800 text-red-300 hover:bg-red-950 transition-colors"
            >
              Revoke all ({credits.balance})
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-slate-300">Trial</h2>
          <p className="text-xs text-slate-500 mt-1">
            Applies the plan's limits immediately and reverts to Free automatically on expiry.
          </p>
        </div>

        {onTrial ? (
          <button
            onClick={() => setPending('cancel-trial')}
            className="px-3 py-2 text-sm rounded-lg border border-amber-800 text-amber-300 hover:bg-amber-950 transition-colors"
          >
            End trial now
          </button>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="trial-plan" className="block text-xs text-slate-500 mb-1.5">
                Plan
              </label>
              <select
                id="trial-plan"
                value={trialPlan}
                onChange={(e) => setTrialPlan(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none capitalize"
              >
                {TRIALABLE_PLANS.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="trial-days" className="block text-xs text-slate-500 mb-1.5">
                Days
              </label>
              <input
                id="trial-days"
                type="number"
                min={1}
                max={180}
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                className="w-24 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={() => setPending('trial')}
              className="px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              Start trial
            </button>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-medium text-slate-300">
            Credit ledger
            <span className="text-slate-500 font-normal ml-2">{credits.ledger.total} entries</span>
          </h2>
        </div>

        {credits.ledger.items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No credit activity on this account.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/50 text-slate-400">
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-right px-5 py-3 font-medium">Change</th>
                  <th className="text-right px-5 py-3 font-medium">Balance</th>
                  <th className="text-left px-5 py-3 font-medium">Reason</th>
                  <th className="text-left px-5 py-3 font-medium">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {credits.ledger.items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-slate-400">{SOURCE_LABELS[row.source]}</td>
                    <td
                      className={`px-5 py-3 text-right tabular-nums ${
                        row.delta > 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {row.delta > 0 ? '+' : ''}
                      {row.delta}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-300">
                      {row.balance_after}
                    </td>
                    <td className="px-5 py-3 text-slate-400 max-w-xs">{row.reason}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {row.granted_by_email || <span className="text-slate-600">system</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pending === 'grant' && (
        <ConfirmActionDialog
          title={`Grant ${grantAmount} credits?`}
          description={`This account can send ${grantAmount} extra document(s) once its monthly plan quota is used up${grantExpiry ? `, expiring ${grantExpiry}` : ''}.`}
          confirmLabel="Grant credits"
          onCancel={() => setPending(null)}
          onConfirm={(reason) => submitCredits('grant', reason)}
        />
      )}

      {pending === 'revoke' && (
        <ConfirmActionDialog
          title="Revoke all remaining credits?"
          description={`Removes the ${credits.balance} unused credit(s) from this account. Credits already spent are unaffected.`}
          confirmLabel="Revoke credits"
          destructive
          onCancel={() => setPending(null)}
          onConfirm={(reason) => submitCredits('revoke', reason)}
        />
      )}

      {pending === 'trial' && (
        <ConfirmActionDialog
          title={`Start a ${trialDays}-day ${trialPlan} trial?`}
          description={`This account gets ${trialPlan} limits immediately and returns to Free automatically after ${trialDays} days. No payment is taken.`}
          confirmLabel="Start trial"
          onCancel={() => setPending(null)}
          onConfirm={submitTrial}
        />
      )}

      {pending === 'cancel-trial' && (
        <ConfirmActionDialog
          title="End this trial now?"
          description="The account returns to the Free plan immediately, before the trial was due to end."
          confirmLabel="End trial"
          destructive
          onCancel={() => setPending(null)}
          onConfirm={cancelTrial}
        />
      )}
    </div>
  );
}

export default AdminAccountCreditsTab;
