import { Router, RequestHandler, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth';
import { requirePlatformAdmin, PlatformAdminRequest } from '../middleware/requirePlatformAdmin';
import { AdminAuthService, AdminTokenClaims } from '../services/adminAuthService';
import { AdminAccountService } from '../services/adminAccountService';
import { AdminBillingService } from '../services/adminBillingService';
import { CreditService } from '../services/creditService';
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

/** Plans an override may target. Mirrors the subscriptions.plan CHECK. */
const VALID_PLANS: string[] = ['free', 'solo', 'team', 'scale'];

/** Trialling 'free' is meaningless, so only paid plans are trialable. */
const TRIALABLE_PLANS: string[] = ['solo', 'team', 'scale'];

/** Upper bound on a comped trial, so a typo cannot grant one for years. */
const MAX_TRIAL_DAYS = 180;

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

// ─────────────────────────────────────────────────────────────
// BILLING
// ─────────────────────────────────────────────────────────────

/**
 * Subscription and payment history for one account. Read-only.
 */
router.get('/accounts/:id/billing', (async (req: PlatformAdminRequest, res: Response): Promise<void> => {
  try {
    if (!isUuid(req.params.id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid account id',
      });
      return;
    }

    const { page, limit } = req.query as Record<string, string>;

    const billing = await AdminBillingService.getAccountBilling(
      req.params.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : undefined
    );

    res.json({
      success: true,
      data: billing,
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Failed to load billing detail',
    });
  }
}) as RequestHandler);

/**
 * Apply a manual (comp) plan override. Mutating — requires step-up.
 */
router.post(
  '/accounts/:id/plan',
  requireStepUp as RequestHandler,
  (async (req: PlatformAdminRequest, res: Response): Promise<void> => {
    try {
      const { plan, reason } = req.body as { plan?: string; reason?: string };
      const targetUserId = req.params.id;

      if (!isUuid(targetUserId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid account id',
        });
        return;
      }

      if (!plan || !VALID_PLANS.includes(plan)) {
        res.status(400).json({
          success: false,
          error: `plan must be one of ${VALID_PLANS.join(', ')}`,
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

      const account = await AdminAccountService.getAccountDetail(targetUserId);

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'Account not found',
        });
        return;
      }

      const result = await AdminBillingService.overridePlan(
        targetUserId,
        plan,
        reason.trim(),
        req.adminId as string
      );

      await AuditService.logAdminAction({
        adminId: req.adminId as string,
        targetUserId,
        action: 'admin.plan.override',
        before: { plan: result.before },
        after: { plan: result.after },
        reason: reason.trim(),
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || '',
      });

      res.json({
        success: true,
        data: {
          id: targetUserId,
          plan: result.after,
          previous_plan: result.before,
          is_manual_override: true,
          // A live Stripe subscription will overwrite this on its next
          // webhook, so the operator needs to know the override is temporary.
          warning: result.stripeSubscriptionId
            ? 'This account has a live Stripe subscription. A future Stripe webhook will overwrite this manual override.'
            : null,
        },
      });
    } catch {
      res.status(500).json({
        success: false,
        error: 'Failed to override plan',
      });
    }
  }) as RequestHandler
);

// ─────────────────────────────────────────────────────────────
// CREDITS & TRIALS
// ─────────────────────────────────────────────────────────────

/**
 * Credit balance and ledger for one account. Read-only.
 */
