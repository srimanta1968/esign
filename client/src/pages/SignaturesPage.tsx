import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiService } from '../services/api';

interface UserSignature {
  id: string;
  user_id: string;
  signature_type: string;
}

function SignaturesPage() {
  const [signatures, setSignatures] = useState<UserSignature[]>([]);
  const [signatureType, setSignatureType] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [creating, setCreating] = useState<boolean>(false);
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

  const handleCreate = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const response = await ApiService.post('/user-signatures', { signature_type: signatureType });
      if (response.success) {
        setSignatureType('');
        await fetchSignatures();
      } else {
        setError(response.error || 'Failed to create signature');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link to="/dashboard" className="text-2xl font-bold text-indigo-600">eDocSign</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">My Signatures</h2>

        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}

        <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm p-6 mb-6 flex gap-4">
          <input
            type="text"
            value={signatureType}
            onChange={(e) => setSignatureType(e.target.value)}
            required
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            placeholder="Signature type (e.g., drawn, typed, uploaded)"
          />
          <button type="submit" disabled={creating} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>

        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Your Signatures</h3>
          </div>
          {loading ? (
            <div className="p-6 text-gray-500">Loading...</div>
          ) : signatures.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No signatures yet. Create one above.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {signatures.map((sig: UserSignature) => (
                <div key={sig.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{sig.signature_type}</p>
                    <p className="text-sm text-gray-500">ID: {sig.id.slice(0, 8)}...</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default SignaturesPage;
