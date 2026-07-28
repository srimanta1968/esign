import { useEffect, useState, useCallback } from 'react';
import { AdminApiService } from '../../services/adminApi';

interface Template {
  id: string;
  key: string;
  name: string;
  channel: 'email' | 'in_app';
  subject: string;
  body: string;
  is_active: boolean;
}

const EMPTY_TEMPLATE: Template = {
  id: '',
  key: '',
  name: '',
  channel: 'email',
  subject: '',
  body: '',
  is_active: true,
};

/**
 * Template management for welcome and follow-up messages.
 *
 * Preview renders through the API's own renderer, so what an author sees is
 * produced by exactly the code that will send it.
 */
function AdminMessageTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  const [draft, setDraft] = useState<Template | null>(null);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  const load = useCallback(async (): Promise<void> => {
    const response = await AdminApiService.get<{ templates: Template[]; variables: string[] }>(
      '/message-templates'
    );

    if (response.success && response.data) {
      setTemplates(response.data.templates);
      setVariables(response.data.variables);
      setError('');
    } else {
      setError(response.error || 'Failed to load templates');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (): Promise<void> => {
    if (!draft) {
      return;
    }

    setNotice('');
    const response = await AdminApiService.postElevated('/message-templates', {
      key: draft.key,
      name: draft.name,
      channel: draft.channel,
      subject: draft.subject,
      body: draft.body,
      is_active: draft.is_active,
    });

    if (!response.success) {
      setNotice(response.error || 'Save failed');
      return;
    }

    setNotice('Template saved.');
    setDraft(null);
    setPreview(null);
    await load();
  };

  const runPreview = async (): Promise<void> => {
    if (!draft?.key) {
      return;
    }

    const response = await AdminApiService.post<{ subject: string; body: string }>(
      '/messages/preview',
      { template_key: draft.key }
    );

    if (response.success && response.data) {
      setPreview(response.data);
      setNotice('');
    } else {
      setNotice(response.error || 'Preview failed');
    }
  };

  if (loading) {
    return <p className="text-slate-500 text-sm">Loading templates…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Message templates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Used for welcome and follow-up messages. Variables:{' '}
            {variables.map((v) => (
              <code key={v} className="text-indigo-300 mr-2">{`{{${v}}}`}</code>
            ))}
          </p>
        </div>
        <button
          onClick={() => {
            setDraft({ ...EMPTY_TEMPLATE });
            setPreview(null);
          }}
          className="px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors"
        >
          New template
        </button>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-900 text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {notice && <div className="text-sm text-slate-400">{notice}</div>}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/50 text-slate-400">
              <th className="text-left px-5 py-3 font-medium">Key</th>
              <th className="text-left px-5 py-3 font-medium">Name</th>
              <th className="text-left px-5 py-3 font-medium">Channel</th>
              <th className="text-left px-5 py-3 font-medium">Active</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {templates.map((template) => (
              <tr key={template.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-5 py-3">
                  <code className="text-xs text-indigo-300">{template.key}</code>
                </td>
                <td className="px-5 py-3">{template.name}</td>
                <td className="px-5 py-3 text-slate-400">{template.channel}</td>
                <td className="px-5 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      template.is_active
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                  >
                    {template.is_active ? 'active' : 'inactive'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => {
                      setDraft({ ...template });
                      setPreview(null);
                    }}
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-slate-300">
            {draft.id ? `Edit "${draft.key}"` : 'New template'}
          </h2>

          {draft.key === 'welcome' && !draft.is_active && (
            <div className="bg-amber-950 border border-amber-900 text-amber-300 px-3 py-2 rounded-lg text-xs">
              Deactivating the welcome template stops new accounts receiving any welcome message.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="tpl-key" className="block text-xs text-slate-500 mb-1.5">
                Key (stable identifier)
              </label>
              <input
                id="tpl-key"
                value={draft.key}
                onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                disabled={Boolean(draft.id)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="tpl-name" className="block text-xs text-slate-500 mb-1.5">
                Name
              </label>
              <input
                id="tpl-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="tpl-channel" className="block text-xs text-slate-500 mb-1.5">
                Channel
              </label>
              <select
                id="tpl-channel"
                value={draft.channel}
                onChange={(e) => setDraft({ ...draft, channel: e.target.value as 'email' | 'in_app' })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none"
              >
                <option value="email">Email</option>
                <option value="in_app">In-app alert</option>
              </select>
            </div>
            <div>
              <label htmlFor="tpl-subject" className="block text-xs text-slate-500 mb-1.5">
                Subject (email only)
              </label>
              <input
                id="tpl-subject"
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="tpl-body" className="block text-xs text-slate-500 mb-1.5">
              Body
            </label>
            <textarea
              id="tpl-body"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={8}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm font-mono outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
            />
            Active
          </label>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={!draft.key || !draft.name || !draft.body}
              className="px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors"
            >
              Save template
            </button>
            <button
              onClick={runPreview}
              disabled={!draft.id}
              title={draft.id ? '' : 'Save the template first to preview it'}
              className="px-3 py-2 text-sm rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              Preview
            </button>
            <button
              onClick={() => {
                setDraft(null);
                setPreview(null);
              }}
              className="px-3 py-2 text-sm rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          </div>

          {preview && (
            <div className="border border-slate-800 rounded-lg p-4 bg-slate-950">
              <p className="text-xs text-slate-500 mb-2">Preview (sample recipient — nothing sent)</p>
              {preview.subject && <p className="text-sm font-medium mb-2">{preview.subject}</p>}
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">{preview.body}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminMessageTemplatesPage;
