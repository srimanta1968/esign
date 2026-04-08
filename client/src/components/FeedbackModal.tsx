import { useState } from 'react';
import { ApiService } from '../services/api';

interface FeedbackModalProps {
  signatureId: string;
  onClose: () => void;
}

function FeedbackModal({ signatureId, onClose }: FeedbackModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (): Promise<void> => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await ApiService.post('/analytics/signature-event', {
        event_type: 'signing_feedback',
        signature_id: signatureId,
        rating,
        comment,
      });
    } catch {
      // Silent - feedback is optional
    }
    setSubmitted(true);
    setSubmitting(false);
    setTimeout(onClose, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        {submitted ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-900 font-medium">Thank you for your feedback!</p>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">How was your experience?</h3>
            <p className="text-sm text-gray-500 mb-4">Rate your signing experience</p>

            <div className="flex items-center justify-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <svg
                    className={`w-8 h-8 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any additional comments? (optional)"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none mb-4 text-sm"
            />

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium"
              >
                Skip
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FeedbackModal;
