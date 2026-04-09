import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Document {
  id: string;
  user_id: string;
  file_path: string;
  original_name: string;
  uploaded_at: string;
}

interface WorkflowRecipient {
  signer_email: string;
  signer_name: string;
  signing_order: number;
  status: string;
  signed_at: string | null;
}

interface DashboardWorkflow {
  id: string;
  document_id: string;
  document_name: string;
  workflow_type: 'sequential' | 'parallel';
  status: string;
  created_at: string;
  updated_at: string;
  recipients: WorkflowRecipient[];
}

function DashboardPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [workflows, setWorkflows] = useState<DashboardWorkflow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const docResponse = await ApiService.get<{ documents: Document[] }>('/documents');
        if (docResponse.success && docResponse.data) {
          setDocuments(docResponse.data.documents);
        }

        // Fetch workflows
        const wfResponse = await ApiService.get<{ workflows: any[] }>('/workflows');
        if (wfResponse.success && wfResponse.data) {
          const rawWorkflows = wfResponse.data.workflows || [];
          setWorkflows(rawWorkflows.map((w: any) => ({
            id: w.id,
            document_id: w.document_id,
            document_name: w.document_name || '',
            workflow_type: w.workflow_type,
            status: w.status,
            created_at: w.created_at,
            updated_at: w.updated_at,
            recipients: (w.recipients || w.signers || []).map((r: any) => ({
              signer_email: r.signer_email || r.email,
              signer_name: r.signer_name || r.name,
              signing_order: r.signing_order ?? r.order,
              status: r.status,
              signed_at: r.signed_at,
            })),
          })));
        }
      } catch {
        console.error('Failed to fetch dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Documents</h3>
          <p className="text-3xl font-bold text-gray-900 mt-1">{documents.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Active Workflows</h3>
          <p className="text-3xl font-bold text-yellow-600 mt-1">{workflows.filter((w) => w.status === 'active').length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Completed</h3>
          <p className="text-3xl font-bold text-green-600 mt-1">{workflows.filter((w) => w.status === 'completed').length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Total Workflows</h3>
          <p className="text-3xl font-bold text-indigo-600 mt-1">{workflows.length}</p>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <Link to="/upload" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">Upload Document</Link>
        <Link to="/signatures" className="border border-indigo-600 text-indigo-600 px-6 py-2 rounded-lg font-medium hover:bg-indigo-50 transition-colors">My Signatures</Link>
      </div>

      {/* Active Workflows */}
      {(() => {
        const activeWorkflows = workflows.filter((w) => w.status === 'active');
        const isYourTurn = (wf: DashboardWorkflow): boolean => {
          if (!user?.email) return false;
          const myRecipient = wf.recipients.find((r) => r.signer_email === user.email && r.status === 'pending');
          if (!myRecipient) return false;
          if (wf.workflow_type === 'sequential') {
            // Check no pending recipient before this one
            const hasPendingBefore = wf.recipients.some(
              (r) => r.signing_order < myRecipient.signing_order && r.status === 'pending'
            );
            return !hasPendingBefore;
          }
          return true;
        };
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Active Workflows</h2>
            </div>
            {activeWorkflows.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 mb-4">No active workflows</p>
                <Link to="/workflows/create" className="text-indigo-600 font-medium hover:text-indigo-700">Create a workflow</Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {activeWorkflows.map((wf) => {
                  const signedCount = wf.recipients.filter((r) => r.status === 'signed').length;
                  const totalCount = wf.recipients.length;
                  const yourTurn = isYourTurn(wf);
                  return (
                    <Link key={wf.id} to={`/workflows/${wf.id}`} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors block">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{wf.document_name || 'Untitled Document'}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {wf.workflow_type === 'sequential' ? 'Sequential' : 'Parallel'} &middot; Updated {new Date(wf.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        {yourTurn && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                            Your turn
                          </span>
                        )}
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          active
                        </span>
                        <span className="text-sm text-gray-500">{signedCount}/{totalCount} signed</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">Loading documents...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Recent Documents</h2>
          </div>
          {documents.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 mb-4">No documents yet.</p>
              <Link to="/upload" className="text-indigo-600 font-medium hover:text-indigo-700">Upload your first document</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {documents.map((doc: Document) => (
                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <Link to={`/documents/${doc.id}`} className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{doc.original_name || doc.file_path}</p>
                    <p className="text-sm text-gray-500">Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                  </Link>
                  <div className="flex gap-3 ml-4 shrink-0">
                    <Link to={`/documents/${doc.id}`} className="text-gray-500 text-sm font-medium hover:text-gray-700">Details</Link>
                    <Link to={`/workflows/create?documentId=${doc.id}`} className="text-indigo-600 text-sm font-medium hover:text-indigo-700">Request Signature</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
