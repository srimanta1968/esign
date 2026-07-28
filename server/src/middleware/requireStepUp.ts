import { Response, NextFunction } from 'express';
import { AdminAuthService } from '../services/adminAuthService';
import { PlatformAdminRequest } from './requirePlatformAdmin';

/**
 * Requires the admin session to have completed step-up re-authentication.
 *
 * Apply to every MUTATING admin endpoint (access changes, plan overrides,
 * credit grants, message sends). Read-only admin endpoints do not need it.
 *
 * Must run after requirePlatformAdmin, which establishes the admin identity.
 */
export function requireStepUp(
  req: PlatformAdminRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const claims = AdminAuthService.verifyStepUpToken(token);

  if (!claims) {
    res.status(403).json({
      success: false,
      error: 'Step-up verification required for this action',
      code: 'STEP_UP_REQUIRED',
    });
    return;
  }

  // The elevated token must belong to the same administrator the session
  // resolved to, so one admin's step-up can never authorise another's action.
  if (claims.userId !== req.adminId) {
    res.status(403).json({
      success: false,
      error: 'Step-up token does not match the authenticated administrator',
      code: 'STEP_UP_MISMATCH',
    });
    return;
  }

  next();
}

export default requireStepUp;
