import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

interface PendingInvite {
  id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string;
}

interface Team {
  id: string;
  name: string;
  plan: string;
  document_limit: number;
  owner_id: string;
  members: TeamMember[];
  pending_invites?: PendingInvite[];
  documents_this_month?: number;
}

type ViewState = 'loading' | 'no-team' | 'has-team';

const PLAN_BADGE_STYLES: Record<string, string> = {
  team: 'bg-blue-100 text-blue-700',
  scale: 'bg-purple-100 text-purple-700',
  free: 'bg-gray-100 text-gray-700',
};

const ROLE_BADGE_STYLES: Record<string, string> = {
  owner: 'bg-yellow-100 text-yellow-700',
  admin: 'bg-indigo-100 text-indigo-700',
  member: 'bg-gray-100 text-gray-700',
};

function TeamPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [viewState, setViewState] = useState<ViewState>('loading');
  const [team, setTeam] = useState<Team | null>(null);

  // Create team form
  const [teamName, setTeamName] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);

  // Invite form
  const [inviteEmails, setInviteEmails] = useState<string>('');
  const [inviting, setInviting] = useState<boolean>(false);

  // UI
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTeam = useCallback(async (): Promise<void> => {
    const response = await ApiService.get<any>('/teams/mine');
    const teamData = response.data?.team || (response as any).team;
    if (response.success && teamData) {
      setTeam(teamData);
      setViewState('has-team');
    } else {
      setTeam(null);
      setViewState('no-team');
    }
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/login?returnUrl=/team');
      return;
    }
    fetchTeam();
  }, [user, navigate, fetchTeam]);

  const handleCreateTeam = async (): Promise<void> => {
    if (!teamName.trim()) return;
    setCreating(true);
    const response = await ApiService.post('/teams', { name: teamName.trim() });
    setCreating(false);
    if (response.success) {
      showToast('Team created successfully!');
      await fetchTeam();
    } else {
      showToast(response.error || 'Failed to create team', 'error');
    }
  };

  const handleInvite = async (): Promise<void> => {
    const emails = inviteEmails
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
    if (emails.length === 0 || !team) return;
    setInviting(true);
    const response = await ApiService.post(`/teams/${team.id}/invite`, { emails });
    setInviting(false);
    if (response.success) {
      setInviteEmails('');
      showToast(`Invite${emails.length > 1 ? 's' : ''} sent successfully!`);
      await fetchTeam();
    } else {
      showToast(response.error || 'Failed to send invite', 'error');
    }
  };

  const handleRemoveMember = async (memberId: string): Promise<void> => {
    if (!team) return;
    setActionLoading(memberId);
    const response = await ApiService.delete(`/teams/${team.id}/members/${memberId}`);
    setActionLoading(null);
    if (response.success) {
      showToast('Member removed');
      await fetchTeam();
    } else {
      showToast(response.error || 'Failed to remove member', 'error');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string): Promise<void> => {
    if (!team) return;
    setActionLoading(memberId);
    const response = await ApiService.patch(`/teams/${team.id}/members/${memberId}`, { role: newRole });
    setActionLoading(null);
    if (response.success) {
      showToast('Role updated');
      await fetchTeam();
    } else {
      showToast(response.error || 'Failed to update role', 'error');
    }
  };

  const handleLeaveTeam = async (): Promise<void> => {
    if (!team) return;
    setActionLoading('leave');
    const response = await ApiService.post(`/teams/${team.id}/leave`, {});
    setActionLoading(null);
    if (response.success) {
      showToast('You have left the team');
      setTeam(null);
      setViewState('no-team');
    } else {
      showToast(response.error || 'Failed to leave team', 'error');
    }
  };

  const handleDeleteTeam = async (): Promise<void> => {
    if (!team) return;
    setActionLoading('delete');
    const response = await ApiService.delete(`/teams/${team.id}`);
    setActionLoading(null);
    setShowDeleteConfirm(false);
    if (response.success) {
      showToast('Team deleted');
      setTeam(null);
      setViewState('no-team');
    } else {
      showToast(response.error || 'Failed to delete team', 'error');
    }
  };

  const currentMember = team?.members.find((m) => m.user_id === user?.id);
  const currentRole = currentMember?.role || 'member';
  const isOwner = currentRole === 'owner';
  const isAdminOrOwner = currentRole === 'owner' || currentRole === 'admin';
  const documentsUsed = team?.documents_this_month || 0;
  const documentLimit = team?.document_limit || 0;
  const usagePercent = documentLimit > 0 ? Math.min(100, Math.round((documentsUsed / documentLimit) * 100)) : 0;

  if (viewState === 'loading') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 mt-4">Loading team...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] rounded-lg shadow-xl p-4 max-w-sm text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      {/* State 1: No Team */}
      {viewState === 'no-team' && (
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Create a Team</h1>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <button
              onClick={handleCreateTeam}
              disabled={creating || !teamName.trim()}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? 'Creating...' : 'Create Team'}
            </button>
            <p className="text-xs text-gray-500 text-center mt-3">
              After creating your team, upgrade to a <Link to="/pricing" className="text-indigo-600 font-medium">Team or Scale plan</Link> to unlock shared document quotas and invite members.
            </p>
          </div>
        </div>
      )}

      {/* State 2: Has Team */}
      {viewState === 'has-team' && team && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${PLAN_BADGE_STYLES[team.plan] || PLAN_BADGE_STYLES.free}`}>
                {team.plan}
              </span>
            </div>
            <span className="text-sm text-gray-500">{team.members.length} member{team.members.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Usage Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Team Usage: {documentsUsed} of {documentLimit} documents this month
            </h2>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-yellow-500' : 'bg-indigo-600'}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{usagePercent}% used</p>
          </div>

          {/* Members Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Members</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Joined</th>
                    {isAdminOrOwner && <th className="px-5 py-3">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {team.members.map((member) => {
                    const isSelf = member.user_id === user?.id;
                    const canRemove =
                      !isSelf &&
                      ((isOwner) || (currentRole === 'admin' && member.role === 'member'));
                    const canChangeRole = isOwner && !isSelf && member.role !== 'owner';

                    return (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {member.name}
                          {isSelf && <span className="text-xs text-gray-400 ml-1">(you)</span>}
                        </td>
                        <td className="px-5 py-3 text-gray-600">{member.email}</td>
                        <td className="px-5 py-3">
                          {canChangeRole ? (
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value)}
                              disabled={actionLoading === member.id}
                              className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${ROLE_BADGE_STYLES[member.role] || ROLE_BADGE_STYLES.member}`}>
                              {member.role}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-500">
                          {new Date(member.joined_at).toLocaleDateString()}
                        </td>
                        {isAdminOrOwner && (
                          <td className="px-5 py-3">
                            {canRemove && (
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                disabled={actionLoading === member.id}
                                className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-50"
                              >
                                {actionLoading === member.id ? 'Removing...' : 'Remove'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invite Section (owner/admin only) */}
          {isAdminOrOwner && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Invite Members</h2>
              <p className="text-xs text-gray-500 mb-3">Enter one or more email addresses, separated by commas.</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                  placeholder="jane@example.com, john@example.com"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
                />
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmails.trim()}
                  className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {inviting ? 'Sending...' : 'Invite'}
                </button>
              </div>
            </div>
          )}

          {/* Pending Invites */}
          {isAdminOrOwner && team.pending_invites && team.pending_invites.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Pending Invites</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Email</th>
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Sent</th>
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Expires</th>
                    <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {team.pending_invites.map((invite) => (
                    <tr key={invite.id}>
                      <td className="py-2.5 text-gray-700">{invite.email}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          invite.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          invite.status === 'expired' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {invite.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-400">{new Date(invite.created_at).toLocaleDateString()}</td>
                      <td className="py-2.5 text-gray-400">{new Date(invite.expires_at).toLocaleDateString()}</td>
                      <td className="py-2.5 text-right space-x-2">
                        {invite.status === 'pending' && (
                          <button
                            onClick={async () => {
                              const res = await ApiService.post(`/teams/${team.id}/invite`, { emails: [invite.email] });
                              if (res.success) {
                                showToast('Invite resent');
                                await fetchTeam();
                              } else {
                                showToast(res.error || 'Failed to resend', 'error');
                              }
                            }}
                            className="text-indigo-600 hover:text-indigo-700 text-xs font-medium"
                          >
                            Resend
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            const res = await ApiService.delete(`/teams/${team.id}/invites/${invite.id}`);
                            if (res.success) {
                              showToast('Invite deleted');
                              await fetchTeam();
                            } else {
                              showToast(res.error || 'Failed to delete', 'error');
                            }
                          }}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Danger Zone */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Danger Zone</h2>
            <div className="flex items-center gap-3">
              {!isOwner && (
                <button
                  onClick={handleLeaveTeam}
                  disabled={actionLoading === 'leave'}
                  className="bg-white border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === 'leave' ? 'Leaving...' : 'Leave Team'}
                </button>
              )}
              {isOwner && (
                <>
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-red-600 font-medium">Are you sure? This cannot be undone.</span>
                      <button
                        onClick={handleDeleteTeam}
                        disabled={actionLoading === 'delete'}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === 'delete' ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="bg-white border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors"
                    >
                      Delete Team
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamPage;
