import { ReactNode } from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/admin-portal', label: 'Dashboard' },
  { to: '/admin-portal/accounts', label: 'Accounts' },
  { to: '/admin-portal/activity', label: 'Activity' },
];

/**
 * Shell for the platform admin portal.
 *
 * Intentionally does NOT reuse the customer Layout — the portal is internal
 * staff tooling, has its own navigation, and must not surface customer app
 * chrome or the customer's own session.
 */
function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, loading, elevated, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-slate-400 text-sm">Loading admin portal…</p>
      </div>
    );
  }

  // Client-side guard is convenience only — every /api/admin route is enforced
  // server-side by requirePlatformAdmin.
  if (!admin) {
    return <Navigate to="/admin-portal/login" replace state={{ from: location.pathname }} />;
  }

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/admin-portal/login', { replace: true });
  };

  const isActive = (to: string): boolean =>
    to === '/admin-portal' ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-semibold tracking-tight">
              eDocSign <span className="text-indigo-400">Platform Admin</span>
            </span>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    isActive(item.to)
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-2 py-1 rounded-full border ${
                elevated
                  ? 'border-emerald-700 bg-emerald-950 text-emerald-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400'
              }`}
              title={
                elevated
                  ? 'Session is elevated — mutating actions are permitted'
                  : 'Confirm your password to perform mutating actions'
              }
            >
              {elevated ? 'Elevated' : 'Read-only'}
            </span>
            <span className="text-sm text-slate-400">{admin.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-1.5 rounded-md border border-slate-700 hover:bg-slate-800 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

export default AdminLayout;
