import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  customerSegments,
  customerSegmentMembers,
  customerScores,
  customers,
  bookings,
  payments,
  users,
} from '../db/schema.js';
import { eq, and, desc, sql, gte, lte, gt, lt, count, avg, sum } from 'drizzle-orm';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';

const router = Router();

// ─── ZOD SCHEMAS ─────────────────────────────────────────────────────────────

const segmentRuleSchema = z.object({
  field: z.enum([
    'totalSpend', 'bookingCount', 'lastBookingDaysAgo',
    'avgRating', 'churnRisk', 'ltvEstimate', 'score',
  ]),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'between']),
  value: z.union([z.number(), z.tuple([z.number(), z.number()])]),
});

const segmentCriteriaSchema = z.object({
  rules: z.array(segmentRuleSchema).min(1, 'يجب إضافة قاعدة واحدة على الأقل'),
  logic: z.enum(['and', 'or']),
});

const createSegmentSchema = z.object({
  name: z.string().min(2, 'اسم الشريحة قصير جداً').max(255),
  nameAr: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
  criteria: segmentCriteriaSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'لون غير صالح').optional(),
});

const updateSegmentSchema = createSegmentSchema.partial();

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Evaluate a single rule against a customer score row.
 */
function evaluateRule(
  rule: { field: string; operator: string; value: number | [number, number] },
  scoreRow: Record<string, unknown>,
): boolean {
  const fieldMap: Record<string, string> = {
    totalSpend: 'totalSpend',
    bookingCount: 'bookingCount',
    lastBookingDaysAgo: 'daysSinceLastBooking',
    avgRating: 'avgRating',
    churnRisk: 'churnRisk',
    ltvEstimate: 'ltvEstimate',
    score: 'score',
  };

  const rawVal = scoreRow[fieldMap[rule.field] ?? rule.field];
  const fieldValue = typeof rawVal === 'string' ? parseFloat(rawVal) : Number(rawVal ?? 0);

  if (rule.operator === 'between') {
    const [lo, hi] = rule.value as [number, number];
    return fieldValue >= lo && fieldValue <= hi;
  }

  const target = rule.value as number;
  switch (rule.operator) {
    case 'gt':  return fieldValue > target;
    case 'gte': return fieldValue >= target;
    case 'lt':  return fieldValue < target;
    case 'lte': return fieldValue <= target;
    case 'eq':  return fieldValue === target;
    default:    return false;
  }
}

/**
 * Evaluate all rules in a segment's criteria against a score row.
 */
function evaluateCriteria(
  criteria: { rules: Array<{ field: string; operator: string; value: number | [number, number] }>; logic: 'and' | 'or' },
  scoreRow: Record<string, unknown>,
): boolean {
  if (criteria.logic === 'and') {
    return criteria.rules.every(rule => evaluateRule(rule, scoreRow));
  }
  return criteria.rules.some(rule => evaluateRule(rule, scoreRow));
}

/**
 * Calculate segment members for a given segment and update the DB.
 */
