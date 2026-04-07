import { useState, FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ApiService } from '../services/api';

function SignatureRequestPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const [signerEmail, setSignerEmail] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await ApiService.post('/signatures', { document_id: documentId, signer_email: signerEmail });
      if (response.success) {
        setSuccess('Signature request sent successfully');
        setSignerEmail('');
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        setError(response.error || 'Failed to send signature request');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Request Signature</h2>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-6 text-sm">{success}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <label htmlFor="signerEmail" className="block text-sm font-medium text-gray-700 mb-1">Signer Email</label>
          <input
            id="signerEmail"
            type="email"
            value={signerEmail}
            onChange={(e) => setSignerEmail(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            placeholder="signer@example.com"
          />
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
            {loading ? 'Sending...' : 'Send Request'}
          </button>
          <Link to="/dashboard" className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

export default SignatureRequestPage;
