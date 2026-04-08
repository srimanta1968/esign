import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env';
import { DataService } from './DataService';
import { User, UserResponse, UserRole, PasswordResetToken } from '../types/user';

const jwtSignOptions: SignOptions = { expiresIn: config.jwt.expiresIn as any };

/**
 * AuthService handles user authentication operations.
 */
export class AuthService {
  /**
   * Validate email format.
   */
  static validateEmail(email: string): boolean {
    const emailRegex: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength: min 8 chars, upper, lower, number, special.
   */
  static validatePasswordStrength(password: string): { valid: boolean; message: string } {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one special character' };
    }
    return { valid: true, message: '' };
  }

  /**
   * Register a new user with email and password.
   * Enhanced with name, role fields and strong validation.
   */
  static async register(
    email: string,
    password: string,
    name: string = '',
    role: UserRole = 'user'
  ): Promise<{ token: string; user: UserResponse }> {
    try {
      if (!AuthService.validateEmail(email)) {
        throw new Error('Invalid email format');
      }

      const passwordCheck = AuthService.validatePasswordStrength(password);
      if (!passwordCheck.valid) {
        throw new Error(passwordCheck.message);
      }

      const existingUser = await DataService.queryOne<User>(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Validate role
      const validRoles: UserRole[] = ['admin', 'user', 'guest'];
      if (!validRoles.includes(role)) {
        role = 'user';
      }

      const passwordHash: string = await bcrypt.hash(password, config.bcryptRounds);

      const newUser = await DataService.queryOne<User>(
        'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, organization_id, created_at',
        [email, passwordHash, name, role]
      );

      if (!newUser) {
        throw new Error('Failed to create user');
      }

      const token: string = jwt.sign(
        { userId: newUser.id, email: newUser.email, role: newUser.role },
        config.jwt.secret,
        jwtSignOptions
      );

      return {
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          organization_id: newUser.organization_id,
          created_at: newUser.created_at,
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error && (
        error.message === 'Email already registered' ||
        error.message === 'Invalid email format' ||
        error.message.startsWith('Password must')
      )) {
        throw error;
      }
      throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Authenticate a user with email and password.
   */
  static async login(email: string, password: string): Promise<{ token: string; user: UserResponse }> {
    try {
      const user = await DataService.queryOne<User>(
        'SELECT id, email, password_hash, name, role, organization_id, created_at FROM users WHERE email = $1',
        [email]
      );

      if (!user) {
        throw new Error('Invalid credentials');
      }

      const isValidPassword: boolean = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      const token: string = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        config.jwt.secret,
        jwtSignOptions
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || '',
          role: user.role || 'user',
          organization_id: user.organization_id || null,
          created_at: user.created_at,
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Invalid credentials') {
        throw error;
      }
      throw new Error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a password reset token for the given email.
   */
  static async forgotPassword(email: string): Promise<{ message: string; resetToken: string }> {
    try {
      const user = await DataService.queryOne<User>(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (!user) {
        // Don't reveal whether email exists - return success either way
        return { message: 'If the email exists, a reset link has been sent', resetToken: '' };
      }

      // Invalidate any existing unused tokens for this user
      await DataService.query(
        'UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false',
        [user.id]
      );

      const resetToken: string = crypto.randomBytes(32).toString('hex');
      const expiresAt: Date = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await DataService.queryOne<PasswordResetToken>(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3) RETURNING id, user_id, token, expires_at',
        [user.id, resetToken, expiresAt]
      );

      return { message: 'If the email exists, a reset link has been sent', resetToken };
    } catch (error: unknown) {
      throw new Error(`Password reset request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reset password using a valid token.
   */
  static async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    try {
      const passwordCheck = AuthService.validatePasswordStrength(newPassword);
      if (!passwordCheck.valid) {
        throw new Error(passwordCheck.message);
      }

      const resetToken = await DataService.queryOne<PasswordResetToken>(
        'SELECT id, user_id, token, expires_at, used FROM password_reset_tokens WHERE token = $1',
        [token]
      );

      if (!resetToken) {
        throw new Error('Invalid reset token');
      }

      if (resetToken.used) {
        throw new Error('Reset token has already been used');
      }

      if (new Date(resetToken.expires_at) < new Date()) {
        throw new Error('Reset token has expired');
      }

      const passwordHash: string = await bcrypt.hash(newPassword, config.bcryptRounds);

      await DataService.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, resetToken.user_id]
      );

      await DataService.query(
        'UPDATE password_reset_tokens SET used = true WHERE id = $1',
        [resetToken.id]
      );

      return { message: 'Password has been reset successfully' };
    } catch (error: unknown) {
      if (error instanceof Error && (
        error.message === 'Invalid reset token' ||
        error.message === 'Reset token has already been used' ||
        error.message === 'Reset token has expired' ||
        error.message.startsWith('Password must')
      )) {
        throw error;
      }
      throw new Error(`Password reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle SSO login/registration via Google OAuth2 callback.
   * Creates user if not exists, logs in if exists.
   */
  static async ssoLogin(
    provider: string,
    providerUserId: string,
    email: string,
    name: string
  ): Promise<{ token: string; user: UserResponse }> {
    try {
      let user = await DataService.queryOne<User>(
        'SELECT id, email, name, role, organization_id, created_at FROM users WHERE email = $1',
        [email]
      );

      if (!user) {
        // Create new user from SSO - no password needed
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, config.bcryptRounds);

        user = await DataService.queryOne<User>(
          'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, organization_id, created_at',
          [email, passwordHash, name, 'user']
        );

        if (!user) {
          throw new Error('Failed to create SSO user');
        }
      }

      const token: string = jwt.sign(
        { userId: user.id, email: user.email, role: user.role || 'user' },
        config.jwt.secret,
        jwtSignOptions
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || name,
          role: user.role || 'user',
          organization_id: user.organization_id || null,
          created_at: user.created_at,
        },
      };
    } catch (error: unknown) {
      throw new Error(`SSO login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default AuthService;
