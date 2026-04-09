import { Link } from 'react-router-dom';

function CheckoutCancelPage() {
  return (
    <div className="flex items-center justify-center py-24 px-4">
      <div className="max-w-md w-full text-center">
        {/* Yellow warning icon */}
        <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.832c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Checkout Cancelled</h1>
        <p className="text-gray-500 mb-8">
          No charges were made. You can try again anytime.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            to="/pricing"
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Back to Pricing
          </Link>
          <Link
            to="/dashboard"
            className="bg-white border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default CheckoutCancelPage;
