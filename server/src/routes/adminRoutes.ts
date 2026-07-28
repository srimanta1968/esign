import { Router, RequestHandler, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth';
import { requirePlatformAdmin, PlatformAdminRequest } from '../middleware/requirePlatformAdmin';
import { AdminAuthService, AdminTokenClaims } from '../services/adminAuthService';
import { AdminAccountService } from '../services/adminAccountService';
import { AuditService } from '../services/auditService';
import { requireStepUp } from '../middleware/requireStepUp';
import { getClientIp } from '../middleware/auditMiddleware';
import { AccessStatus } from '../types/user';
import { config } from '../config/env';

/** Access actions an administrator may take, mapped to the resulting state. */
type AccessAction = 'suspend' | 'revoke' | 'restore';

const ACCESS_ACTIONS: Record<AccessAction, AccessStatus> = {
  suspend: 'suspended',
  revoke: 'revoked',
  restore: 'active',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Account ids reach Postgres as uuid, so a malformed value raises a cast error
 * and would surface as a 500. Reject it as a client error instead.
 */
function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

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

// ─────────────────────────────────────────────────────────────
// ACCOUNTS
// ─────────────────────────────────────────────────────────────

/**
 * List every account on the platform. Read-only — no step-up required.
 */
router.get('/accounts', (async (req: PlatformAdminRequest, res: Response): Promise<void> => {
  try {
    const { search, plan, status, access_status, page, limit } = req.query as Record<string, string>;

    const result = await AdminAccountService.listAccounts({
      search: search || undefined,
      plan: plan || undefined,
      status: status || undefined,
      accessStatus: access_status || undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Failed to list accounts',
    });
  }
}) as RequestHandler);

/**
 * Full detail for one account. Read-only — no step-up required.
 */
router.get('/accounts/:id', (async (req: PlatformAdminRequest, res: Response): Promise<void> => {
  try {
    if (!isUuid(req.params.id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid account id',
      });
      return;
    }

    const detail = await AdminAccountService.getAccountDetail(req.params.id);

    if (!detail) {
      res.status(404).json({
        success: false,
        error: 'Account not found',
      });
      return;
    }

    res.json({
      success: true,
      data: detail,
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Failed to load account detail',
    });
  }
}) as RequestHandler);

/**
 * Suspend, revoke or restore an account's access.
 *
 * Mutating, so it additionally requires a step-up elevated token.
 */
router.post(
  '/accounts/:id/access',
  requireStepUp as RequestHandler,
  (async (req: PlatformAdminRequest, res: Response): Promise<void> => {
    try {
      const { action, reason } = req.body as { action?: string; reason?: string };
      const targetUserId = req.params.id;

      if (!isUuid(targetUserId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid account id',
        });
        return;
      }

      if (!action || !ACCESS_ACTIONS[action as AccessAction]) {
        res.status(400).json({
          success: false,
          error: "action must be one of 'suspend', 'revoke' or 'restore'",
        });
        return;
      }

      if (!reason || !reason.trim()) {
        res.status(400).json({
          success: false,
          error: 'A reason is required and is recorded in the audit log',
        });
        return;
      }

      // An admin locking themselves out would leave the portal unreachable if
      // they were the only active platform admin.
      if (targetUserId === req.adminId) {
        res.status(400).json({
          success: false,
          error: 'You cannot change your own account access',
        });
        return;
      }

      const nextStatus = ACCESS_ACTIONS[action as AccessAction];

      const result = await AdminAccountService.setAccessStatus(
        targetUserId,
        nextStatus,
        reason.trim(),
        req.adminId as string
      );

      await AuditService.logAdminAction({
        adminId: req.adminId as string,
        targetUserId,
        action: `admin.account.${action}`,
        before: { access_status: result.before },
        after: { access_status: result.after },
        reason: reason.trim(),
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || '',
      });

      res.json({
        success: true,
        data: {
          id: targetUserId,
          access_status: result.after,
          previous_access_status: result.before,
          sessionsEnded: result.sessionsEnded,
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Account not found') {
        res.status(404).json({
          success: false,
          error: 'Account not found',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to change account access',
      });
    }
  }) as RequestHandler
);

// Billing, credit and messaging endpoints are registered below by their own
// tasks. Every one of them inherits the guards above.

export default router;
