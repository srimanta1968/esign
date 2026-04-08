import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ApiService } from '../services/api';
import SignaturePadComponent from '../components/SignaturePadComponent';
import FeedbackModal from '../components/FeedbackModal';

interface UserSignature {
  id: string;
  user_id: string;
  signature_type: string;
  signature_data?: string;
}

function SignDocumentPage() {
  const { signatureId } = useParams<{ signatureId: string }>();
  const navigate = useNavigate();
  const [savedSignatures, setSavedSignatures] = useState<UserSignature[]>([]);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string>('');
  const [mode, setMode] = useState<'draw' | 'saved'>('draw');
  const [signing, setSigning] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [drawnDataUrl, setDrawnDataUrl] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState<boolean>(false);

  useEffect(() => {
    const fetchSavedSignatures = async (): Promise<void> => {
      try {
        const response = await ApiService.get<{ userSignatures: UserSignature[] }>('/user-signatures');
        if (response.success && response.data) {
          setSavedSignatures(response.data.userSignatures);
        }
      } catch {
        console.error('Failed to fetch saved signatures');
      }
    };

    fetchSavedSignatures();
  }, []);

  const handleDrawnSignature = (dataUrl: string): void => {
    setDrawnDataUrl(dataUrl);
  };

  const handleSign = async (): Promise<void> => {
    setError('');
    setSuccess('');
    setSigning(true);

    try {
      const body: Record<string, any> = {};
      if (mode === 'saved' && selectedSignatureId) {
        body.user_signature_id = selectedSignatureId;
      } else if (mode === 'draw' && drawnDataUrl) {
        body.signature_data = drawnDataUrl;
      }

      const response = await ApiService.request(`/signatures/${signatureId}/sign`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      if (response.success) {
        setSuccess('Document signed successfully!');
        // Track analytics event
        ApiService.post('/analytics/signature-event', {
          event_type: 'document_signed',
          signature_id: signatureId,
        }).catch(() => {});
        setShowFeedback(true);
        setTimeout(() => {
          if (!showFeedback) navigate('/dashboard');
        }, 3000);
      } else {
        setError(response.error || 'Failed to sign document');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign Document</h2>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-6 text-sm">{success}</div>}

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setMode('draw')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${mode === 'draw' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Draw Signature
          </button>
          <button
            onClick={() => setMode('saved')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${mode === 'saved' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Use Saved Signature
          </button>
        </div>

        {mode === 'draw' ? (
          <div>
            <p className="text-sm text-gray-600 mb-3">Draw your signature below (mouse, touch, or stylus):</p>
            <SignaturePadComponent onSave={handleDrawnSignature} height={200} />
            {drawnDataUrl && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700 font-medium">Signature captured. Click "Apply Signature" to proceed.</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            {savedSignatures.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No saved signatures found.</p>
                <Link to="/signatures/create" className="text-indigo-600 font-medium hover:text-indigo-700">Create a signature first</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {savedSignatures.map((sig: UserSignature) => (
                  <label
                    key={sig.id}
                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${selectedSignatureId === sig.id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <input
                      type="radio"
                      name="signature"
                      value={sig.id}
                      checked={selectedSignatureId === sig.id}
                      onChange={() => setSelectedSignatureId(sig.id)}
                      className="mr-3"
                    />
                    <div className="flex items-center gap-3">
                      {sig.signature_data && (
                        <img src={sig.signature_data} alt="Signature" className="h-8 object-contain" />
                      )}
                      <span className="font-medium text-gray-900 capitalize">{sig.signature_type}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-4 items-center">
        <button
          onClick={handleSign}
          disabled={signing || (mode === 'draw' && !drawnDataUrl) || (mode === 'saved' && !selectedSignatureId)}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {signing ? 'Signing...' : 'Apply Signature'}
        </button>
        <Link
          to={`/sign/${signatureId}/confirm`}
          className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
        >
          Review Before Signing
        </Link>
        <Link to="/dashboard" className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium">Cancel</Link>
      </div>

      {/* Feedback modal after signing */}
      {showFeedback && signatureId && (
        <FeedbackModal
          signatureId={signatureId}
          onClose={() => {
            setShowFeedback(false);
            navigate('/dashboard');
          }}
        />
      )}
    </div>
  );
}

export default SignDocumentPage;
