import { Router, Request, Response, RequestHandler } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
// @governance-tracked — API definitions added: POST /api/auth/register, POST /api/auth/login, POST /api/auth/forgot-password, POST /api/auth/reset-password, GET /api/auth/sso/:provider, GET /api/auth/sso/callback, POST /api/auth/refresh-token, GET /api/auth/sessions, DELETE /api/auth/sessions/:id

/**
 * Auth routes configuration.
 * API Definitions: tests/api_definitions/auth-register.json, auth-forgot-password.json, auth-reset-password.json, auth-sso-redirect.json, auth-sso-callback.json, auth-refresh-token.json, auth-sessions-list.json, auth-sessions-revoke.json
 */

interface AuthRouter {
  register: RequestHandler;
  login: RequestHandler;
  forgotPassword: RequestHandler;
  resetPassword: RequestHandler;
  ssoRedirect: RequestHandler;
  ssoCallback: RequestHandler;
  refreshToken: RequestHandler;
  getSessions: RequestHandler;
  revokeSession: RequestHandler;
}

const authHandlers: AuthRouter = {
  register: (req: Request, res: Response): void => {
    AuthController.register(req, res);
  },
  login: (req: Request, res: Response): void => {
    AuthController.login(req, res);
  },
  forgotPassword: (req: Request, res: Response): void => {
    AuthController.forgotPassword(req, res);
  },
  resetPassword: (req: Request, res: Response): void => {
    AuthController.resetPassword(req, res);
  },
  ssoRedirect: (req: Request, res: Response): void => {
    AuthController.ssoRedirect(req, res);
  },
  ssoCallback: (req: Request, res: Response): void => {
    AuthController.ssoCallback(req, res);
  },
  refreshToken: (req: Request, res: Response): void => {
    AuthController.refreshToken(req, res);
  },
  getSessions: (req: AuthenticatedRequest, res: Response): void => {
    AuthController.getSessions(req, res);
  },
  revokeSession: (req: AuthenticatedRequest, res: Response): void => {
    AuthController.revokeSession(req, res);
  },
};

const router: Router = Router();

// Existing auth routes
router.post('/register', authHandlers.register);
router.post('/login', authHandlers.login);

// Password reset routes (Task 2)
router.post('/forgot-password', authHandlers.forgotPassword);
router.post('/reset-password', authHandlers.resetPassword);

// SSO routes (Task 3)
router.get('/sso/callback', authHandlers.ssoCallback);
router.get('/sso/:provider', authHandlers.ssoRedirect);

// Session management routes (Task 6)
router.post('/refresh-token', authHandlers.refreshToken);
router.get('/sessions', authenticateToken as RequestHandler, authHandlers.getSessions);
router.delete('/sessions/:id', authenticateToken as RequestHandler, authHandlers.revokeSession);

// Token validation endpoint
router.get('/me', authenticateToken as RequestHandler, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  res.json({ success: true, data: { id: authReq.userId, email: authReq.userEmail, role: authReq.userRole } });
});

// Profile endpoints
router.get('/profile', authenticateToken as RequestHandler, (async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { DataService } = await import('../services/DataService');
    const user = await DataService.queryOne<any>(
      'SELECT id, name, email, role, language_preference, plan, created_at FROM users WHERE id = $1',
      [authReq.userId]
    );
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({
      success: true,
      data: {
        profile: {
          name: user.name || '',
          email: user.email,
          role: user.role,
          language: user.language_preference || 'en',
          plan: user.plan || 'free',
          privacy_profile_visible: true,
          privacy_email_visible: false,
          privacy_activity_tracking: true,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}) as RequestHandler);

router.put('/profile', authenticateToken as RequestHandler, (async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { name, language } = req.body;
    const { DataService } = await import('../services/DataService');
    await DataService.query(
      'UPDATE users SET name = COALESCE($1, name), language_preference = COALESCE($2, language_preference), updated_at = NOW() WHERE id = $3',
      [name, language, authReq.userId]
    );
    res.json({ success: true, message: 'Profile updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}) as RequestHandler);

// API Key management
router.post('/api-keys', authenticateToken as RequestHandler, (async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { DataService } = await import('../services/DataService');
    const crypto = await import('crypto');
    const { label } = req.body;

    // Generate a random API key: edoc_sk_<random>
    const rawKey = `edoc_sk_${crypto.randomBytes(32).toString('hex')}`;
    const keyPrefix = rawKey.substring(0, 12);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    await DataService.query(
      'INSERT INTO api_keys (user_id, key_hash, key_prefix, label) VALUES ($1, $2, $3, $4)',
      [authReq.userId, keyHash, keyPrefix, label || 'Default']
    );

    // Return the full key ONCE — it can never be retrieved again
    res.status(201).json({
      success: true,
      data: {
        key: rawKey,
        prefix: keyPrefix,
        label: label || 'Default',
        message: 'Save this key now. It will not be shown again.',
      },
    });
  } catch (error: any) {
    console.error('API key creation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}) as RequestHandler);

router.get('/api-keys', authenticateToken as RequestHandler, (async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { DataService } = await import('../services/DataService');
    const keys = await DataService.queryAll<any>(
      'SELECT id, key_prefix, label, last_used_at, created_at, revoked_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [authReq.userId]
    );
    res.json({ success: true, data: { keys } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}) as RequestHandler);

router.delete('/api-keys/:id', authenticateToken as RequestHandler, (async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { DataService } = await import('../services/DataService');
    const result = await DataService.query(
      'UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL',
      [req.params.id, authReq.userId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ success: false, error: 'API key not found' });
      return;
    }
    res.json({ success: true, message: 'API key revoked' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}) as RequestHandler);

export default router;
