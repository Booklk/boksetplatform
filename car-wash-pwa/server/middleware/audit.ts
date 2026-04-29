import { Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
import type { AuthRequest } from './auth.js';

/**
 * Audit middleware — logs sensitive actions to the auditLogs table.
 * Usage: router.post('/sensitive-action', requireAuth, audit('payment.refund'), handler)
 */
export function audit(action: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Capture the original json method to intercept the response
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown) {
      // Log after response is sent (non-blocking)
      setImmediate(async () => {
        try {
          await db.insert(auditLogs).values({
            vendorId: req.user?.vendorId ?? null,
            userId: req.user?.id ?? null,
            action,
            resource: req.originalUrl,
            resourceId: req.params.id ? parseInt(req.params.id) : null,
            method: req.method,
            metadata: {
              body: sanitizeBody(req.body),
              statusCode: res.statusCode,
              userAgent: req.headers['user-agent'],
            },
            ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
          });
        } catch (err) {
          console.error('Audit log error:', err);
        }
      });

      return originalJson(body);
    } as typeof res.json;

    next();
  };
}

/** Remove sensitive fields before logging */
function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const sanitized = { ...body };
  const sensitiveKeys = ['password', 'passwordHash', 'token', 'apiKey', 'secretKey', 'accessToken'];
  for (const key of sensitiveKeys) {
    if (key in sanitized) sanitized[key] = '[REDACTED]';
  }
  return sanitized;
}
