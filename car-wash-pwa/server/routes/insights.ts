/**
 * Vendor insights endpoints — AI-generated narrative, milestones, etc.
 *
 * Kept small and read-only so heavy lifting (LLM + baseline queries) stays
 * out of hot paths. The dashboard hero calls /daily once per mount; no
 * polling — real-time events invalidate the cache when bookings land.
 */

import { Router } from 'express';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { buildDailyBrief } from '../services/insights/dailyBrief.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('vendor_admin', 'admin'));

router.get('/daily', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمتجر' });
    const brief = await buildDailyBrief(vendorId);
    // Daily briefs are safe to cache for a few minutes on the CDN, but
    // the client already dedupes via React Query so we send no-store.
    res.set('Cache-Control', 'no-store');
    return res.json(brief);
  } catch (e) {
    console.error('[insights/daily]', e);
    return res.status(500).json({ error: 'تعذّر توليد التقرير اليومي' });
  }
});

export default router;
