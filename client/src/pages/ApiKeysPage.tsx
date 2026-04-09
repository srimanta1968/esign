import { useState, useEffect } from 'react';
import { ApiService } from '../services/api';

const curlExamples = [
  {
    title: 'Upload a document',
    code: `curl -X POST https://api.edocsign.com/api/documents \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@contract.pdf"`,
  },
  {
    title: 'Create a workflow',
    code: `curl -X POST https://api.edocsign.com/api/workflows \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"document_id": "...", "workflow_type": "sequential", "recipients": [...]}'`,
  },
  {
    title: 'Check workflow status',
    code: `curl https://api.edocsign.com/api/workflows/{id}/status \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
];

interface ApiKey {
  id: string;
  key_prefix: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchKeys = async () => {
    try {
      const res = await ApiService.get<{ keys: ApiKey[] }>('/auth/api-keys');
      if (res.success && res.data) {
        setKeys(res.data.keys || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setNewKey(null);
    try {
      const res = await ApiService.post<{ key: string; prefix: string; label: string }>('/auth/api-keys', {
        label: label.trim() || 'Default',
      });
      if (res.success && res.data) {
        setNewKey(res.data.key);
        setLabel('');
        fetchKeys();
      } else {
        setError(res.error || 'Failed to generate key');
      }
    } catch {
      setError('Failed to generate key');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? Any integrations using it will stop working.')) return;
    try {
      const res = await ApiService.delete(`/auth/api-keys/${id}`);
      if (res.success) {
        fetchKeys();
      } else {
        setError(res.error || 'Failed to revoke key');
      }
    } catch {
      setError('Failed to revoke key');
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">API Keys</h1>
        <p className="text-gray-500">Generate API keys to integrate eDocSign with your applications.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-600">Dismiss</button>
        </div>
      )}

      {/* Generate section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">Generate New Key</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1">Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Production, Development"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {generating ? 'Generating...' : 'Generate Key'}
          </button>
        </div>

        {newKey && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800 mb-2">
                  Your API key has been generated. Copy it now — it won't be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-white border border-green-200 rounded px-3 py-1.5 font-mono text-gray-800 flex-1 truncate">
                    {newKey}
                  </code>
                  <button
                    onClick={() => handleCopy(newKey, 'new-key')}
                    className="shrink-0 bg-green-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    {copiedId === 'new-key' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active keys */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Active Keys</h2>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">Loading...</div>
        ) : activeKeys.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <p className="text-sm text-gray-500">No API keys yet. Generate one above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Key</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Label</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Created</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Last Used</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeKeys.map((key) => (
                <tr key={key.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono text-gray-600">{key.key_prefix}••••••••</td>
                  <td className="px-6 py-3 font-medium text-gray-900">{key.label}</td>
                  <td className="px-6 py-3 text-gray-500">{new Date(key.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-3 text-gray-500">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleRevoke(key.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Revoked keys */}
      {revokedKeys.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8 opacity-60">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-500">Revoked Keys</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {revokedKeys.map((key) => (
              <div key={key.id} className="px-6 py-3 flex items-center justify-between text-sm">
                <span className="font-mono text-gray-400">{key.key_prefix}••••••••</span>
                <span className="text-gray-400">{key.label}</span>
                <span className="text-xs text-red-400">Revoked {new Date(key.revoked_at!).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Documentation */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">API Documentation</h2>
        <p className="text-sm text-gray-500 mb-4">Use these endpoints to integrate eDocSign into your application.</p>

        <h3 className="text-sm font-semibold text-gray-700 mb-2">Base URL</h3>
        <code className="block text-sm bg-gray-50 border border-gray-200 rounded-md px-3 py-2 mb-6 text-gray-700 font-mono">
          https://api.edocsign.com/api
        </code>

        <h3 className="text-sm font-semibold text-gray-700 mb-4">Examples</h3>
        <div className="space-y-5">
          {curlExamples.map((ex) => (
            <div key={ex.title}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">{ex.title}</p>
                <button
                  onClick={() => handleCopy(ex.code, ex.title)}
                  className="text-xs text-gray-500 hover:text-indigo-600 font-medium transition-colors flex items-center gap-1"
                >
                  {copiedId === ex.title ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="text-xs bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">
                <code>{ex.code}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ApiKeysPage;
