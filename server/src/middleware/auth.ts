import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { DataService } from '../services/DataService';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

/**
 * Middleware to verify JWT tokens on protected routes.
 *
 * As well as verifying the signature, this re-checks the account's
 * access_status on every request. Without that, a user suspended or revoked
 * by a platform admin would keep working until their (7 day) token expired.
 * The cost is one indexed primary-key lookup per request.
 */
export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7)
    : (req.query.token as string) || null;

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Access token required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  let decoded: { userId: string; email: string; role?: string };

  try {
    decoded = jwt.verify(token, config.jwt.secret) as { userId: string; email: string; role?: string };
  } catch {
    res.status(403).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  try {
    const account = await DataService.queryOne<{ access_status: string | null }>(
      'SELECT access_status FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!account) {
      res.status(403).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    if (account.access_status && account.access_status !== 'active') {
      res.status(403).json({
        success: false,
        error: 'Your account access has been revoked. Please contact support.',
        code: 'ACCESS_REVOKED',
      });
      return;
    }
  } catch {
    // Fail closed: if the access check cannot run, refuse the request rather
    // than letting a possibly-revoked account through.
    res.status(503).json({
      success: false,
      error: 'Unable to verify account access, please retry',
    });
    return;
  }

  req.userId = decoded.userId;
  req.userEmail = decoded.email;
  req.userRole = decoded.role || 'user';
  next();
}
