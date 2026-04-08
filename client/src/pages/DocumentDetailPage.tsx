import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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

interface Version {
  id: string;
  version_number: number;
  uploaded_by: string;
  uploader_email?: string;
  created_at: string;
  file_size?: number;
  comment?: string;
}

function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [signatures, setSignatures] = useState<SignatureRequest[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [showVersionPanel, setShowVersionPanel] = useState<boolean>(false);
  const [uploadingVersion, setUploadingVersion] = useState<boolean>(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string>('');
  const [versionSuccess, setVersionSuccess] = useState<string>('');
  const versionFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const [docResponse, sigResponse, versionsResponse] = await Promise.all([
          ApiService.get<{ document: Document }>(`/documents/${id}`),
          ApiService.get<{ signatures: SignatureRequest[] }>(`/signatures/${id}`),
          ApiService.get<{ versions: Version[] }>(`/documents/${id}/versions`),
        ]);

        if (docResponse.success && docResponse.data) {
          setDocument(docResponse.data.document);
        }
        if (sigResponse.success && sigResponse.data) {
          setSignatures(sigResponse.data.signatures);
        }
        if (versionsResponse.success && versionsResponse.data) {
          setVersions(versionsResponse.data.versions);
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

  const handleUploadVersion = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingVersion(true);
    setVersionError('');
    setVersionSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const data = await ApiService.upload<{ version: Version }>(`/documents/${id}/versions`, formData);

      if (data.success && data.data) {
        setVersions((prev) => [data.data!.version, ...prev]);
        setVersionSuccess('New version uploaded successfully');
        setTimeout(() => setVersionSuccess(''), 3000);
      } else {
        setVersionError(data.error || 'Failed to upload new version');
      }
    } catch {
      setVersionError('Failed to upload new version');
    } finally {
      setUploadingVersion(false);
      if (versionFileRef.current) versionFileRef.current.value = '';
    }
  };

  const handleRevert = async (versionId: string): Promise<void> => {
    if (!window.confirm('Revert to this version? This will create a new version based on the selected one.')) return;
    setRevertingId(versionId);

    try {
      const response = await ApiService.post<{ version: Version }>(`/documents/${id}/versions/${versionId}/revert`, {});
      if (response.success && response.data) {
        setVersions((prev) => [response.data!.version, ...prev]);
        setVersionSuccess('Document reverted successfully');
        setTimeout(() => setVersionSuccess(''), 3000);
      } else {
        setVersionError(response.error || 'Failed to revert version');
      }
    } catch {
      setVersionError('Failed to revert version');
    } finally {
      setRevertingId(null);
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
            <h2 className="text-2xl font-bold text-gray-900">{document.original_name || document.file_path}</h2>
            <p className="text-gray-500 mt-1">Uploaded {new Date(document.uploaded_at).toLocaleDateString()}</p>
            <p className="text-gray-400 text-sm mt-1">ID: {document.id}</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <a
              href={`/api/documents/${document.id}/download`}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                const token = localStorage.getItem('token');
                fetch(`/api/documents/${document.id}/download`, {
                  headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                }).then(res => res.blob()).then(blob => {
                  const url = window.URL.createObjectURL(blob);
                  const a = window.document.createElement('a');
                  a.href = url;
                  a.download = document.original_name || 'document';
                  a.click();
                  window.URL.revokeObjectURL(url);
                });
              }}
            >
              Download
            </a>
            <button
              onClick={() => setShowVersionPanel(!showVersionPanel)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showVersionPanel ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
              }`}
            >
              Versions {versions.length > 0 && `(${versions.length})`}
            </button>
            <Link to={`/signatures/request/${document.id}`} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              Request Signature
            </Link>
            <Link to={`/workflows/create?documentId=${document.id}`} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
              Create Workflow
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

      {/* Version History Panel */}
      {showVersionPanel && (
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Version History</h3>
            <div>
              <input
                ref={versionFileRef}
                type="file"
                onChange={handleUploadVersion}
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="hidden"
              />
              <button
                onClick={() => versionFileRef.current?.click()}
                disabled={uploadingVersion}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {uploadingVersion ? 'Uploading...' : 'Upload New Version'}
              </button>
            </div>
          </div>

          {versionError && <div className="mx-6 mt-4 bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{versionError}</div>}
          {versionSuccess && <div className="mx-6 mt-4 bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm">{versionSuccess}</div>}

          {versions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No version history available.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {versions.map((version, index) => (
                <div key={version.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      v{version.version_number}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Version {version.version_number}
                        {index === 0 && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Current</span>}
                      </p>
                      <p className="text-sm text-gray-500">
                        {version.uploader_email || 'Unknown'} &middot; {new Date(version.created_at).toLocaleString()}
                        {version.file_size && ` &middot; ${(version.file_size / 1024).toFixed(1)} KB`}
                      </p>
                    </div>
                  </div>
                  {index !== 0 && (
                    <button
                      onClick={() => handleRevert(version.id)}
                      disabled={revertingId === version.id}
                      className="text-sm text-indigo-600 font-medium hover:text-indigo-700 disabled:opacity-50"
                    >
                      {revertingId === version.id ? 'Reverting...' : 'Revert'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Signature Requests */}
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
