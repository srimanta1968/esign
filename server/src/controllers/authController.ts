import { Request, Response } from 'express';
import crypto from 'crypto';
import { AuthService } from '../services/authService';
import { SessionService } from '../services/sessionService';
import { EmailService } from '../services/emailService';
import { DataService } from '../services/DataService';
import { RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest } from '../types/user';
import { AuthenticatedRequest } from '../middleware/auth';
import { config } from '../config/env';

/**
 * AuthController handles HTTP requests for authentication endpoints.
 */
export class AuthController {
  /**
   * Handle user registration.
   * POST /api/auth/register
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name, role }: RegisterRequest = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: 'Email and password are required',
        });
        return;
      }

      const result = await AuthService.register(email, password, name || '', role || 'user');

      // Send verification code
      try {
        await AuthController.sendVerificationCode(result.user.id, email);
      } catch (err) {
        console.error('Failed to send verification email:', err);
      }

      res.status(201).json({
        success: true,
        data: { ...result, emailVerified: false },
      });
    } catch (error: any) {
      if (error.message === 'Invalid email format') {
        res.status(400).json({
          success: false,
          error: 'Please provide a valid email address',
        });
        return;
      }

      if (error.message === 'Email already registered') {
        res.status(409).json({
          success: false,
          error: error.message,
        });
        return;
      }

      if (error.message.startsWith('Password must')) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Generate and send a 6-digit verification code to the user's email.
   */
  private static async sendVerificationCode(userId: string, email: string): Promise<void> {
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Invalidate old codes
    await DataService.query(
      'UPDATE email_verification_codes SET used = true WHERE user_id = $1 AND used = false',
      [userId]
    );

    await DataService.query(
      'INSERT INTO email_verification_codes (user_id, code, expires_at) VALUES ($1, $2, $3)',
      [userId, code, expiresAt.toISOString()]
    );

    await EmailService.send(email, 'Verify your eDocSign account', `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1e293b; margin-bottom: 8px;">Verify your email</h2>
        <p style="color: #64748b; margin-bottom: 24px;">Enter this code to activate your eDocSign account:</p>
        <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">${code}</span>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">This code expires in 15 minutes. If you didn't create an account, you can ignore this email.</p>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0 0 8px 0;"><a href="https://esign.projexlight.com" style="color: #4f46e5; font-size: 14px; font-weight: 600; text-decoration: none;">esign.projexlight.com</a></p>
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">Powered by <a href="https://projexlight.com" style="color: #4f46e5; text-decoration: none;">projexlight.com</a></p>
        </div>
      </div>
    `);
  }

