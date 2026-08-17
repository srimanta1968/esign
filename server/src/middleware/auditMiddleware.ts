import { Response, NextFunction, RequestHandler } from 'express';
import { AuthenticatedRequest } from './auth';
import { AuditService } from '../services/auditService';

/**
 * Sanitize request body by removing sensitive fields (passwords, tokens, secrets).
 */
function sanitizeBody(body: Record<string, any> | undefined): Record<string, any> {
  if (!body || typeof body !== 'object') return {};
  const sanitized: Record<string, any> = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'creditCard', 'ssn', 'password_hash'];
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
}

/**
 * Extract the client IP address from the request.
 *
 * Exported so admin routes record the same IP the audit middleware would,
 * rather than each caller re-deriving it slightly differently.
 */
export function getClientIp(req: AuthenticatedRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Derive resource type from the request path.
 * e.g., /api/documents/123 -> "documents"
 */
function deriveResourceType(path: string): string {
  const parts = path.replace(/^\/api\//, '').split('/');
  return parts[0] || 'unknown';
}

/**
 * Derive resource ID from the request path if present.
 * e.g., /api/documents/some-uuid -> "some-uuid"
 */
function deriveResourceId(path: string): string | null {
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = path.match(uuidRegex);
  return match ? match[0] : null;
}

/**
 * Reads worth keeping: someone obtaining document content, exporting an audit
 * trail, or looking at the admin portal. Everything else a GET can do is
 * navigation, and navigation is not an audit event.
 */
const AUDITABLE_READS: RegExp[] = [
  /^\/api\/admin\//,
  /\/file$/,
  /\/document$/,
  /\/downloads?$/,
  /\/export$/,
  /^\/api\/api-keys/,
];

/**
 * Whether this request belongs in the audit log.
 *
 * Logging every request buried the trail: 95% of entries were GETs, and more
 * than half were the workflow page polling /status every ten seconds. A single
 * admin.plan.override sat under 4,794 page refreshes, which makes the log
 * useless exactly when it is needed. Anything that changes state is always
 * recorded; reads only when the read is itself the sensitive act.
 */
function shouldAudit(req: AuthenticatedRequest): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') return true;
  const path = req.path || '';
  return AUDITABLE_READS.some((pattern) => pattern.test(path));
}

/**
 * Audit middleware that logs state-changing requests and sensitive reads.
 * Must be placed AFTER auth middleware so userId is available.
 */
export const auditMiddleware: RequestHandler = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!shouldAudit(req)) {
    next();
    return;
  }

  // Captured before routing: Express rewrites req.url to be router-relative
  // while a sub-router handles the request, and the finish handler runs while
  // it is still rewritten. That is why entries used to read "GET /<uuid>/status"
  // with no hint of which resource they belonged to.
  const fullPath = req.path;

  // Log after the response is sent to avoid blocking the request
  res.on('finish', () => {
    const action = `${req.method} ${fullPath}`;
    const resourceType = deriveResourceType(fullPath);
    const resourceId = deriveResourceId(req.originalUrl || fullPath);

    AuditService.logEvent({
      userId: req.userId || null,
      action,
      resourceType,
      resourceId,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      metadata: {
        statusCode: res.statusCode,
        method: req.method,
        path: fullPath,
        query: req.query,
        body: sanitizeBody(req.body),
      },
    }).catch((err) => {
      // Audit logging should never break the application
      console.error('Audit log failed:', err instanceof Error ? err.message : 'Unknown error');
    });
  });

  next();
};

export default auditMiddleware;
