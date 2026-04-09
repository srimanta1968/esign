import crypto from 'crypto';
import { DataService } from './DataService';
import { EmailService } from './emailService';
import { TEAM_MEMBER_LIMITS } from './stripeService';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export class TeamService {
  /**
   * Get the owner's plan to check team eligibility.
   */
  private static async getOwnerPlan(userId: string): Promise<string> {
    const user = await DataService.queryOne<{ plan: string }>('SELECT plan FROM users WHERE id = $1', [userId]);
    return user?.plan || 'free';
  }

  /**
   * Get current team member count.
   */
  private static async getMemberCount(teamId: string): Promise<number> {
    const result = await DataService.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM team_members WHERE team_id = $1', [teamId]);
    return parseInt(result?.count || '0', 10);
  }

  /**
   * Create a new team, add the owner as a member, and update user.team_id.
   */
  static async createTeam(
    ownerId: string,
    name: string,
    plan: 'team' | 'scale' = 'team'
  ) {
    // Check if user's subscription supports teams
    const ownerPlan = await TeamService.getOwnerPlan(ownerId);
    const memberLimit = TEAM_MEMBER_LIMITS[ownerPlan] || 0;
    if (memberLimit === 0) {
      throw new Error(`Your current plan (${ownerPlan}) does not support teams. Please upgrade to a Team or Scale plan first.`);
    }

    // Check if user already has a team
    const existingTeam = await DataService.queryOne<{ id: string }>(
      'SELECT id FROM team_members WHERE user_id = $1', [ownerId]
    );
    if (existingTeam) throw new Error('You are already a member of a team');

    const documentLimit = plan === 'scale' ? 1000 : 200;

    const team = await DataService.queryOne<{
      id: string;
      name: string;
      owner_id: string;
      plan: string;
      document_limit: number;
      created_at: string;
    }>(
      `INSERT INTO teams (name, owner_id, plan, document_limit)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, owner_id, plan, document_limit, created_at`,
      [name, ownerId, plan, documentLimit]
    );

    if (!team) throw new Error('Failed to create team');

    // Add owner as a member with role='owner'
    await DataService.query(
      `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [team.id, ownerId]
    );

    // Update user's team_id
    await DataService.query(
      `UPDATE users SET team_id = $1 WHERE id = $2`,
      [team.id, ownerId]
    );

    // Return team with members
    const members = await DataService.queryAll<{
      id: string;
      user_id: string;
      role: string;
      joined_at: string;
      name: string;
      email: string;
    }>(
      `SELECT tm.id, tm.user_id, tm.role, tm.joined_at, u.name, u.email
       FROM team_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1`,
      [team.id]
    );

    return { ...team, members };
  }

  /**
   * Get a team by ID with its members.
   */
  static async getTeam(teamId: string) {
    const team = await DataService.queryOne<{
      id: string;
      name: string;
      owner_id: string;
      plan: string;
      document_limit: number;
      stripe_subscription_id: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, owner_id, plan, document_limit, stripe_subscription_id, created_at, updated_at
       FROM teams WHERE id = $1`,
      [teamId]
    );

    if (!team) return null;

    const members = await DataService.queryAll<{
      id: string;
      user_id: string;
      role: string;
      joined_at: string;
      name: string;
      email: string;
    }>(
      `SELECT tm.id, tm.user_id, tm.role, tm.joined_at, u.name, u.email
       FROM team_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY tm.role = 'owner' DESC, tm.joined_at ASC`,
      [teamId]
    );

    const pending_invites = await DataService.queryAll<{
      id: string;
      email: string;
      status: string;
      created_at: string;
      expires_at: string;
    }>(
      `SELECT id, email,
              CASE WHEN status = 'pending' AND expires_at <= NOW() THEN 'expired' ELSE status END as status,
              created_at, expires_at
       FROM team_invites WHERE team_id = $1 AND status != 'accepted'
       ORDER BY created_at DESC`,
      [teamId]
    );

    return { ...team, members, pending_invites };
  }

  /**
   * Get a user's team via team_members join.
   */
  static async getTeamByUser(userId: string) {
    const membership = await DataService.queryOne<{ team_id: string }>(
      `SELECT team_id FROM team_members WHERE user_id = $1`,
      [userId]
    );

    if (!membership) return null;

    return TeamService.getTeam(membership.team_id);
  }

  /**
   * Invite members to a team by email.
   */
  static async inviteMembers(teamId: string, emails: string[], invitedBy: string) {
    const team = await DataService.queryOne<{ name: string; owner_id: string }>(
      `SELECT name, owner_id FROM teams WHERE id = $1`,
      [teamId]
    );
    const teamName = team?.name || 'your team';

    // Check member limit
    const ownerPlan = team?.owner_id ? await TeamService.getOwnerPlan(team.owner_id) : 'free';
    const memberLimit = TEAM_MEMBER_LIMITS[ownerPlan] || 0;
    const currentCount = await TeamService.getMemberCount(teamId);
    const pendingCount = await DataService.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM team_invites WHERE team_id = $1 AND status = 'pending' AND expires_at > NOW()`,
      [teamId]
    );
    const totalPending = parseInt(pendingCount?.count || '0', 10);

    if (currentCount + totalPending + emails.length > memberLimit) {
      const available = Math.max(0, memberLimit - currentCount - totalPending);
      throw new Error(`Team member limit reached. Your ${ownerPlan} plan supports up to ${memberLimit} members. You have ${currentCount} members and ${totalPending} pending invites. You can invite ${available} more.`);
    }

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const email of emails) {
      try {
        // Check if already a team member
        const alreadyMember = await DataService.queryOne<{ id: string }>(
          `SELECT tm.id FROM team_members tm JOIN users u ON u.id = tm.user_id
           WHERE tm.team_id = $1 AND u.email = $2`,
          [teamId, email]
        );
        if (alreadyMember) {
          results.push({ email, success: false, error: 'Already a team member' });
          continue;
        }

        // Check for existing pending invite — reuse token and resend
        const existing = await DataService.queryOne<{ id: string; token: string }>(
          `SELECT id, token FROM team_invites WHERE team_id = $1 AND email = $2 AND status = 'pending'`,
          [teamId, email]
        );

        let token: string;
        if (existing) {
          // Reset expiry and reuse
          token = existing.token;
          await DataService.query(
            `UPDATE team_invites SET expires_at = NOW() + INTERVAL '7 days', created_at = NOW() WHERE id = $1`,
            [existing.id]
          );
        } else {
          // Create new invite
          token = crypto.randomBytes(32).toString('hex');
          await DataService.query(
            `INSERT INTO team_invites (team_id, email, invited_by, token)
             VALUES ($1, $2, $3, $4)`,
            [teamId, email, invitedBy, token]
          );
        }

        const joinLink = `${FRONTEND_URL}/team/join/${token}`;
        const subject = `You've been invited to join ${teamName} on eDocSign`;
        const body = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Team Invitation</h2>
            <p>You've been invited to join <strong>${teamName}</strong> on eDocSign.</p>
            <p>Click the button below to accept the invitation:</p>
            <p style="margin: 24px 0;">
              <a href="${joinLink}"
                 style="display: inline-block; background-color: #1a56db; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
                Join Team
              </a>
            </p>
            <p style="color: #6b7280; font-size: 13px;">This invitation expires in 7 days.</p>
            <p style="color: #6b7280; font-size: 13px;">Or copy this link: ${joinLink}</p>
          </div>
        `;

        await EmailService.send(email, subject, body);
        results.push({ email, success: true });
      } catch (error: unknown) {
        results.push({
          email,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send invite',
        });
      }
    }

    return results;
  }

  /**
   * Accept a team invite by token.
   */
  static async acceptInvite(token: string, userId: string) {
    const invite = await DataService.queryOne<{
      id: string;
      team_id: string;
      email: string;
      status: string;
      expires_at: string;
    }>(
      `SELECT id, team_id, email, status, expires_at FROM team_invites WHERE token = $1`,
      [token]
    );

    if (!invite) throw new Error('Invalid invite token');
    if (invite.status !== 'pending') throw new Error('Invite has already been used');
    if (new Date(invite.expires_at) < new Date()) throw new Error('Invite has expired');

    // Verify the accepting user's email matches the invite
    const acceptingUser = await DataService.queryOne<{ email: string }>(
      'SELECT email FROM users WHERE id = $1', [userId]
    );
    if (!acceptingUser) throw new Error('User not found');
    if (acceptingUser.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error(`This invitation is for ${invite.email}. You are logged in as ${acceptingUser.email}.`);
    }

    // Add user to team_members
    await DataService.query(
      `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'member')
       ON CONFLICT (team_id, user_id) DO NOTHING`,
      [invite.team_id, userId]
    );

    // Update user's team_id
    await DataService.query(
      `UPDATE users SET team_id = $1 WHERE id = $2`,
      [invite.team_id, userId]
    );

    // Mark invite as accepted
    await DataService.query(
      `UPDATE team_invites SET status = 'accepted' WHERE id = $1`,
      [invite.id]
    );

    return TeamService.getTeam(invite.team_id);
  }

  /**
   * Get invite details by token (for the join page).
   */
  static async getInviteByToken(token: string) {
    const invite = await DataService.queryOne<{
      id: string;
      team_id: string;
      email: string;
      status: string;
      expires_at: string;
      team_name: string;
      invited_by_name: string;
    }>(
      `SELECT ti.id, ti.team_id, ti.email, ti.status, ti.expires_at, t.name AS team_name,
              COALESCE(u.name, u.email) AS invited_by_name
       FROM team_invites ti
       JOIN teams t ON t.id = ti.team_id
       LEFT JOIN users u ON u.id = ti.invited_by
       WHERE ti.token = $1`,
      [token]
    );

    return invite;
  }

  /**
   * Remove a member from a team. Only owner/admin can remove. Can't remove the owner.
   */
  static async removeMember(teamId: string, userId: string, requesterId: string) {
    // Check requester's role
    const requester = await DataService.queryOne<{ role: string }>(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, requesterId]
    );

    if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
      throw new Error('Only team owner or admin can remove members');
    }

    // Check target's role - can't remove the owner
    const target = await DataService.queryOne<{ role: string }>(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );

    if (!target) throw new Error('User is not a member of this team');
    if (target.role === 'owner') throw new Error('Cannot remove the team owner');

    // Remove from team_members
    await DataService.query(
      `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );

    // Clear user's team_id
    await DataService.query(
      `UPDATE users SET team_id = NULL WHERE id = $1`,
      [userId]
    );
  }

  /**
   * Update a member's role. Only the owner can change roles. Can't change own role.
   */
  static async updateMemberRole(
    teamId: string,
    userId: string,
    newRole: string,
    requesterId: string
  ) {
    // Only owner can change roles
    const requester = await DataService.queryOne<{ role: string }>(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, requesterId]
    );

    if (!requester || requester.role !== 'owner') {
      throw new Error('Only the team owner can change member roles');
    }

    // Can't change own role
    if (userId === requesterId) {
      throw new Error('Cannot change your own role');
    }

    // Validate role
    if (!['admin', 'member'].includes(newRole)) {
      throw new Error('Invalid role. Must be admin or member');
    }

    // Check target exists
    const target = await DataService.queryOne<{ role: string }>(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );

    if (!target) throw new Error('User is not a member of this team');

    await DataService.query(
      `UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3`,
      [newRole, teamId, userId]
    );
  }

  /**
   * Member leaves the team. Owner can't leave.
   */
  static async leaveTeam(teamId: string, userId: string) {
    const member = await DataService.queryOne<{ role: string }>(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );

    if (!member) throw new Error('You are not a member of this team');
    if (member.role === 'owner') throw new Error('Team owner cannot leave the team. Transfer ownership or delete the team instead.');

    await DataService.query(
      `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );

    await DataService.query(
      `UPDATE users SET team_id = NULL WHERE id = $1`,
      [userId]
    );
  }

  /**
   * Delete a team. Only the owner can delete.
   */
  static async deleteTeam(teamId: string, requesterId: string) {
    const requester = await DataService.queryOne<{ role: string }>(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, requesterId]
    );

    if (!requester || requester.role !== 'owner') {
      throw new Error('Only the team owner can delete the team');
    }

    // Clear team_id for all team members
    await DataService.query(
      `UPDATE users SET team_id = NULL WHERE team_id = $1`,
      [teamId]
    );

    // Delete the team (cascades to team_members and team_invites)
    await DataService.query(
      `DELETE FROM teams WHERE id = $1`,
      [teamId]
    );
  }
}

export default TeamService;
