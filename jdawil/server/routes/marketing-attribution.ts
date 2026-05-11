/**
 * Marketing attribution capture — first-touch UTM tracking.
 *
 * Public endpoint that accepts the attribution payload from the client
 * and stores it on the eventual signup. Works without auth (visitor
 * stage) so we can attribute conversions all the way back.
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { marketingAttribution } from '../db/schema.js';
import { eq, sql, gte } from 'drizzle-orm';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const captureSchema = z.object({
  anonId: z.string().min(8).max(64),
  landingPath: z.string().max(500).optional(),
  referrer: z.string().max(500).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  gclid: z.string().max(200).optional(),
  fbclid: z.string().max(200).optional(),
  ttclid: z.string().max(200).optional(),
});

router.post('/capture', async (req, res) => {
  try {
    const data = captureSchema.parse(req.body);
    const ua = (req.headers['user-agent'] ?? '').toString().slice(0, 300);

    // Upsert by anonId — first capture wins, later visits update
    // landingPath only if blank.
    const existing = await db.select().from(marketingAttribution)
      .where(eq(marketingAttribution.anonId, data.anonId))
      .limit(1);

    if (existing.length > 0) {
      // Sticky first-touch: only update last_seen_at + count.
      await db.update(marketingAttribution).set({
        lastSeenAt: new Date(),
        visitCount: sql`${marketingAttribution.visitCount} + 1`,
      }).where(eq(marketingAttribution.anonId, data.anonId));
    } else {
      await db.insert(marketingAttribution).values({
        anonId: data.anonId,
        landingPath: data.landingPath ?? null,
        referrer: data.referrer ?? null,
        utmSource: data.utmSource ?? null,
        utmMedium: data.utmMedium ?? null,
        utmCampaign: data.utmCampaign ?? null,
        utmTerm: data.utmTerm ?? null,
        utmContent: data.utmContent ?? null,
        gclid: data.gclid ?? null,
        fbclid: data.fbclid ?? null,
        ttclid: data.ttclid ?? null,
        userAgent: ua,
        ip: req.ip ?? null,
      });
    }

    return res.json({ success: true });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[marketing-attribution capture]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Super-admin analytics: campaign performance. Auth-gated so competitors
// can't scrape the attribution funnel — these numbers are competitive
// intelligence (cost-per-acquisition by source).
router.get('/campaigns-summary', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    // Last 90 days by default.
    const days = Math.min(365, Math.max(7, Number(req.query.days ?? 90)));
    const since = new Date(Date.now() - days * 86400_000);

    const rows = await db.select({
      utmSource: marketingAttribution.utmSource,
      utmMedium: marketingAttribution.utmMedium,
      utmCampaign: marketingAttribution.utmCampaign,
      visits: sql<number>`COUNT(*)::int`,
      converted: sql<number>`COUNT(*) FILTER (WHERE ${marketingAttribution.convertedToVendorId} IS NOT NULL)::int`,
    })
      .from(marketingAttribution)
      .where(gte(marketingAttribution.firstSeenAt, since))
      .groupBy(marketingAttribution.utmSource, marketingAttribution.utmMedium, marketingAttribution.utmCampaign)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(50);

    return res.json(rows);
  } catch (e) {
    console.error('[marketing-attribution summary]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
