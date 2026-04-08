import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ApiService } from '../services/api';

interface SignatureInfo {
  id: string;
  document_id: string;
  document_name: string;
  signer_email: string;
  status: string;
  signature_preview?: string;
}

function SignatureConfirmPage() {
  const { signatureId } = useParams<{ signatureId: string }>();
  const navigate = useNavigate();
  const [signatureInfo, setSignatureInfo] = useState<SignatureInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);

  useEffect(() => {
    const fetchSignatureInfo = async (): Promise<void> => {
      try {
        const response = await ApiService.get<{ signature: SignatureInfo }>(`/signatures/${signatureId}/preview`);
        if (response.success && response.data) {
          setSignatureInfo(response.data.signature);
        }
      } catch {
        setError('Failed to load signature information');
      } finally {
        setLoading(false);
      }
    };
    fetchSignatureInfo();
  }, [signatureId]);

  const handleConfirm = async (): Promise<void> => {
    setConfirming(true);
    setError('');
    try {
      const response = await ApiService.post(`/signatures/${signatureId}/confirm`, {});
      if (response.success) {
        setConfirmed(true);
        setShowFeedback(true);
        // Track signing event
        ApiService.post('/analytics/signature-event', {
          event_type: 'signature_confirmed',
          signature_id: signatureId,
        }).catch(() => {});
      } else {
        setError(response.error || 'Failed to confirm signature');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setConfirming(false);
    }
  };

  const handleFeedbackSubmit = async (): Promise<void> => {
    try {
      await ApiService.post('/analytics/signature-event', {
        event_type: 'signing_feedback',
        signature_id: signatureId,
        rating: feedbackRating,
        comment: feedbackComment,
      });
      setFeedbackSubmitted(true);
    } catch {
      // Silent - feedback is optional
      setFeedbackSubmitted(true);
    }
  };

  const handleDownload = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      const docId = signatureInfo?.document_id;
      const res = await fetch(`/api/documents/${docId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = signatureInfo?.document_name || 'signed-document';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download document');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Loading...</p></div>;
  }

  // Success state with feedback
  if (confirmed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Document Signed!</h2>
          <p className="text-gray-500 mb-6">
            Your signature has been applied successfully. A confirmation email has been sent.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleDownload}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Download Signed Document
            </button>
            <Link
              to="/dashboard"
              className="text-gray-500 hover:text-gray-700 font-medium text-sm"
            >
              Back to Dashboard
            </Link>
          </div>

          {/* Feedback modal */}
          {showFeedback && !feedbackSubmitted && (
            <div className="mt-8 border-t border-gray-100 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">How was your signing experience?</h3>
              <p className="text-sm text-gray-500 mb-4">Your feedback helps us improve.</p>

              {/* Star rating */}
              <div className="flex items-center justify-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    className="p-1 transition-colors"
                  >
                    <svg
                      className={`w-8 h-8 ${star <= feedbackRating ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                ))}
              </div>

              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Any additional comments? (optional)"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none mb-3 text-sm"
              />

              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleFeedbackSubmit}
                  disabled={feedbackRating === 0}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Submit Feedback
                </button>
                <button
                  onClick={() => setShowFeedback(false)}
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-2"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {feedbackSubmitted && (
            <div className="mt-6 text-sm text-green-600">Thank you for your feedback!</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Review & Confirm Signature</h2>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}

      {signatureInfo && (
        <>
          {/* Document Info */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Document Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Document:</span>
                <span className="font-medium text-gray-900">{signatureInfo.document_name || 'Document'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Signer:</span>
                <span className="font-medium text-gray-900">{signatureInfo.signer_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span className="font-medium text-yellow-600">{signatureInfo.status}</span>
              </div>
            </div>
          </div>

          {/* Signature Preview */}
          {signatureInfo.signature_preview && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Signature</h3>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <img
                  src={signatureInfo.signature_preview}
                  alt="Your signature"
                  className="max-h-24 mx-auto object-contain"
                />
              </div>
            </div>
          )}

          {/* Legal notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-blue-800 font-medium">Legal Notice</p>
                <p className="text-xs text-blue-700 mt-1">
                  By clicking "Confirm & Sign", you agree that your electronic signature is legally binding
                  and has the same legal effect as a handwritten signature, in accordance with the ESIGN Act
                  and UETA.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {confirming ? 'Confirming...' : 'Confirm & Sign'}
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default SignatureConfirmPage;
