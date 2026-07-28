import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

/**
 * Sign-in for the platform admin portal.
 *
 * Separate from the customer login: it posts to /api/admin/auth/login, which
 * accepts only platform_admin accounts and issues a short-TTL admin token.
 */
function AdminLoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await login(email, password);

    setSubmitting(false);

    if (result.ok) {
      navigate('/admin-portal', { replace: true });
      return;
    }

    setError(result.error || 'Sign in failed');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold">
            eDocSign <span className="text-indigo-400">Platform Admin</span>
          </h1>
          <p className="text-sm text-slate-500 mt-2">Internal staff access only.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          {error && (
            <div className="bg-red-950 border border-red-900 text-red-300 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="admin-email" className="block text-sm text-slate-400 mb-1.5">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm text-slate-400 mb-1.5">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg py-2 text-sm font-medium"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLoginPage;