  /**
   * Verify email with 6-digit code.
   * POST /api/auth/verify-email
   */
  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        res.status(400).json({ success: false, error: 'Email and verification code are required' });
        return;
      }

      const user = await DataService.queryOne<{ id: string; email_verified: boolean }>(
        'SELECT id, email_verified FROM users WHERE email = $1',
        [email]
      );

      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      if (user.email_verified) {
        res.status(200).json({ success: true, data: { message: 'Email already verified' } });
        return;
      }

      const record = await DataService.queryOne<{ id: string; code: string; expires_at: string }>(
        'SELECT id, code, expires_at FROM email_verification_codes WHERE user_id = $1 AND used = false ORDER BY created_at DESC LIMIT 1',
        [user.id]
      );

      if (!record) {
        res.status(400).json({ success: false, error: 'No verification code found. Please request a new one.' });
        return;
      }

      if (new Date(record.expires_at) < new Date()) {
        res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
        return;
      }

      if (record.code !== code) {
        res.status(400).json({ success: false, error: 'Invalid verification code' });
        return;
      }

      // Mark code as used and verify user
      await DataService.query('UPDATE email_verification_codes SET used = true WHERE id = $1', [record.id]);
      await DataService.query('UPDATE users SET email_verified = true WHERE id = $1', [user.id]);

      res.status(200).json({ success: true, data: { message: 'Email verified successfully' } });
    } catch (error: any) {
      console.error('Email verification error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Resend verification code.
   * POST /api/auth/resend-verification
   */
  static async resendVerification(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ success: false, error: 'Email is required' });
        return;
      }

      const user = await DataService.queryOne<{ id: string; email_verified: boolean }>(
        'SELECT id, email_verified FROM users WHERE email = $1',
        [email]
      );

      if (!user) {
        // Don't reveal if user exists
        res.status(200).json({ success: true, data: { message: 'If an account exists, a verification code has been sent.' } });
        return;
      }

      if (user.email_verified) {
        res.status(200).json({ success: true, data: { message: 'Email already verified' } });
        return;
      }

      await AuthController.sendVerificationCode(user.id, email);
      res.status(200).json({ success: true, data: { message: 'Verification code sent' } });
    } catch (error: any) {
      console.error('Resend verification error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Handle user login.
   * POST /api/auth/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password }: LoginRequest = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: 'Email and password are required',
        });
        return;
      }

      const result = await AuthService.login(email, password);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Invalid credentials') {
        res.status(401).json({
          success: false,
          error: error.message,
        });
        return;
      }

      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Handle forgot password request.
   * POST /api/auth/forgot-password
   */
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email }: ForgotPasswordRequest = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          error: 'Email is required',
        });
        return;
      }

      const result = await AuthService.forgotPassword(email);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Handle password reset.
   * POST /api/auth/reset-password
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, password }: ResetPasswordRequest = req.body;

      if (!token || !password) {
        res.status(400).json({
          success: false,
          error: 'Token and new password are required',
        });
        return;
      }

      const result = await AuthService.resetPassword(token, password);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (
        error.message === 'Invalid reset token' ||
        error.message === 'Reset token has already been used' ||
        error.message === 'Reset token has expired'
      ) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      if (error.message.startsWith('Password must')) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Handle SSO redirect to OAuth provider.
   * GET /api/auth/sso/:provider
   */
  static async ssoRedirect(req: Request, res: Response): Promise<void> {
    try {
      const { provider } = req.params;

      if (provider === 'google') {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/sso/callback`;
        if (!clientId) {
          res.status(500).json({ success: false, error: 'Google OAuth not configured' });
          return;
        }
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${encodeURIComponent(clientId)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&response_type=code` +
          `&scope=${encodeURIComponent('email profile')}` +
          `&state=${encodeURIComponent(provider)}`;
        res.status(200).json({ success: true, data: { url: authUrl, provider } });
      } else if (provider === 'linkedin') {
        const clientId = process.env.LINKEDIN_CLIENT_ID;
        const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/sso/callback`;
        if (!clientId) {
          res.status(500).json({ success: false, error: 'LinkedIn OAuth not configured' });
          return;
        }
        const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
          `response_type=code` +
          `&client_id=${encodeURIComponent(clientId)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent('openid profile email')}` +
          `&state=${encodeURIComponent(provider)}`;
        res.status(200).json({ success: true, data: { url: authUrl, provider } });
      } else {
        res.status(400).json({ success: false, error: 'Unsupported SSO provider. Supported: google, linkedin' });
        return;
      }
    } catch (error: any) {
      console.error('SSO redirect error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Handle SSO callback from OAuth provider.
   * GET /api/auth/sso/callback
   */
  static async ssoCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query;

      if (!code) {
        res.status(400).json({
          success: false,
          error: 'Authorization code is required',
        });
        return;
      }

      const provider = (state as string) || 'google';
      let userInfo: { id?: string; email?: string; name?: string } = {};

      if (provider === 'google') {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/sso/callback`;
        if (!clientId || !clientSecret) {
          res.status(500).json({ success: false, error: 'Google OAuth not configured' });
          return;
        }
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: code as string,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });
        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) {
          res.status(400).json({ success: false, error: 'Failed to exchange authorization code' });
          return;
        }
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        userInfo = await userInfoResponse.json();
      } else if (provider === 'linkedin') {
        const clientId = process.env.LINKEDIN_CLIENT_ID;
        const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
        const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/sso/callback`;
        if (!clientId || !clientSecret) {
          res.status(500).json({ success: false, error: 'LinkedIn OAuth not configured' });
          return;
        }
        const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code as string,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
          }).toString(),
        });
        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) {
          res.status(400).json({ success: false, error: 'Failed to exchange authorization code' });
          return;
        }
        const userInfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const linkedinUser = await userInfoResponse.json();
        userInfo = {
          id: linkedinUser.sub || '',
          email: linkedinUser.email || '',
          name: linkedinUser.name || '',
        };
      } else {
        res.status(400).json({ success: false, error: 'Unsupported SSO provider' });
        return;
      }

      if (!userInfo.email) {
        res.status(400).json({ success: false, error: 'Failed to retrieve user info from provider' });
        return;
      }

      const result = await AuthService.ssoLogin(
        provider,
        userInfo.id || '',
        userInfo.email,
        userInfo.name || ''
      );

      // Redirect to frontend with token so the SPA can pick it up
      const frontendUrl = config.frontendUrl || 'https://esign.projexlight.com';
      res.redirect(`${frontendUrl}/login?token=${encodeURIComponent(result.token)}`);
    } catch (error: any) {
      console.error('SSO callback error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Refresh JWT token.
   * POST /api/auth/refresh-token
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Current token is required',
        });
        return;
      }

      const ipAddress = (req.ip || req.socket.remoteAddress || '') as string;
      const userAgent = (req.headers['user-agent'] || '') as string;

      const result = await SessionService.refreshToken(token, ipAddress, userAgent);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message === 'Invalid token' || error.message === 'User not found') {
        res.status(401).json({
          success: false,
          error: error.message,
        });
        return;
      }

      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get active sessions for the authenticated user.
   * GET /api/auth/sessions
   */
  static async getSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const sessions = await SessionService.getActiveSessions(req.userId);

      res.status(200).json({
        success: true,
        data: sessions,
      });
    } catch (error: any) {
      console.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Revoke a session.
   * DELETE /api/auth/sessions/:id
   */
  static async revokeSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const revoked = await SessionService.revokeSession(id, req.userId);

      if (!revoked) {
        res.status(404).json({
          success: false,
          error: 'Session not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { message: 'Session revoked successfully' },
      });
    } catch (error: any) {
      console.error('Revoke session error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}

export default AuthController;
