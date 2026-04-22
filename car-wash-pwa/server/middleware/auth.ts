import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Sentry } from '../lib/sentry.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
    phone: string;
    vendorId?: number;
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'غير مصرح' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as {
      id: number; role: string; phone: string; vendorId?: number;
    };
    req.user = payload;
    // Attach to Sentry scope so any exception thrown in this request
    // carries the user + vendor context alongside it.
    try {
      Sentry.getCurrentScope().setUser({
        id: String(payload.id),
        segment: payload.role,
        vendorId: payload.vendorId ?? undefined,
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
