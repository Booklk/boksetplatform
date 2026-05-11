/**
 * Maintenance mode middleware.
 *
 * Set MAINTENANCE_MODE=1 in the env to put the platform in read-only
 * mode. Behaviour:
 *   - GET requests pass through (storefronts keep showing, customers
 *     see their bookings, super-admin can read).
 *   - All write methods (POST/PUT/PATCH/DELETE) return 503 with a
 *     clear Arabic message explaining the platform is being updated.
 *   - Health/metrics endpoints always pass through so monitoring still works.
 *   - Webhooks (Moyasar, Meta) always pass through so we don't lose
 *     payment / message events during a deploy.
 *
 * Use during:
 *   - DB migration windows (read-only is safe; writes might violate
 *     a new constraint mid-rollout).
 *   - Incident response when we want to stop the bleeding without
 *     full downtime.
 *   - Major schema changes that need a brief pause.
 *
 * To enable temporarily without redeploy: set MAINTENANCE_MODE=1 in
 * your hosting platform's env panel and restart the process.
 */
import type { NextFunction, Request, Response } from 'express';

const MAINTENANCE_PASSTHROUGH_PATHS = [
  '/api/health',
  '/api/health/live',
  '/api/metrics',
  '/api/system-status/health',
  '/api/moyasar-webhook',
  '/api/payment-gateway/webhook',
  '/api/whatsapp-bot/webhook',
];

export function maintenanceMode(req: Request, res: Response, next: NextFunction): void {
  if (process.env.MAINTENANCE_MODE !== '1') return next();

  // Allow safe methods through — reads still serve.
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // Always allow webhooks + health probes.
  if (MAINTENANCE_PASSTHROUGH_PATHS.some((p) => req.path.startsWith(p))) {
    return next();
  }

  res.status(503).set('Retry-After', '300').json({
    error: 'المنصة قيد التحديث',
    message: 'نقوم بتحديث سريع — رجاءً حاول بعد دقائق. لن تفقد بياناتك.',
    maintenance: true,
  });
}
