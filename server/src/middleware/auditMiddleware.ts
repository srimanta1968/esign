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
 */
function getClientIp(req: AuthenticatedRequest): string {
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
 * Audit middleware that automatically logs ALL API requests.
 * Must be placed AFTER auth middleware so userId is available.
 */
export const auditMiddleware: RequestHandler = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  // Log after the response is sent to avoid blocking the request
  res.on('finish', () => {
    const action = `${req.method} ${req.path}`;
    const resourceType = deriveResourceType(req.path);
    const resourceId = deriveResourceId(req.originalUrl || req.path);

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
        path: req.path,
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
