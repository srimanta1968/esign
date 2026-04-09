import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiService } from '../services/api';

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const navigate = useNavigate();

  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) navigate('/register');
    inputRefs.current[0]?.focus();
  }, [email, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (index: number, value: string): void => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newCode.every((d) => d !== '') && value) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent): void => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent): void => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  };

  const handleVerify = async (codeStr?: string): Promise<void> => {
    const verifyCode = codeStr || code.join('');
    if (verifyCode.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = await ApiService.post('/auth/verify-email', { email, code: verifyCode });
      if (response.success) {
        setSuccess('Email verified! Redirecting to dashboard...');
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        setError(response.error || 'Verification failed');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    setResending(true);
    setError('');
    try {
      const response = await ApiService.post('/auth/resend-verification', { email });
      if (response.success) {
        setSuccess('New code sent! Check your inbox.');
        setCountdown(60);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Failed to resend code');
      }
    } catch {
      setError('Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    handleVerify();
  };

  return (
    <div className="flex items-center justify-center px-4 py-16">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md border border-gray-100 text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify your email</h2>
        <p className="text-gray-500 mb-1">We sent a 6-digit code to</p>
        <p className="text-gray-900 font-medium mb-8">{email}</p>

        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}
        {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-6 text-sm">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="flex justify-center gap-3 mb-8" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || code.some((d) => !d)}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        <div className="mt-6">
          <p className="text-gray-500 text-sm">
            Didn't receive the code?{' '}
            <button
              onClick={handleResend}
              disabled={resending || countdown > 0}
              className="text-indigo-600 font-medium hover:text-indigo-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {countdown > 0 ? `Resend in ${countdown}s` : resending ? 'Sending...' : 'Resend code'}
            </button>
          </p>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 text-gray-400 text-sm hover:text-gray-600"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
