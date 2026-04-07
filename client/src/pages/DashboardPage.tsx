import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/api';

interface Document {
  id: string;
  user_id: string;
  file_path: string;
  uploaded_at: string;
}

interface SignatureRequest {
  id: string;
  document_id: string;
  signer_email: string;
  status: string;
}

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  const handleLogout = (): void => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-indigo-600">eDocSign</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 text-sm">{user?.email}</span>
            <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700 text-sm font-medium">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-gray-500 text-sm font-medium">Documents</h3>
            <p className="text-3xl font-bold text-gray-900 mt-1">{documents.length}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-gray-500 text-sm font-medium">Pending Signatures</h3>
            <p className="text-3xl font-bold text-gray-900 mt-1">{signatures.filter((s: SignatureRequest) => s.status === 'pending').length}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-gray-500 text-sm font-medium">Completed</h3>
            <p className="text-3xl font-bold text-gray-900 mt-1">{signatures.filter((s: SignatureRequest) => s.status === 'completed').length}</p>
          </div>
        </div>

        <div className="flex gap-4 mb-8">
          <Link to="/upload" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">Upload Document</Link>
          <Link to="/signatures" className="border border-indigo-600 text-indigo-600 px-6 py-2 rounded-lg font-medium hover:bg-indigo-50 transition-colors">My Signatures</Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Recent Documents</h2>
            </div>
            {documents.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No documents yet. Upload your first document to get started.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {documents.map((doc: Document) => (
                  <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{doc.file_path}</p>
                      <p className="text-sm text-gray-500">Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                    </div>
                    <Link to={`/signatures/request/${doc.id}`} className="text-indigo-600 text-sm font-medium hover:text-indigo-700">Request Signature</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default DashboardPage;
