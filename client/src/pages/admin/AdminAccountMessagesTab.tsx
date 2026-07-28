import { useEffect, useState, useCallback } from 'react';
import { AdminApiService } from '../../services/adminApi';

interface SendRow {
  id: string;
  template_key: string;
  channel: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  skip_reason: string | null;
  error: string | null;
  sent_at: string | null;
  created_at: string;
  sent_by_email: string | null;
}

const STATUS_BADGES: Record<string, string> = {
  sent: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  skipped: 'bg-slate-800 text-slate-400 border-slate-700',
  failed: 'bg-red-950 text-red-300 border-red-800',
  queued: 'bg-indigo-950 text-indigo-300 border-indigo-800',
};

/**
 * Messages tab: every send attempt against this account, including the ones
 * that were skipped or failed — "we never sent it" is the answer an operator
 * usually needs.
 */
function AdminAccountMessagesTab({ accountId }: { accountId: string }) {
  const [history, setHistory] = useState<{ items: SendRow[]; total: number } | null>(null);
  const [templates, setTemplates] = useState<{ key: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [notice, setNotice] = useState<string>('');

  const load = useCallback(async (): Promise<void> => {
    const [historyResponse, templateResponse] = await Promise.all([
      AdminApiService.get<{ items: SendRow[]; total: number }>(`/accounts/${accountId}/messages`),
      AdminApiService.get<{ templates: { key: string; name: string; is_active: boolean }[] }>(
        '/message-templates'
      ),
    ]);

    if (historyResponse.success && historyResponse.data) {
      setHistory(historyResponse.data);
      setError('');
    } else {
      setError(historyResponse.error || 'Failed to load message history');
    }

    if (templateResponse.success && templateResponse.data) {
      const active = templateResponse.data.templates.filter((t) => t.is_active);
      setTemplates(active);
      setSelected((current) => current || active[0]?.key || '');
    }

    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (): Promise<void> => {
    setSending(true);
    setNotice('');

    const response = await AdminApiService.postElevated<{ status: string; reason?: string }>(
      '/messages/send',
      { template_key: selected, user_id: accountId }
    );

    setSending(false);

    if (!response.success) {
      setNotice(response.error || 'Send failed');
      return;
    }

    setNotice(
      response.data?.status === 'sent'
        ? 'Message sent.'
        : `Not sent — ${response.data?.reason || response.data?.status}`
    );

    await load();
  };

  if (loading) {
    return <p className="text-slate-500 text-sm">Loading messages…</p>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-950 border border-red-900 text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-slate-300">Send a message</h2>
        <p className="text-xs text-slate-500 mt-1 mb-3">
          Opt-outs and the 24-hour frequency cap still apply — the result below says whether it
          actually went.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none"
          >
            {templates.map((template) => (
              <option key={template.key} value={template.key}>
                {template.name}
              </option>
            ))}
          </select>

          <button
            onClick={send}
            disabled={!selected || sending}
            className="px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>

          {notice && <span className="text-sm text-slate-400">{notice}</span>}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-medium text-slate-300">
            History
            <span className="text-slate-500 font-normal ml-2">{history?.total || 0} attempts</span>
          </h2>
        </div>

        {!history || history.items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No messages sent to this account.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/50 text-slate-400">
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Template</th>
                  <th className="text-left px-5 py-3 font-medium">Channel</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Detail</th>
                  <th className="text-left px-5 py-3 font-medium">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {history.items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <code className="text-xs text-indigo-300">{row.template_key}</code>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{row.channel}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          STATUS_BADGES[row.status] || STATUS_BADGES.queued
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 max-w-xs">
                      {row.skip_reason || row.error || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {row.sent_by_email || <span className="text-slate-600">automated</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminAccountMessagesTab;
