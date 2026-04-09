import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function CheckoutSuccessPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center py-24 px-4">
      <div className="max-w-md w-full text-center">
        {/* Green checkmark */}
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Your New Plan!</h1>
        <p className="text-gray-500 mb-8">
          Your subscription is now active. You can start using your new plan immediately.
        </p>

        <Link
          to="/dashboard"
          className="inline-block bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          Go to Dashboard
        </Link>

        <p className="text-xs text-gray-400 mt-4">
          Redirecting to dashboard in {countdown} second{countdown !== 1 ? 's' : ''}...
        </p>
      </div>
    </div>
  );
}

export default CheckoutSuccessPage;
