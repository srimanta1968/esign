import { useEffect, useState } from 'react';
import { AdminApiService } from '../../services/adminApi';
import ConfirmActionDialog from '../../components/admin/ConfirmActionDialog';

interface Template {
  key: string;
  name: string;
  is_active: boolean;
}

interface SendOutcome {
  userId: string;
  email: string;
  status: 'sent' | 'skipped' | 'failed';
  reason?: string;
}

interface SegmentResult {
  outcomes: SendOutcome[];
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Compose a send to a filtered segment.
 *
 * The recipient count is resolved by a dry run against the same query the real
 * send uses, so the number shown is the number that will actually be attempted.
 */
function AdminSendMessagePage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateKey, setTemplateKey] = useState<string>('');
  const [plan, setPlan] = useState<string>('');
  const [registeredDays, setRegisteredDays] = useState<string>('');
  const [documentsAtMost, setDocumentsAtMost] = useState<string>('');
  const [neverLoggedIn, setNeverLoggedIn] = useState<boolean>(false);

  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [result, setResult] = useState<SegmentResult | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const load = async (): Promise<void> => {
      const response = await AdminApiService.get<{ templates: Template[] }>('/message-templates');

      if (response.success && response.data) {
        const active = response.data.templates.filter((t) => t.is_active);
        setTemplates(active);
        setTemplateKey(active[0]?.key || '');
      }
    };

    load();
  }, []);

  const buildFilters = (): Record<string, unknown> => {
    const filters: Record<string, unknown> = {};
    if (plan) filters.plan = plan;
    if (registeredDays) filters.registeredMoreThanDays = Number(registeredDays);
    if (documentsAtMost) filters.documentsSentAtMost = Number(documentsAtMost);
    if (neverLoggedIn) filters.neverLoggedIn = true;
    return filters;
  };

  const countRecipients = async (): Promise<void> => {
    setCounting(true);
    setError('');
    setResult(null);

    const response = await AdminApiService.postElevated<{ recipientCount: number }>(
      '/messages/send-segment',
      { template_key: templateKey, filters: buildFilters(), dry_run: true }
    );

    setCounting(false);

    if (response.success && response.data) {
      setCount(response.data.recipientCount);
    } else {
      setError(response.error || 'Failed to count recipients');
    }
  };

  const send = async (): Promise<{ ok: boolean; error?: string }> => {
    const response = await AdminApiService.postElevated<SegmentResult>('/messages/send-segment', {
      template_key: templateKey,
      filters: buildFilters(),
      confirm_large: true,
    });

    if (!response.success || !response.data) {
      return { ok: false, error: response.error };
    }

    setResult(response.data);
    setCount(null);
    return { ok: true };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Send a message</h1>
        <p className="text-sm text-slate-500 mt-1">
          Pick a template and build a segment. Nothing is sent until you confirm the recipient count.
        </p>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-900 text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <label htmlFor="send-template" className="block text-xs text-slate-500 mb-1.5">
            Template
          </label>
          <select
            id="send-template"
            value={templateKey}
            onChange={(e) => {
              setTemplateKey(e.target.value);
              setCount(null);
            }}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none"
          >
            {templates.map((template) => (
              <option key={template.key} value={template.key}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-2 border-t border-slate-800">
          <p className="text-sm text-slate-300 mb-3">Segment</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="seg-plan" className="block text-xs text-slate-500 mb-1.5">
                Plan
              </label>
              <select
                id="seg-plan"
                value={plan}
                onChange={(e) => { setPlan(e.target.value); setCount(null); }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none"
              >
                <option value="">Any</option>
                <option value="free">Free</option>
                <option value="solo">Solo</option>
                <option value="team">Team</option>
                <option value="scale">Scale</option>
              </select>
            </div>

            <div>
              <label htmlFor="seg-days" className="block text-xs text-slate-500 mb-1.5">
                Registered over N days ago
              </label>
              <input
                id="seg-days"
                type="number"
                min={0}
                value={registeredDays}
                onChange={(e) => { setRegisteredDays(e.target.value); setCount(null); }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none"
              />
            </div>

            <div>
              <label htmlFor="seg-docs" className="block text-xs text-slate-500 mb-1.5">
                Documents sent at most
              </label>
              <input
                id="seg-docs"
                type="number"
                min={0}
                value={documentsAtMost}
                onChange={(e) => { setDocumentsAtMost(e.target.value); setCount(null); }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none"
              />
            </div>

            <label className="flex items-end gap-2 text-sm text-slate-400 pb-2">
              <input
                type="checkbox"
                checked={neverLoggedIn}
                onChange={(e) => { setNeverLoggedIn(e.target.checked); setCount(null); }}
              />
              Never logged in
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={countRecipients}
            disabled={!templateKey || counting}
            className="px-3 py-2 text-sm rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            {counting ? 'Counting…' : 'Count recipients'}
          </button>

          {count !== null && (
            <>
              <span className="text-sm text-slate-300">
                {count.toLocaleString()} account{count === 1 ? '' : 's'} match
              </span>
              <button
                onClick={() => setConfirming(true)}
                disabled={count === 0}
                className="px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors"
              >
                Send to {count}
              </button>
            </>
          )}
        </div>

        <p className="text-xs text-slate-600">
          Opted-out accounts and anyone messaged in the last 24 hours are skipped automatically and
          reported below.
        </p>
      </div>

      {result && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex gap-4 text-sm">
            <span className="text-emerald-400">{result.sent} sent</span>
            <span className="text-slate-400">{result.skipped} skipped</span>
            <span className={result.failed > 0 ? 'text-red-400' : 'text-slate-500'}>
              {result.failed} failed
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800">
                {result.outcomes.map((outcome) => (
                  <tr key={outcome.userId}>
                    <td className="px-5 py-2 text-slate-400">{outcome.email || outcome.userId}</td>
                    <td className="px-5 py-2">
                      <span
                        className={
                          outcome.status === 'sent'
                            ? 'text-emerald-400'
                            : outcome.status === 'failed'
                              ? 'text-red-400'
                              : 'text-slate-500'
                        }
                      >
                        {outcome.status}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-slate-600 text-xs">{outcome.reason || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmActionDialog
          title={`Send to ${count} account${count === 1 ? '' : 's'}?`}
          description={`Template "${templates.find((t) => t.key === templateKey)?.name || templateKey}" will be sent to ${count} matching account(s). Opt-outs and recently-messaged accounts are skipped.`}
          confirmLabel={`Send to ${count}`}
          onCancel={() => setConfirming(false)}
          onConfirm={send}
        />
      )}
    </div>
  );
}

export default AdminSendMessagePage;
