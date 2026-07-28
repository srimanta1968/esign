import { Router, RequestHandler, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth';
import { requirePlatformAdmin, PlatformAdminRequest } from '../middleware/requirePlatformAdmin';
import { AdminAuthService, AdminTokenClaims } from '../services/adminAuthService';
import { config } from '../config/env';

/**
 * Platform admin portal routes, mounted at /api/admin.
 *
 * This namespace is separate from /api/users, which keeps the existing
 * tenant-level authorizeRole('admin') behaviour untouched.
 */
const router: Router = Router();

// ─────────────────────────────────────────────────────────────
// PUBLIC — declared BEFORE the guards below.
//
// Login is the ONLY unauthenticated route under /api/admin: it PROVIDES the
// admin session rather than requiring one. Everything after the router.use()
// calls below is guarded by construction. Do not add routes in this block.
// ─────────────────────────────────────────────────────────────

router.post('/auth/login', (async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
      return;
    }

    const result = await AdminAuthService.login(email, password);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Invalid credentials') {
      // Deliberately identical for a wrong password, an unknown email, and a
      // non-platform_admin account — this endpoint must not reveal who holds
      // staff access.
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Admin login failed',
    });
  }
}) as RequestHandler);

// ─────────────────────────────────────────────────────────────
// GUARDS — every route declared below this point is protected.
// ─────────────────────────────────────────────────────────────

router.use(authenticateToken as RequestHandler);
router.use(requirePlatformAdmin as RequestHandler);

/**
 * Current administrator identity, plus whether this session is elevated.
 */
router.get('/auth/me', ((req: PlatformAdminRequest, res: Response): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let stepUp = false;
  try {
    const claims = token ? (jwt.verify(token, config.jwt.secret) as AdminTokenClaims) : null;
    stepUp = claims?.scope === 'admin' && claims?.stepUp === true;
  } catch {
    stepUp = false;
  }

  res.json({
    success: true,
    data: {
      id: req.adminId,
      email: req.adminEmail,
      role: req.userRole,
      stepUp,
    },
  });
}) as RequestHandler);

/**
 * Re-confirm the password to elevate the session before mutating actions.
 */
router.post('/auth/step-up', (async (req: PlatformAdminRequest, res: Response): Promise<void> => {
  try {
    const { password } = req.body as { password?: string };

    if (!password) {
      res.status(400).json({
        success: false,
        error: 'Password is required to complete step-up verification',
      });
      return;
    }

    if (!req.adminId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const result = await AdminAuthService.stepUp(req.adminId, password);

    res.json({
      success: true,
      data: {
        token: result.token,
        stepUp: true,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Invalid credentials') {
      res.status(401).json({
        success: false,
        error: 'Password confirmation failed',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Step-up verification failed',
    });
  }
}) as RequestHandler);

/**
 * End the admin session.
 */
router.post('/auth/logout', (async (req: PlatformAdminRequest, res: Response): Promise<void> => {
  try {
    const sessionsEnded = req.adminId ? await AdminAuthService.logout(req.adminId) : 0;

    res.json({
      success: true,
      data: { message: 'Admin session ended', sessionsEnded },
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Admin logout failed',
    });
  }
}) as RequestHandler);

// Account, billing, credit and messaging endpoints are registered below by
// their own tasks. Every one of them inherits the guards above.

export default router;
