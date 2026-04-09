import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface WorkflowSummary {
  id: string;
  document_id: string;
  document_name: string;
  workflow_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  recipients: {
    id: string;
    signer_email: string;
    signer_name: string;
    signing_order: number;
    status: string;
    signed_at: string | null;
  }[];
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

function WorkflowsListPage() {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const fetchWorkflows = async (): Promise<void> => {
      try {
        const response = await ApiService.get<{ workflows: any[] }>('/workflows');
        if (response.success && response.data) {
          const mapped = response.data.workflows.map((w: any) => ({
            id: w.id,
            document_id: w.document_id,
            document_name: w.document_name || '',
            workflow_type: w.workflow_type,
            status: w.status,
            created_at: w.created_at,
            updated_at: w.updated_at,
            recipients: (w.recipients || []).map((r: any) => ({
              id: r.id,
              signer_email: r.signer_email || r.email,
              signer_name: r.signer_name || r.name,
              signing_order: r.signing_order ?? r.order,
              status: r.status,
              signed_at: r.signed_at,
            })),
          }));
          setWorkflows(mapped);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchWorkflows();
  }, []);

  const filtered = filter === 'all' ? workflows : workflows.filter((w) => w.status === filter);

  const getProgress = (w: WorkflowSummary): { signed: number; total: number } => {
    const total = w.recipients.length;
    const signed = w.recipients.filter((r) => r.status === 'signed').length;
    return { signed, total };
  };

  const isMyTurn = (w: WorkflowSummary): boolean => {
    if (w.status !== 'active') return false;
    const me = w.recipients.find((r) => r.signer_email === user?.email);
    if (!me || me.status !== 'pending') return false;
    if (w.workflow_type === 'sequential') {
      const pendingBefore = w.recipients.filter(
        (r) => r.signing_order < me.signing_order && r.status === 'pending'
      );
      return pendingBefore.length === 0;
    }
    return true;
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-gray-500">Loading workflows...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <p className="text-gray-500 text-sm mt-1">Track all your signing workflows</p>
        </div>
        <Link
          to="/workflows/create"
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm"
        >
          New Workflow
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {['all', 'draft', 'active', 'completed', 'cancelled'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1.5 text-xs opacity-75">
                ({workflows.filter((w) => w.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500">No workflows found</p>
          <Link to="/workflows/create" className="text-indigo-600 font-medium text-sm mt-2 inline-block hover:text-indigo-700">
            Create your first workflow
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((w) => {
            const progress = getProgress(w);
            const myTurn = isMyTurn(w);
            return (
              <Link
                key={w.id}
                to={`/workflows/${w.id}`}
                className="block bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5 border border-gray-100"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {w.document_name || 'Untitled Document'}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[w.status] || STATUS_STYLES.draft}`}>
                        {w.status}
                      </span>
                      {myTurn && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 animate-pulse">
                          Your turn to sign
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {w.workflow_type === 'sequential' ? 'Sequential' : 'Parallel'} signing
                      <span className="mx-2">-</span>
                      {w.recipients.map((r) => r.signer_name || r.signer_email).join(', ')}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Created {new Date(w.created_at).toLocaleDateString()}
                      {w.updated_at !== w.created_at && (
                        <span> - Updated {new Date(w.updated_at).toLocaleDateString()}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-gray-700">
                      {progress.signed}/{progress.total} signed
                    </p>
                    <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          progress.signed === progress.total ? 'bg-green-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${progress.total > 0 ? (progress.signed / progress.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default WorkflowsListPage;