router.get('/accounts/:id/credits', (async (req: PlatformAdminRequest, res: Response): Promise<void> => {
  try {
    if (!isUuid(req.params.id)) {
      res.status(400).json({ success: false, error: 'Invalid account id' });
      return;
    }

    const { page, limit } = req.query as Record<string, string>;

    const [balance, ledger] = await Promise.all([
      CreditService.getBalance(req.params.id),
      CreditService.getLedger(
        req.params.id,
        page ? parseInt(page, 10) : 1,
        limit ? parseInt(limit, 10) : undefined
      ),
    ]);

    res.json({
      success: true,
      data: { balance, ledger },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load credits' });
  }
}) as RequestHandler);

/**
 * Grant or revoke bonus credits. Mutating — requires step-up.
 */
router.post(
  '/accounts/:id/credits',
  requireStepUp as RequestHandler,
  (async (req: PlatformAdminRequest, res: Response): Promise<void> => {
    try {
      const { action, amount, reason, expires_at } = req.body as {
        action?: string;
        amount?: number | 'all';
        reason?: string;
        expires_at?: string;
      };
      const targetUserId = req.params.id;

      if (!isUuid(targetUserId)) {
        res.status(400).json({ success: false, error: 'Invalid account id' });
        return;
      }

      if (action !== 'grant' && action !== 'revoke') {
        res.status(400).json({ success: false, error: "action must be 'grant' or 'revoke'" });
        return;
      }

      if (!reason || !reason.trim()) {
        res.status(400).json({
          success: false,
          error: 'A reason is required and is recorded in the credit ledger',
        });
        return;
      }

      const account = await AdminAccountService.getAccountDetail(targetUserId);

      if (!account) {
        res.status(404).json({ success: false, error: 'Account not found' });
        return;
      }

      if (action === 'grant') {
        const expiresAt = expires_at ? new Date(expires_at) : null;

        if (expiresAt && Number.isNaN(expiresAt.getTime())) {
          res.status(400).json({ success: false, error: 'expires_at must be a valid date' });
          return;
        }

        const result = await CreditService.grantCredits(
          targetUserId,
          Number(amount),
          reason.trim(),
          req.adminId as string,
          expiresAt
        );

        await AuditService.logAdminAction({
          adminId: req.adminId as string,
          targetUserId,
          action: 'admin.credits.grant',
          before: { credit_balance: result.balance - Number(amount) },
          after: { credit_balance: result.balance },
          reason: reason.trim(),
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'] || '',
        });

        res.json({
          success: true,
          data: { action: 'grant', granted: Number(amount), balance: result.balance },
        });
        return;
      }

      const result = await CreditService.revokeCredits(
        targetUserId,
        amount === 'all' ? 'all' : Number(amount),
        reason.trim(),
        req.adminId as string
      );

      await AuditService.logAdminAction({
        adminId: req.adminId as string,
        targetUserId,
        action: 'admin.credits.revoke',
        before: { credit_balance: result.balance + result.revoked },
        after: { credit_balance: result.balance },
        reason: reason.trim(),
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || '',
      });

      res.json({
        success: true,
        data: { action: 'revoke', revoked: result.revoked, balance: result.balance },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('positive whole number')) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }

      res.status(500).json({ success: false, error: 'Failed to change credits' });
    }
  }) as RequestHandler
);

/**
 * Start a time-limited trial. Mutating — requires step-up.
 */
router.post(
  '/accounts/:id/trial',
  requireStepUp as RequestHandler,
  (async (req: PlatformAdminRequest, res: Response): Promise<void> => {
    try {
      const { plan, duration_days, reason } = req.body as {
        plan?: string;
        duration_days?: number;
        reason?: string;
      };
      const targetUserId = req.params.id;

      if (!isUuid(targetUserId)) {
        res.status(400).json({ success: false, error: 'Invalid account id' });
        return;
      }

      if (!plan || !TRIALABLE_PLANS.includes(plan)) {
        res.status(400).json({
          success: false,
          error: `plan must be one of ${TRIALABLE_PLANS.join(', ')}`,
        });
        return;
      }

      const days = Number(duration_days);

      if (!Number.isInteger(days) || days < 1 || days > MAX_TRIAL_DAYS) {
        res.status(400).json({
          success: false,
          error: `duration_days must be a whole number between 1 and ${MAX_TRIAL_DAYS}`,
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

      const account = await AdminAccountService.getAccountDetail(targetUserId);

      if (!account) {
        res.status(404).json({ success: false, error: 'Account not found' });
        return;
      }

      const result = await AdminBillingService.grantTrial(
        targetUserId,
        plan,
        days,
        reason.trim(),
        req.adminId as string
      );

      await AuditService.logAdminAction({
        adminId: req.adminId as string,
        targetUserId,
        action: 'admin.trial.grant',
        before: { plan: account.account.plan, status: account.account.subscription_status },
        after: { plan: result.plan, status: 'trialing', trial_ends_at: result.trialEndsAt.toISOString() },
        reason: reason.trim(),
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || '',
      });

      res.json({
        success: true,
        data: {
          plan: result.plan,
          status: 'trialing',
          trial_ends_at: result.trialEndsAt.toISOString(),
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Account has an active paid subscription') {
        res.status(409).json({
          success: false,
          error: 'This account already has an active paid subscription, so a trial would downgrade it on expiry',
        });
        return;
      }

      res.status(500).json({ success: false, error: 'Failed to grant trial' });
    }
  }) as RequestHandler
);

/**
 * Cancel a trial early. Mutating — requires step-up (DELETE is no exception).
 */
router.delete(
  '/accounts/:id/trial',
  requireStepUp as RequestHandler,
  (async (req: PlatformAdminRequest, res: Response): Promise<void> => {
    try {
      const targetUserId = req.params.id;

      if (!isUuid(targetUserId)) {
        res.status(400).json({ success: false, error: 'Invalid account id' });
        return;
      }

      const result = await AdminBillingService.cancelTrial(targetUserId);

      await AuditService.logAdminAction({
        adminId: req.adminId as string,
        targetUserId,
        action: 'admin.trial.cancel',
        before: { status: 'trialing' },
        after: { plan: result.plan, status: 'active' },
        reason: 'Trial cancelled by administrator',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || '',
      });

      res.json({ success: true, data: { plan: result.plan, status: 'active' } });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'No active trial') {
        res.status(404).json({ success: false, error: 'This account has no active trial' });
        return;
      }

      res.status(500).json({ success: false, error: 'Failed to cancel trial' });
    }
  }) as RequestHandler
);

// ─────────────────────────────────────────────────────────────
// METRICS & ACTIVITY
// ─────────────────────────────────────────────────────────────

/**
 * Revenue and billing-health figures. Read-only.
 */
router.get('/metrics/revenue', (async (_req: PlatformAdminRequest, res: Response): Promise<void> => {
  try {
    const metrics = await AdminBillingService.getRevenueMetrics();

    res.json({
      success: true,
      data: metrics,
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Failed to load revenue metrics',
    });
  }
}) as RequestHandler);

/**
 * Aggregate counts backing the portal dashboard.
 */
router.get('/metrics/overview', (async (_req: PlatformAdminRequest, res: Response): Promise<void> => {
  try {
    const metrics = await AdminAccountService.getOverviewMetrics();

    res.json({
      success: true,
      data: metrics,
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Failed to load overview metrics',
    });
  }
}) as RequestHandler);

/**
 * Privileged admin actions, for the portal's own oversight view.
 */
router.get('/activity', (async (req: PlatformAdminRequest, res: Response): Promise<void> => {
  try {
    const { admin_id, target_user_id, action, page, limit } = req.query as Record<string, string>;

    const result = await AuditService.getAdminActions({
      adminId: admin_id && isUuid(admin_id) ? admin_id : undefined,
      targetUserId: target_user_id && isUuid(target_user_id) ? target_user_id : undefined,
      action: action || undefined,
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
      error: 'Failed to load admin activity',
    });
  }
}) as RequestHandler);

// Billing, credit and messaging endpoints are registered below by their own
// tasks. Every one of them inherits the guards above.

export default router;