async function calculateSegmentMembers(
  segmentId: number,
  vendorId: number,
  criteria: { rules: Array<{ field: string; operator: string; value: number | [number, number] }>; logic: 'and' | 'or' },
): Promise<number> {
  // Fetch all customer scores for this vendor
  const scores = await db
    .select()
    .from(customerScores)
    .where(eq(customerScores.vendorId, vendorId));

  // Evaluate which customers match
  const matchingCustomerIds = scores
    .filter(s => evaluateCriteria(criteria, s as unknown as Record<string, unknown>))
    .map(s => s.customerId);

  // Clear existing members
  await db.delete(customerSegmentMembers)
    .where(eq(customerSegmentMembers.segmentId, segmentId));

  // Insert new members
  if (matchingCustomerIds.length > 0) {
    await db.insert(customerSegmentMembers).values(
      matchingCustomerIds.map(customerId => ({
        segmentId,
        customerId,
      })),
    );
  }

  // Update count & timestamp on the segment
  await db.update(customerSegments)
    .set({
      customerCount: matchingCustomerIds.length,
      lastCalculatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(customerSegments.id, segmentId));

  return matchingCustomerIds.length;
}

// ─── 1. GET / — List all segments for this vendor ────────────────────────────

router.get('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;

    const segments = await db
      .select()
      .from(customerSegments)
      .where(eq(customerSegments.vendorId, vendorId))
      .orderBy(desc(customerSegments.createdAt));

    return res.json(segments);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── 2. POST / — Create segment ─────────────────────────────────────────────

router.post('/', requireAuth, requireRole('vendor_admin', 'admin'), audit('segment.create'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const data = createSegmentSchema.parse(req.body);

    const [segment] = await db.insert(customerSegments).values({
      vendorId,
      name: data.name,
      nameAr: data.nameAr ?? null,
      description: data.description ?? null,
      criteria: data.criteria,
      color: data.color ?? '#3b82f6',
    }).returning();

    // Immediately calculate members
    const memberCount = await calculateSegmentMembers(segment.id, vendorId, data.criteria);

    return res.status(201).json({
      ...segment,
      customerCount: memberCount,
      message: `تم إنشاء الشريحة وتصنيف ${memberCount} عميل`,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في إنشاء الشريحة' });
  }
});

// ─── 3. GET /:id — Get segment with paginated member list ────────────────────

router.get('/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const segmentId = parseInt(req.params.id);
    if (isNaN(segmentId)) return res.status(400).json({ error: 'معرّف الشريحة غير صالح' });

    const [segment] = await db
      .select()
      .from(customerSegments)
      .where(and(
        eq(customerSegments.id, segmentId),
        eq(customerSegments.vendorId, vendorId),
      ))
      .limit(1);

    if (!segment) return res.status(404).json({ error: 'الشريحة غير موجودة' });

    // Pagination
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    // Get members with customer info (join through customers -> users)
    const members = await db
      .select({
        memberId: customerSegmentMembers.id,
        customerId: customerSegmentMembers.customerId,
        addedAt: customerSegmentMembers.addedAt,
        customerName: users.name,
        customerPhone: users.phone,
      })
      .from(customerSegmentMembers)
      .innerJoin(customers, eq(customerSegmentMembers.customerId, customers.id))
      .innerJoin(users, eq(customers.userId, users.id))
      .where(eq(customerSegmentMembers.segmentId, segmentId))
      .orderBy(desc(customerSegmentMembers.addedAt))
      .limit(limit)
      .offset(offset);

    // Total count for pagination
    const [{ total }] = await db
      .select({ total: count() })
      .from(customerSegmentMembers)
      .where(eq(customerSegmentMembers.segmentId, segmentId));

    return res.json({
      segment,
      members,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في جلب بيانات الشريحة' });
  }
});

// ─── 4. PUT /:id — Update segment ───────────────────────────────────────────

router.put('/:id', requireAuth, requireRole('vendor_admin', 'admin'), audit('segment.update'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const segmentId = parseInt(req.params.id);
    if (isNaN(segmentId)) return res.status(400).json({ error: 'معرّف الشريحة غير صالح' });

    const data = updateSegmentSchema.parse(req.body);

    // Verify ownership
    const [existing] = await db
      .select()
      .from(customerSegments)
      .where(and(
        eq(customerSegments.id, segmentId),
        eq(customerSegments.vendorId, vendorId),
      ))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'الشريحة غير موجودة أو لا تتبع مغسلتك' });

    const [updated] = await db.update(customerSegments)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.nameAr !== undefined && { nameAr: data.nameAr }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.criteria !== undefined && { criteria: data.criteria }),
        ...(data.color !== undefined && { color: data.color }),
        updatedAt: new Date(),
      })
      .where(eq(customerSegments.id, segmentId))
      .returning();

    // If criteria changed, recalculate members
    if (data.criteria) {
      const memberCount = await calculateSegmentMembers(segmentId, vendorId, data.criteria);
      return res.json({
        ...updated,
        customerCount: memberCount,
        message: `تم تحديث الشريحة وإعادة تصنيف ${memberCount} عميل`,
      });
    }

    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في تحديث الشريحة' });
  }
});

// ─── 5. DELETE /:id — Delete segment + members (cascade) ────────────────────

router.delete('/:id', requireAuth, requireRole('vendor_admin', 'admin'), audit('segment.delete'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const segmentId = parseInt(req.params.id);
    if (isNaN(segmentId)) return res.status(400).json({ error: 'معرّف الشريحة غير صالح' });

    // Verify ownership
    const [existing] = await db
      .select({ id: customerSegments.id })
      .from(customerSegments)
      .where(and(
        eq(customerSegments.id, segmentId),
        eq(customerSegments.vendorId, vendorId),
      ))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'الشريحة غير موجودة أو لا تتبع مغسلتك' });

    // Members cascade-delete via FK, but explicit delete for safety
    await db.delete(customerSegmentMembers)
      .where(eq(customerSegmentMembers.segmentId, segmentId));

    await db.delete(customerSegments)
      .where(eq(customerSegments.id, segmentId));

    return res.json({ message: 'تم حذف الشريحة بنجاح' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في حذف الشريحة' });
  }
});

// ─── 6. POST /recalculate — Recalculate ALL segments for this vendor ────────

