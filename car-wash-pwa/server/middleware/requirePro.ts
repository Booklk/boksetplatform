/**
 * requirePro — middleware that blocks non-Pro vendors from calling a
 * write endpoint. Trial vendors count as Pro for the duration of the
 * trial (subscriptionStatus === 'trial' AND trialEndsAt in the future).
 *
 * Usage:
 *   router.put('/media/hero', requireAuth, requirePro, handler);
 *
 * Returns 402 (Payment Required) with { requiresPro: true } so the
 * client UI can open the upgrade sheet without parsing Arabic strings.
 */

import { Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import type { AuthRequest } from './auth.js';

export async function requirePro(req: AuthRequest, res: Response, next: NextFunction) {
  const vendorId = req.user?.vendorId;
  if (!vendorId) return res.status(403).json({ error: 'غير مصرح' });
  try {
    const [row] = await db.select({
      plan: vendors.subscriptionPlan,
      status: vendors.subscriptionStatus,
      trialEndsAt: vendors.trialEndsAt,
    }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);

    if (!row) return res.status(404).json({ error: 'المتجر غير موجود' });

    const inTrial = row.status === 'trial'
      && row.trialEndsAt != null
      && row.trialEndsAt > new Date();
    const isPro = row.plan === 'pro' || row.plan === 'enterprise';

    if (!isPro && !inTrial) {
      return res.status(402).json({
        error: 'هذه الميزة للباقة Pro — عندك تجربة مجانية شهر كامل',
        requiresPro: true,
      });
    }
    return next();
  } catch (e) {
    console.error('[requirePro]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
}
