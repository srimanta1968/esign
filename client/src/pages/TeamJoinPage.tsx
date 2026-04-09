import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface InviteInfo {
  team_name: string;
  invited_by_name: string;
  email: string;
  expires_at: string;
}

function TeamJoinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user, loading: authLoading, logout } = useAuth();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<boolean>(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }

    const fetchInvite = async (): Promise<void> => {
      const response = await ApiService.get<any>(`/teams/join/${token}`);
      const inviteData = response.data?.invite || (response as any).invite;
      if (response.success && inviteData) {
        const inv = inviteData as InviteInfo;
        if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
          setError('This invite has expired. Please ask your team admin to send a new one.');
        } else {
          setInvite(inv);
        }
      } else {
        setError(response.error || 'This invite link is invalid or has expired.');
      }
      setLoading(false);
    };

    fetchInvite();
  }, [token]);

  const handleAccept = async (): Promise<void> => {
    if (!token) return;
    setJoining(true);
    const response = await ApiService.post(`/teams/join/${token}`, {});
    setJoining(false);
    if (response.success) {
      navigate('/team');
    } else {
      setError(response.error || 'Failed to join team. The invite may have expired.');
    }
  };

  const handleLogoutAndSwitch = (): void => {
    logout();
    navigate(`/login?returnUrl=/team/join/${token}&email=${encodeURIComponent(invite?.email || '')}`);
  };

  if (loading || authLoading) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 mt-4">Loading invite...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.832c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Invalid Invite</h1>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-block bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  // Not logged in → show options to register or login
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="mx-auto w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">
            You've been invited to join{' '}
            <span className="text-indigo-600">{invite.team_name}</span>
          </h1>
          <p className="text-sm text-gray-500 mb-1">
            Invited by <span className="font-medium text-gray-700">{invite.invited_by_name || 'a team admin'}</span>
          </p>
          <p className="text-xs text-gray-400 mb-6">
            Invitation for <strong>{invite.email}</strong>
          </p>

          <p className="text-sm text-gray-600 mb-4">Sign in or create an account to accept this invitation.</p>

          <div className="flex flex-col gap-3">
            <Link
              to={`/login?returnUrl=/team/join/${token}&email=${encodeURIComponent(invite.email)}`}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors block text-center"
            >
              Log In as {invite.email}
            </Link>
            <Link
              to={`/register?returnUrl=/team/join/${token}&email=${encodeURIComponent(invite.email)}`}
              className="w-full border border-indigo-600 text-indigo-600 py-2.5 rounded-lg font-semibold text-sm hover:bg-indigo-50 transition-colors block text-center"
            >
              Create Account
            </Link>
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 transition-colors mt-2">
              Decline
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Logged in but as a different user than the invite email
  const isCorrectUser = user?.email?.toLowerCase() === invite.email.toLowerCase();

  if (!isCorrectUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.832c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h1 className="text-lg font-bold text-gray-900 mb-2">Wrong Account</h1>
          <p className="text-sm text-gray-500 mb-2">
            This invitation is for <strong>{invite.email}</strong>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            You are currently logged in as <strong>{user?.email}</strong>. Please switch to the correct account.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleLogoutAndSwitch}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors"
            >
              Switch to {invite.email}
            </button>
            <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Correct user — show accept
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="mx-auto w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          You've been invited to join{' '}
          <span className="text-indigo-600">{invite.team_name}</span>
        </h1>
        <p className="text-sm text-gray-500 mb-1">
          Invited by <span className="font-medium text-gray-700">{invite.invited_by_name || 'a team admin'}</span>
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Accepting as <strong>{user?.email}</strong>
          {invite.expires_at && (
            <> &middot; Expires {new Date(invite.expires_at).toLocaleDateString()}</>
          )}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleAccept}
            disabled={joining}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {joining ? 'Joining...' : 'Accept Invite'}
          </button>
          <Link
            to="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Decline
          </Link>
        </div>
      </div>
    </div>
  );
}

export default TeamJoinPage;
