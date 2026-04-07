import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ApiService } from '../services/api';

interface Document {
  id: string;
  user_id: string;
  file_path: string;
  original_name: string;
  uploaded_at: string;
}

interface SignatureRequest {
  id: string;
  document_id: string;
  signer_email: string;
  status: string;
}

function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [signatures, setSignatures] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const docResponse = await ApiService.get<{ documents: Document[] }>('/documents');
        if (docResponse.success && docResponse.data) {
          setDocuments(docResponse.data.documents);

          const allSigs: SignatureRequest[] = [];
          for (const doc of docResponse.data.documents) {
            const sigResponse = await ApiService.get<{ signatures: SignatureRequest[] }>(`/signatures/${doc.id}`);
            if (sigResponse.success && sigResponse.data) {
              allSigs.push(...sigResponse.data.signatures);
            }
          }
          setSignatures(allSigs);
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

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Documents</h3>
          <p className="text-3xl font-bold text-gray-900 mt-1">{documents.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Pending Signatures</h3>
          <p className="text-3xl font-bold text-yellow-600 mt-1">{signatures.filter((s: SignatureRequest) => s.status === 'pending').length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Signed</h3>
          <p className="text-3xl font-bold text-green-600 mt-1">{signatures.filter((s: SignatureRequest) => s.status === 'signed').length}</p>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <Link to="/upload" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">Upload Document</Link>
        <Link to="/signatures" className="border border-indigo-600 text-indigo-600 px-6 py-2 rounded-lg font-medium hover:bg-indigo-50 transition-colors">My Signatures</Link>
      </div>

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
                    <Link to={`/signatures/request/${doc.id}`} className="text-indigo-600 text-sm font-medium hover:text-indigo-700">Request Signature</Link>
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
