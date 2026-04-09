import { Router, Response, RequestHandler } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { TeamService } from '../services/teamService';
import { DataService } from '../services/DataService';

const router: Router = Router();

// POST /api/teams - Create a team
router.post('/', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { name, plan } = req.body as { name: string; plan?: 'team' | 'scale' };

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: 'Team name is required' });
      return;
    }

    // Check if user already has a team
    const existing = await TeamService.getTeamByUser(userId);
    if (existing) {
      res.status(400).json({ success: false, error: 'You are already a member of a team' });
      return;
    }

    const team = await TeamService.createTeam(userId, name.trim(), plan || 'team');
    res.status(201).json({ success: true, team });
  } catch (error: unknown) {
    console.error('Create team error:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to create team' });
  }
}) as RequestHandler);

// GET /api/teams/mine - Get the current user's team
router.get('/mine', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const team = await TeamService.getTeamByUser(userId);

    if (!team) {
      res.status(404).json({ success: false, error: 'You are not a member of any team' });
      return;
    }

    res.json({ success: true, team });
  } catch (error: unknown) {
    console.error('Get my team error:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: 'Failed to fetch team' });
  }
}) as RequestHandler);

// GET /api/teams/join/:token - Get invite info (public, no auth)
router.get('/join/:token', (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const invite = await TeamService.getInviteByToken(token);

    if (!invite) {
      res.status(404).json({ success: false, error: 'Invalid invite link' });
      return;
    }

    if (invite.status !== 'pending') {
      res.status(400).json({ success: false, error: 'This invite has already been used' });
      return;
    }

    if (new Date(invite.expires_at) < new Date()) {
      res.status(400).json({ success: false, error: 'This invite has expired' });
      return;
    }

    res.json({
      success: true,
      invite: {
        team_name: invite.team_name,
        invited_by_name: invite.invited_by_name,
        email: invite.email,
        expires_at: invite.expires_at,
      },
    });
  } catch (error: unknown) {
    console.error('Get invite error:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: 'Failed to fetch invite' });
  }
}) as RequestHandler);

// POST /api/teams/join/:token - Accept invite (auth required)
router.post('/join/:token', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { token } = req.params;

    const team = await TeamService.acceptInvite(token, userId);
    res.json({ success: true, team });
  } catch (error: unknown) {
    console.error('Accept invite error:', error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : 'Failed to accept invite';
    const status = message.includes('Invalid') || message.includes('expired') || message.includes('already') ? 400 : 500;
    res.status(status).json({ success: false, error: message });
  }
}) as RequestHandler);

// GET /api/teams/:id - Get team details + members (must be a member)
router.get('/:id', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const teamId = req.params.id;

    // Check membership
    const membership = await DataService.queryOne(
      `SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );

    if (!membership) {
      res.status(403).json({ success: false, error: 'You are not a member of this team' });
      return;
    }

    const team = await TeamService.getTeam(teamId);
    if (!team) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    res.json({ success: true, team });
  } catch (error: unknown) {
    console.error('Get team error:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: 'Failed to fetch team' });
  }
}) as RequestHandler);

// POST /api/teams/:id/invite - Invite members (owner/admin only)
router.post('/:id/invite', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const teamId = req.params.id;
    const { emails } = req.body as { emails: string[] };

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      res.status(400).json({ success: false, error: 'emails array is required' });
      return;
    }

    // Check requester is owner or admin
    const membership = await DataService.queryOne<{ role: string }>(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Only team owner or admin can invite members' });
      return;
    }

    const results = await TeamService.inviteMembers(teamId, emails, userId);
    res.json({ success: true, results });
  } catch (error: unknown) {
    console.error('Invite error:', error instanceof Error ? error.message : error);
    res.status(500).json({ success: false, error: 'Failed to send invites' });
  }
}) as RequestHandler);

// DELETE /api/teams/:id/invites/:inviteId - Delete a pending/expired invite
router.delete('/:id/invites/:inviteId', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id: teamId, inviteId } = req.params;

    // Check requester is owner or admin
    const membership = await DataService.queryOne<{ role: string }>(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Only owner or admin can delete invites' });
      return;
    }

    // Only allow deleting pending or expired invites, not accepted
    const result = await DataService.query(
      `DELETE FROM team_invites WHERE id = $1 AND team_id = $2 AND status != 'accepted'`,
      [inviteId, teamId]
    );

    if (result.rowCount === 0) {
      res.status(400).json({ success: false, error: 'Cannot delete this invite (already accepted or not found)' });
      return;
    }

    res.json({ success: true, message: 'Invite deleted' });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: 'Failed to delete invite' });
  }
}) as RequestHandler);

// DELETE /api/teams/:id/members/:userId - Remove member (owner/admin only)
router.delete('/:id/members/:userId', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.userId!;
    const teamId = req.params.id;
    const targetUserId = req.params.userId;

    await TeamService.removeMember(teamId, targetUserId, requesterId);
    res.json({ success: true, message: 'Member removed' });
  } catch (error: unknown) {
    console.error('Remove member error:', error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : 'Failed to remove member';
    const status = message.includes('Only') || message.includes('Cannot') ? 403 : 500;
    res.status(status).json({ success: false, error: message });
  }
}) as RequestHandler);

// PATCH /api/teams/:id/members/:userId - Update role (owner only)
router.patch('/:id/members/:userId', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.userId!;
    const teamId = req.params.id;
    const targetUserId = req.params.userId;
    const { role } = req.body as { role: string };

    if (!role) {
      res.status(400).json({ success: false, error: 'role is required' });
      return;
    }

    await TeamService.updateMemberRole(teamId, targetUserId, role, requesterId);
    res.json({ success: true, message: 'Role updated' });
  } catch (error: unknown) {
    console.error('Update role error:', error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : 'Failed to update role';
    const status = message.includes('Only') || message.includes('Cannot') || message.includes('Invalid') ? 403 : 500;
    res.status(status).json({ success: false, error: message });
  }
}) as RequestHandler);

// POST /api/teams/:id/leave - Leave team (not owner)
router.post('/:id/leave', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const teamId = req.params.id;

    await TeamService.leaveTeam(teamId, userId);
    res.json({ success: true, message: 'You have left the team' });
  } catch (error: unknown) {
    console.error('Leave team error:', error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : 'Failed to leave team';
    const status = message.includes('owner') ? 403 : 500;
    res.status(status).json({ success: false, error: message });
  }
}) as RequestHandler);

// DELETE /api/teams/:id - Delete team (owner only)
router.delete('/:id', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const teamId = req.params.id;

    await TeamService.deleteTeam(teamId, userId);
    res.json({ success: true, message: 'Team deleted' });
  } catch (error: unknown) {
    console.error('Delete team error:', error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : 'Failed to delete team';
    const status = message.includes('Only') ? 403 : 500;
    res.status(status).json({ success: false, error: message });
  }
}) as RequestHandler);

export default router;
