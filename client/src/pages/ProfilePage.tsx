import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/api';

interface Session {
  id: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  last_active: string;
  is_current: boolean;
}

interface ProfileData {
  name: string;
  email: string;
  language: string;
  privacy_profile_visible: boolean;
  privacy_email_visible: boolean;
  privacy_activity_tracking: boolean;
}

function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    email: '',
    language: 'en',
    privacy_profile_visible: true,
    privacy_email_visible: true,
    privacy_activity_tracking: true,
  });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [success, setSuccess] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'sessions' | 'privacy'>('profile');

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const [profileRes, sessionsRes] = await Promise.all([
          ApiService.get<{ profile: ProfileData }>('/auth/profile'),
          ApiService.get<{ sessions: Session[] }>('/auth/sessions'),
        ]);

        if (profileRes.success && profileRes.data) {
          setProfile(profileRes.data.profile);
        } else {
          setProfile((prev) => ({ ...prev, name: user?.name || '', email: user?.email || '' }));
        }

        if (sessionsRes.success && sessionsRes.data) {
          setSessions(sessionsRes.data.sessions);
        }
      } catch {
        setProfile((prev) => ({ ...prev, name: user?.name || '', email: user?.email || '' }));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleSaveProfile = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await ApiService.put('/auth/profile', {
        name: profile.name,
        language: profile.language,
      });
      if (response.success) {
        setSuccess('Profile updated successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Failed to update profile');
      }
    } catch {
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrivacy = async (): Promise<void> => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await ApiService.put('/auth/privacy', {
        profile_visible: profile.privacy_profile_visible,
        email_visible: profile.privacy_email_visible,
        activity_tracking: profile.privacy_activity_tracking,
      });
      if (response.success) {
        setSuccess('Privacy settings updated');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Failed to update privacy settings');
      }
    } catch {
      setError('Failed to update privacy settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeSession = async (sessionId: string): Promise<void> => {
    setRevokingId(sessionId);
    try {
      const response = await ApiService.delete(`/auth/sessions/${sessionId}`);
      if (response.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } else {
        setError(response.error || 'Failed to revoke session');
      }
    } catch {
      setError('Failed to revoke session');
    } finally {
      setRevokingId(null);
    }
  };

  const handleLogoutAll = async (): Promise<void> => {
    if (!window.confirm('This will log you out from all other devices. Continue?')) return;
    setLoggingOutAll(true);
    try {
      const response = await ApiService.post('/auth/sessions/revoke-all', {});
      if (response.success) {
        setSessions((prev) => prev.filter((s) => s.is_current));
        setSuccess('All other sessions have been revoked');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Failed to revoke sessions');
      }
    } catch {
      setError('Failed to revoke sessions');
    } finally {
      setLoggingOutAll(false);
    }
  };

  const parseUserAgent = (ua: string): string => {
    if (!ua) return 'Unknown device';
    if (ua.includes('Chrome')) return 'Chrome Browser';
    if (ua.includes('Firefox')) return 'Firefox Browser';
    if (ua.includes('Safari')) return 'Safari Browser';
    if (ua.includes('Edge')) return 'Edge Browser';
    return 'Unknown Browser';
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Loading...</p></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Account Settings</h1>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-6 text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        {(['profile', 'sessions', 'privacy'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors capitalize ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input id="name" type="text" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
                placeholder="Your name" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input id="email" type="email" value={profile.email} disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">Language Preference</label>
              <select id="language" value={profile.language} onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="pt">Portuguese</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
              </select>
            </div>
            <button type="submit" disabled={saving}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Active Sessions</h2>
              <p className="text-sm text-gray-500 mt-1">Manage your active login sessions</p>
            </div>
            {sessions.length > 1 && (
              <button
                onClick={handleLogoutAll}
                disabled={loggingOutAll}
                className="text-sm text-red-600 font-medium hover:text-red-700 disabled:opacity-50"
              >
                {loggingOutAll ? 'Revoking...' : 'Logout All Other Sessions'}
              </button>
            )}
          </div>
          {sessions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No active sessions found.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sessions.map((session) => (
                <div key={session.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${session.is_current ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div>
                      <p className="font-medium text-gray-900">
                        {parseUserAgent(session.user_agent)}
                        {session.is_current && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Current</span>}
                      </p>
                      <p className="text-sm text-gray-500">
                        IP: {session.ip_address || 'Unknown'} &middot; Last active: {session.last_active ? new Date(session.last_active).toLocaleString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                  {!session.is_current && (
                    <button
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={revokingId === session.id}
                      className="text-sm text-red-600 font-medium hover:text-red-700 disabled:opacity-50"
                    >
                      {revokingId === session.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Privacy Tab */}
      {activeTab === 'privacy' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Privacy Settings</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium text-gray-900">Profile Visibility</p>
                <p className="text-sm text-gray-500">Allow other users to see your profile</p>
              </div>
              <input type="checkbox" checked={profile.privacy_profile_visible}
                onChange={(e) => setProfile({ ...profile, privacy_profile_visible: e.target.checked })}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
            </label>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium text-gray-900">Email Visibility</p>
                <p className="text-sm text-gray-500">Show your email to other users</p>
              </div>
              <input type="checkbox" checked={profile.privacy_email_visible}
                onChange={(e) => setProfile({ ...profile, privacy_email_visible: e.target.checked })}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
            </label>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium text-gray-900">Activity Tracking</p>
                <p className="text-sm text-gray-500">Allow us to track activity for analytics</p>
              </div>
              <input type="checkbox" checked={profile.privacy_activity_tracking}
                onChange={(e) => setProfile({ ...profile, privacy_activity_tracking: e.target.checked })}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
            </label>
            <button onClick={handleSavePrivacy} disabled={saving}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Privacy Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
