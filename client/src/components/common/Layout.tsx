import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ApiService } from '../../services/api';

interface LayoutProps {
  children: ReactNode;
}

interface Notification {
  id: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  document_id?: string;
  related_id?: string;
}

const NOTIFICATION_ICONS: Record<string, string> = {
  signature_requested: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
  signature_completed: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  document_shared: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
  reminder: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  system: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const TYPE_COLORS: Record<string, string> = {
  signature_requested: 'text-yellow-500',
  signature_completed: 'text-green-500',
  document_shared: 'text-blue-500',
  reminder: 'text-orange-500',
  system: 'text-gray-500',
};

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
  { code: 'de', label: 'DE' },
  { code: 'ja', label: 'JA' },
];

function Layout({ children }: LayoutProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [pulseNew, setPulseNew] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(localStorage.getItem('language') || 'en');
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLanguageChange = async (langCode: string): Promise<void> => {
    setSelectedLanguage(langCode);
    localStorage.setItem('language', langCode);
    if (isAuthenticated) {
      await ApiService.put('/users/language', { language: langCode }).catch(() => {});
    }
  };

  // Fetch initial notifications
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchNotifications = async (): Promise<void> => {
      try {
        const response = await ApiService.get<{ notifications: Notification[] }>('/notifications');
        if (response.success && response.data) {
          setNotifications(response.data.notifications);
          setUnreadCount(response.data.notifications.filter((n) => !n.is_read).length);
        }
      } catch { /* ignore */ }
    };
    fetchNotifications();
  }, [isAuthenticated, location.pathname]);

  // SSE connection with auto-reconnect
  const connectSSE = useCallback((): void => {
    if (!isAuthenticated) return;
    const token = ApiService.getToken();
    if (!token) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification' && data.notification) {
          const newNotif: Notification = data.notification;
          setNotifications((prev) => [newNotif, ...prev]);
          setUnreadCount((prev) => prev + 1);

          // Show toast
          setToast({ message: newNotif.message, type: newNotif.type });
          setTimeout(() => setToast(null), 5000);

          // Pulse animation
          setPulseNew(true);
          setTimeout(() => setPulseNew(false), 2000);
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      // Auto-reconnect after 5 seconds
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        connectSSE();
      }, 5000);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    connectSSE();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connectSSE]);

  const handleMarkRead = async (): Promise<void> => {
    await ApiService.request('/notifications/read', { method: 'PATCH' });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleNotificationClick = (n: Notification): void => {
    setShowNotifications(false);
    const docId = n.document_id || n.related_id;
    if (docId) {
      navigate(`/documents/${docId}`);
    }
  };

  const handleLogout = (): void => {
    logout();
    navigate('/');
  };

  const isActive = (path: string): string =>
    location.pathname === path ? 'text-indigo-600 font-semibold' : 'text-gray-600 hover:text-indigo-600';

  const isAdmin = user?.role === 'admin';

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-notification-panel]') && !target.closest('[data-notification-btn]')) {
        setShowNotifications(false);
      }
      if (!target.closest('[data-user-menu]') && !target.closest('[data-user-btn]')) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const getIconPath = (type: string): string =>
    NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.system;

  const getTypeColor = (type: string): string =>
    TYPE_COLORS[type] || TYPE_COLORS.system;

  // Group notifications by category
  const groupedNotifications = notifications.slice(0, 20).reduce<Record<string, Notification[]>>((acc, n) => {
    const cat = n.type || 'system';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(n);
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-white border border-gray-200 rounded-lg shadow-xl p-4 max-w-sm animate-[slideIn_0.3s_ease-out]">
          <div className="flex items-start gap-3">
            <svg className={`w-5 h-5 shrink-0 mt-0.5 ${getTypeColor(toast.type)}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getIconPath(toast.type)} />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">New Notification</p>
              <p className="text-sm text-gray-600 mt-0.5">{toast.message}</p>
            </div>
            <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

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
                <Link to="/documents/search" className={isActive('/documents/search')}>Search</Link>
                <Link to="/templates" className={isActive('/templates')}>Templates</Link>
                <Link to="/signatures" className={isActive('/signatures')}>My Signatures</Link>
                <Link to="/workflows/create" className={isActive('/workflows/create')}>Workflows</Link>
                {isAdmin && (
                  <>
                    <span className="text-gray-300">|</span>
                    <Link to="/admin/users" className={isActive('/admin/users')}>Users</Link>
                    <Link to="/admin/audit-logs" className={isActive('/admin/audit-logs')}>Audit Logs</Link>
                    <Link to="/admin/compliance" className={isActive('/admin/compliance')}>Compliance</Link>
                  </>
                )}
              </nav>
              <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                {/* Language selector */}
                <select
                  value={selectedLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="text-xs bg-gray-100 border-none rounded px-2 py-1 text-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.label}</option>
                  ))}
                </select>

                {/* Notification bell */}
                <div className="relative">
                  <button
                    data-notification-btn
                    onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications && unreadCount > 0) handleMarkRead(); }}
                    className="relative text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className={`absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center ${pulseNew ? 'animate-pulse' : ''}`}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  {showNotifications && (
                    <div data-notification-panel className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[28rem] overflow-hidden flex flex-col">
                      <div className="p-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                        <span className="font-semibold text-sm text-gray-900">Notifications</span>
                        {unreadCount > 0 && (
                          <button onClick={handleMarkRead} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                            Mark all as read
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-gray-500 text-sm">No notifications</div>
                        ) : (
                          Object.entries(groupedNotifications).map(([category, items]) => (
                            <div key={category}>
                              <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0">
                                {category.replace(/_/g, ' ')}
                              </div>
                              {items.map((n) => (
                                <button
                                  key={n.id}
                                  onClick={() => handleNotificationClick(n)}
                                  className={`w-full text-left p-3 border-b border-gray-50 text-sm hover:bg-gray-50 transition-colors flex items-start gap-2.5 ${
                                    n.is_read ? 'text-gray-500' : 'text-gray-900 bg-blue-50/50'
                                  }`}
                                >
                                  <svg className={`w-4 h-4 shrink-0 mt-0.5 ${getTypeColor(n.type)}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getIconPath(n.type)} />
                                  </svg>
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate">{n.message}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                                  </div>
                                  {(n.document_id || n.related_id) && (
                                    <span className="text-xs text-indigo-600 shrink-0 mt-0.5">View</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User menu */}
                <div className="relative">
                  <button
                    data-user-btn
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="text-gray-500 text-sm hidden sm:inline hover:text-gray-700 transition-colors"
                  >
                    {user?.email}
                  </button>
                  {showUserMenu && (
                    <div data-user-menu className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                      <Link
                        to="/profile"
                        onClick={() => setShowUserMenu(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Profile & Settings
                      </Link>
                      <Link
                        to="/settings/notifications"
                        onClick={() => setShowUserMenu(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Notification Preferences
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-red-600 font-medium transition-colors sm:hidden"
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
