import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { DataService } from './DataService';
import { config } from '../config/env';
import { AccessStatus, UserRole } from '../types/user';

/** Admin sessions expire far sooner than the 7-day user token. */
const ADMIN_TOKEN_TTL = '2h';

/** A step-up elevation is deliberately short — it covers one burst of work. */
const STEP_UP_TOKEN_TTL = '15m';

/** Claims carried by an admin session token. */
export interface AdminTokenClaims {
  userId: string;
  email: string;
  role: UserRole;
  /** Marks the token as belonging to the admin portal, not the customer app. */
  scope: 'admin';
  /** True only after the administrator has re-confirmed their password. */
  stepUp: boolean;
}

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  role: UserRole;
  access_status: AccessStatus | null;
}

/**
 * Authentication for the platform admin portal.
 *
 * Deliberately separate from AuthService: admin sessions are shorter-lived,
 * carry an explicit `scope: 'admin'` claim, and require a step-up
 * re-authentication before any customer account can be modified.
 */
export class AdminAuthService {
  /**
   * Sign an admin session token.
   */
  private static signToken(admin: AdminUserRow, stepUp: boolean): string {
    const claims: AdminTokenClaims = {
      userId: admin.id,
      email: admin.email,
      role: admin.role,
      scope: 'admin',
      stepUp,
    };

    return jwt.sign(claims, config.jwt.secret, {
      expiresIn: stepUp ? STEP_UP_TOKEN_TTL : ADMIN_TOKEN_TTL,
    } as jwt.SignOptions);
  }

  /**
   * Reject a row that is not a usable platform admin — wrong role, or access
   * suspended/revoked.
   */
  private static usableAdmin(admin: AdminUserRow | null): AdminUserRow | null {
    if (!admin || admin.role !== 'platform_admin') {
      return null;
    }

    if (admin.access_status && admin.access_status !== 'active') {
      return null;
    }

    return admin;
  }

  /**
   * Look up an administrator by email, or null when they are not a usable
   * platform admin.
   */
  private static async findActiveAdminByEmail(email: string): Promise<AdminUserRow | null> {
    const admin = await DataService.queryOne<AdminUserRow>(
      'SELECT id, email, name, password_hash, role, access_status FROM users WHERE email = $1',
      [email]
    );

    return AdminAuthService.usableAdmin(admin);
  }

  /**
   * Look up an administrator by id, or null when they are not a usable
   * platform admin.
   */
  private static async findActiveAdminById(id: string): Promise<AdminUserRow | null> {
    const admin = await DataService.queryOne<AdminUserRow>(
      'SELECT id, email, name, password_hash, role, access_status FROM users WHERE id = $1',
      [id]
    );

    return AdminAuthService.usableAdmin(admin);
  }

  /**
   * Authenticate a platform administrator with email and password.
   *
   * Throws 'Invalid credentials' for a wrong password, an unknown email, AND
   * a non-platform_admin account alike, so this endpoint cannot be used to
   * discover which accounts hold staff access.
   */
  static async login(email: string, password: string): Promise<{ token: string; admin: AdminIdentity }> {
    const admin = await AdminAuthService.findActiveAdminByEmail(email);

    if (!admin || !admin.password_hash) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    return {
      token: AdminAuthService.signToken(admin, false),
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name || '',
        role: admin.role,
      },
    };
  }

  /**
   * Re-confirm the administrator's password and issue a short-lived elevated
   * token. Required before any mutating admin action.
   */
  static async stepUp(adminId: string, password: string): Promise<{ token: string }> {
    const admin = await AdminAuthService.findActiveAdminById(adminId);

    if (!admin || !admin.password_hash) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    return { token: AdminAuthService.signToken(admin, true) };
  }

  /**
   * Verify a token and confirm it is an elevated (step-up) admin token.
   * Returns null when the token is missing, invalid, expired, not an admin
   * token, or has not completed step-up.
   */
  static verifyStepUpToken(token: string | null): AdminTokenClaims | null {
    if (!token) {
      return null;
    }

    try {
      const claims = jwt.verify(token, config.jwt.secret) as AdminTokenClaims;

      if (claims.scope !== 'admin' || claims.stepUp !== true) {
        return null;
      }

      return claims;
    } catch {
      return null;
    }
  }

  /**
   * End an admin session by expiring the administrator's stored session rows.
   *
   * Expired rather than deleted, so the session history stays available to the
   * admin activity log — who was signed in, from where, and until when.
   */
  static async logout(adminId: string): Promise<number> {
    const expired = await DataService.queryAll<{ id: string }>(
      'UPDATE sessions SET expires_at = NOW() WHERE user_id = $1 AND expires_at > NOW() RETURNING id',
      [adminId]
    );

    return expired.length;
  }
}

export default AdminAuthService;
