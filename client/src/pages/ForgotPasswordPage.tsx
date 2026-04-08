import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiService } from '../services/api';

function ForgotPasswordPage() {
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await ApiService.post('/auth/forgot-password', { email });
      if (response.success) {
        setSuccess(true);
      } else {
        setError(response.error || 'Failed to send reset email. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md border border-gray-100 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
          <p className="text-gray-500 mb-6">
            We've sent a password reset link to <strong className="text-gray-700">{email}</strong>.
            Please check your inbox and follow the instructions.
          </p>
          <Link to="/login" className="text-indigo-600 font-medium hover:text-indigo-700">Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center px-4 py-16">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md border border-gray-100">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-2">Forgot Password</h2>
        <p className="text-gray-500 text-center mb-8">Enter your email and we'll send you a reset link</p>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
              placeholder="you@example.com" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 mt-2">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="text-center text-gray-500 mt-6 text-sm">
          Remember your password?{' '}
          <Link to="/login" className="text-indigo-600 font-medium hover:text-indigo-700">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
