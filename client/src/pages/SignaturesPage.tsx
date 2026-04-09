import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ApiService } from '../services/api';
import SignaturePadComponent from '../components/SignaturePadComponent';

interface UserSignature {
  id: string;
  user_id: string;
  signature_type: string;
  signature_data?: string;
}

function SignaturesPage() {
  const [signatures, setSignatures] = useState<UserSignature[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fetchSignatures = async (): Promise<void> => {
    try {
      const response = await ApiService.get<{ userSignatures: UserSignature[] }>('/user-signatures');
      if (response.success && response.data) {
        setSignatures(response.data.userSignatures);
      }
    } catch {
      console.error('Failed to fetch signatures');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignatures();
  }, []);

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this signature?')) return;
    try {
      const response = await ApiService.delete(`/user-signatures/${id}`);
      if (response.success) {
        setSignatures((prev) => prev.filter((s) => s.id !== id));
      } else {
        setError(response.error || 'Failed to delete signature');
      }
    } catch {
      setError('An unexpected error occurred');
    }
  };

  const handleEditSave = async (dataUrl: string): Promise<void> => {
    if (!editingId) return;
    setSaving(true);
    setError('');
    try {
      const response = await ApiService.put(`/user-signatures/${editingId}`, {
        signature_data: dataUrl,
      });
      if (response.success) {
        setSignatures((prev) =>
          prev.map((s) => (s.id === editingId ? { ...s, signature_data: dataUrl } : s))
        );
        setEditingId(null);
      } else {
        setError(response.error || 'Failed to update signature');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">My Signatures</h2>
        <Link
          to="/signatures/create"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Create New Signature
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-600">Dismiss</button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Your Signatures</h3>
        </div>
        {loading ? (
          <div className="p-6 text-gray-500">Loading...</div>
        ) : signatures.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No signatures yet.
            <Link to="/signatures/create" className="text-indigo-600 ml-1 font-medium hover:text-indigo-700">Create one</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {signatures.map((sig: UserSignature) => (
              <div key={sig.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {sig.signature_data && (
                      <img src={sig.signature_data} alt="Signature" className="h-10 object-contain border border-gray-100 rounded px-2 bg-white" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{sig.signature_type}</p>
                      <p className="text-sm text-gray-500">ID: {sig.id.slice(0, 8)}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sig.signature_type === 'drawn' && (
                      <button
                        onClick={() => setEditingId(editingId === sig.id ? null : sig.id)}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        {editingId === sig.id ? 'Cancel' : 'Edit'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(sig.id)}
                      className="text-sm text-red-500 hover:text-red-700 font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Inline edit pad */}
                {editingId === sig.id && (
                  <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <p className="text-sm text-gray-600 mb-3">Re-draw your signature:</p>
                    <SignaturePadComponent onSave={handleEditSave} height={200} />
                    {saving && <p className="text-sm text-gray-500 mt-2">Saving...</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SignaturesPage;
