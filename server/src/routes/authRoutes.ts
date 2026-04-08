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

export default router;
