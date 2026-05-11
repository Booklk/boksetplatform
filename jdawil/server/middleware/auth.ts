import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Sentry } from '../lib/sentry.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
    phone: string;
    vendorId?: number;
    /** True when the token was issued via the super-admin impersonation
     *  flow — the request acts as user.id but originated from impersonatedBy. */
    impersonation?: boolean;
    impersonatedBy?: number;
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'غير مصرح' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as {
      id: number; role: string; phone: string; vendorId?: number;
      impersonation?: boolean; impersonatedBy?: number;
    };
    req.user = payload;
    try {
      Sentry.getCurrentScope().setUser({
        id: String(payload.id),
        segment: payload.role,
        vendorId: payload.vendorId ?? undefined,
        impersonation: payload.impersonation ?? false,
        impersonatedBy: payload.impersonatedBy,
      } as unknown as import('@sentry/node').User);
    } catch { /* no-op when Sentry not initialised */ }
    next();
  } catch {
    return res.status(401).json({ error: 'الجلسة منتهية، يرجى تسجيل الدخول مجدداً' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'غير مصرح لك بهذا الإجراء' });
    }
    next();
  };
}

/** Ensures the request is associated with a vendor (not super_admin global) */
export function requireVendor(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.vendorId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'هذا الإجراء يتطلب ارتباطاً بمشروع' });
  }
  next();
}
