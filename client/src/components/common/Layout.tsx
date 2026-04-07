import { ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = (): void => {
    logout();
    navigate('/');
  };

  const isActive = (path: string): string =>
    location.pathname === path ? 'text-indigo-600 font-semibold' : 'text-gray-600 hover:text-indigo-600';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2">
            <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xl font-bold text-indigo-600">eDocSign</span>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-6">
              <nav className="hidden md:flex items-center gap-5 text-sm">
                <Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link>
                <Link to="/upload" className={isActive('/upload')}>Upload</Link>
                <Link to="/signatures" className={isActive('/signatures')}>My Signatures</Link>
              </nav>
              <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                <span className="text-gray-500 text-sm hidden sm:inline">{user?.email}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-red-600 font-medium transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <nav className="flex items-center gap-4">
              <Link to="/login" className="text-gray-600 hover:text-indigo-600 font-medium text-sm transition-colors">Login</Link>
              <Link to="/register" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors">Get Started</Link>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-white font-bold">eDocSign</span>
              </div>
              <p className="text-sm leading-relaxed">
                Secure, scalable platform for document signing, management, and compliance.
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link to="/register" className="hover:text-white transition-colors">Get Started</Link></li>
                <li><span className="hover:text-white transition-colors cursor-default">Pricing</span></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><span className="hover:text-white transition-colors cursor-default">Privacy Policy</span></li>
                <li><span className="hover:text-white transition-colors cursor-default">Terms of Service</span></li>
                <li><span className="hover:text-white transition-colors cursor-default">Compliance</span></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><span className="hover:text-white transition-colors cursor-default">Help Center</span></li>
                <li><span className="hover:text-white transition-colors cursor-default">Contact Us</span></li>
                <li><span className="hover:text-white transition-colors cursor-default">Status</span></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm">eDocSign. All rights reserved.</p>
            <div className="flex gap-4 text-sm">
              <span className="hover:text-white transition-colors cursor-default">Twitter</span>
              <span className="hover:text-white transition-colors cursor-default">LinkedIn</span>
              <span className="hover:text-white transition-colors cursor-default">GitHub</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
