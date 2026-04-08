import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config/env';
import { DataService } from './DataService';
import { Session, SessionResponse } from '../types/session';
import { User } from '../types/user';

const jwtSignOptions: SignOptions = { expiresIn: config.jwt.expiresIn as any };

/**
 * SessionService handles session management (refresh tokens, active sessions).
 */
export class SessionService {
  /**
   * Create a new session record.
   */
  static async createSession(
    userId: string,
    token: string,
    ipAddress: string,
    userAgent: string,
    expiresAt: Date
  ): Promise<SessionResponse> {
    try {
      const session = await DataService.queryOne<Session>(
        'INSERT INTO sessions (user_id, token, ip_address, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id, ip_address, user_agent, expires_at, created_at',
        [userId, token, ipAddress, userAgent, expiresAt]
      );

      if (!session) {
        throw new Error('Failed to create session');
      }

      return {
        id: session.id,
        user_id: session.user_id,
        ip_address: session.ip_address,
        user_agent: session.user_agent,
        expires_at: session.expires_at.toISOString(),
        created_at: session.created_at.toISOString(),
      };
    } catch (error: unknown) {
      throw new Error(`Session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh a JWT token - issue a new token and create a new session.
   */
  static async refreshToken(
    currentToken: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ token: string; session: SessionResponse }> {
    try {
      // Verify the current token (allow expired tokens for refresh)
      let decoded: any;
      try {
        decoded = jwt.verify(currentToken, config.jwt.secret);
      } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
          decoded = jwt.decode(currentToken);
        } else {
          throw new Error('Invalid token');
        }
      }

      if (!decoded || !decoded.userId) {
        throw new Error('Invalid token');
      }

      // Verify user still exists
      const user = await DataService.queryOne<User>(
        'SELECT id, email, role FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (!user) {
        throw new Error('User not found');
      }

      // Generate new token
      const newToken: string = jwt.sign(
        { userId: user.id, email: user.email, role: user.role || 'user' },
        config.jwt.secret,
        jwtSignOptions
      );

      // Calculate expiry
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create new session
      const session = await SessionService.createSession(
        user.id,
        newToken,
        ipAddress,
        userAgent,
        expiresAt
      );

      return { token: newToken, session };
    } catch (error: unknown) {
      if (error instanceof Error && (
        error.message === 'Invalid token' || error.message === 'User not found'
      )) {
        throw error;
      }
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all active sessions for a user.
   */
  static async getActiveSessions(userId: string): Promise<SessionResponse[]> {
    try {
      const sessions = await DataService.queryAll<Session>(
        'SELECT id, user_id, ip_address, user_agent, expires_at, created_at FROM sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC',
        [userId]
      );

      return sessions.map((s: Session): SessionResponse => ({
        id: s.id,
        user_id: s.user_id,
        ip_address: s.ip_address,
        user_agent: s.user_agent,
        expires_at: s.expires_at.toISOString(),
        created_at: s.created_at.toISOString(),
      }));
    } catch (error: unknown) {
      throw new Error(`Failed to get sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Revoke a session by ID (must belong to the user).
   */
  static async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      const result = await DataService.query(
        'DELETE FROM sessions WHERE id = $1 AND user_id = $2',
        [sessionId, userId]
      );

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error: unknown) {
      throw new Error(`Failed to revoke session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default SessionService;
