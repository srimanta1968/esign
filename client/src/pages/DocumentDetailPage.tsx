import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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

function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [signatures, setSignatures] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deleting, setDeleting] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const docResponse = await ApiService.get<{ document: Document }>(`/documents/${id}`);
        if (docResponse.success && docResponse.data) {
          setDocument(docResponse.data.document);
        }

        const sigResponse = await ApiService.get<{ signatures: SignatureRequest[] }>(`/signatures/${id}`);
        if (sigResponse.success && sigResponse.data) {
          setSignatures(sigResponse.data.signatures);
        }
      } catch {
        console.error('Failed to fetch document details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleDelete = async (): Promise<void> => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    setDeleting(true);

    try {
      const response = await ApiService.request(`/documents/${id}`, { method: 'DELETE' });
      if (response.success) {
        navigate('/dashboard');
      }
    } catch {
      console.error('Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  const statusColor = (status: string): string => {
    switch (status) {
      case 'signed': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Loading...</p></div>;
  }

  if (!document) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Document not found</p></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{document.file_path}</h2>
            <p className="text-gray-500 mt-1">Uploaded {new Date(document.uploaded_at).toLocaleDateString()}</p>
            <p className="text-gray-400 text-sm mt-1">ID: {document.id}</p>
          </div>
          <div className="flex gap-2">
            <Link to={`/signatures/request/${document.id}`} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              Request Signature
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Signature Requests</h3>
        </div>
        {signatures.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No signature requests yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {signatures.map((sig: SignatureRequest) => (
              <div key={sig.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{sig.signer_email}</p>
                  <p className="text-sm text-gray-500">ID: {sig.id.slice(0, 8)}...</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor(sig.status)}`}>
                    {sig.status}
                  </span>
                  {sig.status === 'pending' && (
                    <Link
                      to={`/sign/${sig.id}`}
                      className="text-indigo-600 text-sm font-medium hover:text-indigo-700"
                    >
                      Sign Now
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DocumentDetailPage;