router.post('/recalculate', requireAuth, requireRole('vendor_admin', 'admin'), audit('segment.recalculate_all'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;

    const segments = await db
      .select()
      .from(customerSegments)
      .where(and(
        eq(customerSegments.vendorId, vendorId),
        eq(customerSegments.isActive, true),
      ));

    if (segments.length === 0) {
      return res.json({ message: 'لا توجد شرائح لإعادة حسابها', results: [] });
    }

    const results: Array<{ segmentId: number; name: string; memberCount: number }> = [];

    for (const seg of segments) {
      const criteria = seg.criteria as {
        rules: Array<{ field: string; operator: string; value: number | [number, number] }>;
        logic: 'and' | 'or';
      };
      const memberCount = await calculateSegmentMembers(seg.id, vendorId, criteria);
      results.push({ segmentId: seg.id, name: seg.name, memberCount });
    }

    const totalCustomers = results.reduce((sum, r) => sum + r.memberCount, 0);
    return res.json({
      message: `تم إعادة حساب ${segments.length} شريحة وتصنيف ${totalCustomers} عميل`,
      results,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في إعادة حساب الشرائح' });
  }
});

// ─── 7. GET /scores — List customer scores ──────────────────────────────────

router.get('/scores', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;

    // Build filters
    const conditions = [eq(customerScores.vendorId, vendorId)];

    const tierFilter = req.query.tier as string | undefined;
    if (tierFilter && ['platinum', 'gold', 'silver', 'bronze'].includes(tierFilter)) {
      conditions.push(eq(customerScores.tier, tierFilter));
    }

    const minScore = parseInt(req.query.minScore as string);
    if (!isNaN(minScore)) {
      conditions.push(gte(customerScores.score, minScore));
    }

    const maxScore = parseInt(req.query.maxScore as string);
    if (!isNaN(maxScore)) {
      conditions.push(lte(customerScores.score, maxScore));
    }

    const scores = await db
      .select({
        id: customerScores.id,
        customerId: customerScores.customerId,
        customerName: users.name,
        customerPhone: users.phone,
        totalSpend: customerScores.totalSpend,
        bookingCount: customerScores.bookingCount,
        avgRating: customerScores.avgRating,
        lastBookingAt: customerScores.lastBookingAt,
        daysSinceLastBooking: customerScores.daysSinceLastBooking,
        avgBookingFrequencyDays: customerScores.avgBookingFrequencyDays,
        churnRisk: customerScores.churnRisk,
        ltvEstimate: customerScores.ltvEstimate,
        score: customerScores.score,
        tier: customerScores.tier,
        updatedAt: customerScores.updatedAt,
      })
      .from(customerScores)
      .innerJoin(customers, eq(customerScores.customerId, customers.id))
      .innerJoin(users, eq(customers.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(customerScores.score));

    return res.json(scores);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في جلب تقييمات العملاء' });
  }
});

// ─── 8. POST /scores/recalculate — Recalculate all customer scores ──────────

router.post('/scores/recalculate', requireAuth, requireRole('vendor_admin', 'admin'), audit('scores.recalculate'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;

    // Get all customers for this vendor
    const vendorCustomers = await db
      .select({
        customerId: customers.id,
        userId: customers.userId,
      })
      .from(customers)
      .where(eq(customers.vendorId, vendorId));

    if (vendorCustomers.length === 0) {
      return res.json({ message: 'لا يوجد عملاء لحساب تقييماتهم', processed: 0 });
    }

    let processed = 0;
    const now = new Date();

    for (const customer of vendorCustomers) {
      // ── Aggregate booking data ───────────────────────────────────────────
      const [bookingAgg] = await db
        .select({
          totalBookings: count(),
          totalSpend: sql<string>`COALESCE(SUM(CAST(${bookings.totalPrice} AS DECIMAL(12,2))), 0)`,
          avgRating: sql<string>`COALESCE(AVG(${bookings.rating}), 0)`,
          lastBookingAt: sql<Date | null>`MAX(${bookings.scheduledAt})`,
          firstBookingAt: sql<Date | null>`MIN(${bookings.scheduledAt})`,
        })
        .from(bookings)
        .where(and(
          eq(bookings.vendorId, vendorId),
          eq(bookings.customerId, customer.userId),
          eq(bookings.status, 'completed'),
        ));

      const totalBookings = Number(bookingAgg.totalBookings ?? 0);
      const totalSpend = parseFloat(String(bookingAgg.totalSpend ?? '0'));
      const avgRatingVal = parseFloat(String(bookingAgg.avgRating ?? '0'));
      const lastBookingAt = bookingAgg.lastBookingAt ? new Date(bookingAgg.lastBookingAt) : null;
      const firstBookingAt = bookingAgg.firstBookingAt ? new Date(bookingAgg.firstBookingAt) : null;

      // ── Days since last booking ──────────────────────────────────────────
      const daysSinceLastBooking = lastBookingAt
        ? Math.floor((now.getTime() - lastBookingAt.getTime()) / (1000 * 60 * 60 * 24))
        : 365; // default high value for never-visited

      // ── Average booking frequency (days between visits) ──────────────────
      let avgFrequencyDays = 0;
      if (totalBookings >= 2 && firstBookingAt && lastBookingAt) {
        const spanDays = Math.max(1, Math.floor(
          (lastBookingAt.getTime() - firstBookingAt.getTime()) / (1000 * 60 * 60 * 24),
        ));
        avgFrequencyDays = parseFloat((spanDays / (totalBookings - 1)).toFixed(1));
      } else if (totalBookings === 1 && firstBookingAt) {
        // Single booking: use days since that booking as proxy
        avgFrequencyDays = daysSinceLastBooking;
      }

      // ── Churn risk (0.0 to 1.0) ─────────────────────────────────────────
      // Higher when days since last booking greatly exceeds avg frequency
      let churnRisk = 0;
      if (totalBookings === 0) {
        churnRisk = 1.0; // never booked = maximum risk
      } else if (avgFrequencyDays > 0) {
        // Ratio of inactivity to expected frequency, capped at 1.0
        // If they usually come every 14 days but it's been 42 days, ratio = 3.0
        // Sigmoid-like transform: risk = 1 - (1 / (1 + e^(ratio - 2)))
        const ratio = daysSinceLastBooking / avgFrequencyDays;
        churnRisk = Math.min(1.0, Math.max(0, 1 - (1 / (1 + Math.exp(ratio - 2)))));
      } else {
        // Edge case: avg frequency unknown, use days since last booking
        churnRisk = Math.min(1.0, daysSinceLastBooking / 90); // 90 days = full risk
      }
      churnRisk = parseFloat(churnRisk.toFixed(4));

      // ── LTV estimate (12-month projection) ──────────────────────────────
      let ltvEstimate = 0;
      if (totalBookings >= 1 && firstBookingAt) {
        const customerLifespanDays = Math.max(1,
          Math.floor((now.getTime() - firstBookingAt.getTime()) / (1000 * 60 * 60 * 24)),
        );
        const monthlySpend = (totalSpend / customerLifespanDays) * 30;
        ltvEstimate = parseFloat((monthlySpend * 12).toFixed(2));
      }

      // ── Composite score (0-100) ─────────────────────────────────────────
      // Weights: spend 30%, frequency 25%, recency 25%, rating 20%

      // Spend score (0-100): normalize against a reasonable ceiling
      // Use log scale so differences at low spend still matter
      const spendScore = totalSpend > 0
        ? Math.min(100, (Math.log10(totalSpend + 1) / Math.log10(10001)) * 100)
        : 0;

      // Frequency score (0-100): more bookings = higher score
      const frequencyScore = Math.min(100, (totalBookings / 50) * 100);

      // Recency score (0-100): recent = high, old = low
      // 0 days ago = 100, 90+ days = 0
      const recencyScore = Math.max(0, Math.min(100, 100 - (daysSinceLastBooking / 90) * 100));

      // Rating score (0-100): direct mapping from 0-5 to 0-100
      const ratingScore = avgRatingVal > 0 ? (avgRatingVal / 5) * 100 : 50; // default 50 if no rating

      const compositeScore = Math.round(
        spendScore * 0.30 +
        frequencyScore * 0.25 +
        recencyScore * 0.25 +
        ratingScore * 0.20,
      );
      const finalScore = Math.max(0, Math.min(100, compositeScore));

      // ── Tier assignment ──────────────────────────────────────────────────
      let tier: string;
      if (finalScore >= 90) tier = 'platinum';
      else if (finalScore >= 70) tier = 'gold';
      else if (finalScore >= 40) tier = 'silver';
      else tier = 'bronze';

      // ── Upsert into customerScores ───────────────────────────────────────
      const existing = await db
        .select({ id: customerScores.id })
        .from(customerScores)
        .where(and(
          eq(customerScores.vendorId, vendorId),
          eq(customerScores.customerId, customer.customerId),
        ))
        .limit(1);

      const scoreData = {
        vendorId,
        customerId: customer.customerId,
        totalSpend: totalSpend.toFixed(2),
        bookingCount: totalBookings,
        avgRating: avgRatingVal.toFixed(2),
        lastBookingAt: lastBookingAt ?? null,
        daysSinceLastBooking,
        avgBookingFrequencyDays: avgFrequencyDays.toFixed(1),
        churnRisk: churnRisk.toFixed(4),
        ltvEstimate: ltvEstimate.toFixed(2),
        score: finalScore,
        tier,
        updatedAt: new Date(),
      };

      if (existing.length > 0) {
        await db.update(customerScores)
          .set(scoreData)
          .where(eq(customerScores.id, existing[0].id));
      } else {
        await db.insert(customerScores).values(scoreData);
      }

      processed++;
    }

    return res.json({
      message: `تم حساب تقييمات ${processed} عميل بنجاح`,
      processed,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في حساب تقييمات العملاء' });
  }
});

export default router;
