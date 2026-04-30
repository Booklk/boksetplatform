import { Router } from 'express';
import { db } from '../db/index.js';
import { bookings } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ─── Achievement definitions (mirrored from client) ───────────────────────────

interface AchievementDef {
  id: string;
  points: number;
  /** Function to determine unlock status from profile data */
  check: (profile: CustomerProfile) => { unlocked: boolean; currentCount: number; progress: number };
}

interface CustomerProfile {
  bookingCount: number;
  completedCount: number;
  hasRated5Stars: boolean;
  hasBirthdayBooking: boolean;
  hasReferral: boolean;
  hasSameDayComplete: boolean;
  consecutiveWeeks: number;
  firstBookingAt: Date | null;
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: 'first_wash',
    points: 25,
    check: (p) => ({
      unlocked: p.completedCount >= 1,
      currentCount: Math.min(p.completedCount, 1),
      progress: p.completedCount >= 1 ? 100 : 0,
    }),
  },
  {
    id: 'five_star',
    points: 10,
    check: (p) => ({
      unlocked: p.hasRated5Stars,
      currentCount: p.hasRated5Stars ? 1 : 0,
      progress: p.hasRated5Stars ? 100 : 0,
    }),
  },
  {
    id: 'regular',
    points: 50,
    check: (p) => ({
      unlocked: p.completedCount >= 3,
      currentCount: Math.min(p.completedCount, 3),
      progress: Math.round((Math.min(p.completedCount, 3) / 3) * 100),
    }),
  },
  {
    id: 'ten_bookings',
    points: 100,
    check: (p) => ({
      unlocked: p.completedCount >= 10,
      currentCount: Math.min(p.completedCount, 10),
      progress: Math.round((Math.min(p.completedCount, 10) / 10) * 100),
    }),
  },
  {
    id: 'schedule_king',
    points: 75,
    check: (p) => ({
      unlocked: p.consecutiveWeeks >= 4,
      currentCount: Math.min(p.consecutiveWeeks, 4),
      progress: Math.round((Math.min(p.consecutiveWeeks, 4) / 4) * 100),
    }),
  },
  {
    id: 'rain_wash',
    points: 30,
    check: (_p) => ({
      unlocked: false, // Requires external weather data
      currentCount: 0,
      progress: 0,
    }),
  },
  {
    id: 'gold',
    points: 200,
    check: (p) => ({
      unlocked: p.completedCount >= 25,
      currentCount: Math.min(p.completedCount, 25),
      progress: Math.round((Math.min(p.completedCount, 25) / 25) * 100),
    }),
  },
  {
    id: 'legend',
    points: 500,
    check: (p) => ({
      unlocked: p.completedCount >= 50,
      currentCount: Math.min(p.completedCount, 50),
      progress: Math.round((Math.min(p.completedCount, 50) / 50) * 100),
    }),
  },
  {
    id: 'vip',
    points: 1000,
    check: (p) => ({
      unlocked: p.completedCount >= 100,
      currentCount: Math.min(p.completedCount, 100),
      progress: Math.round((Math.min(p.completedCount, 100) / 100) * 100),
    }),
  },
  {
    id: 'birthday',
    points: 50,
    check: (p) => ({
      unlocked: p.hasBirthdayBooking,
      currentCount: p.hasBirthdayBooking ? 1 : 0,
      progress: p.hasBirthdayBooking ? 100 : 0,
    }),
  },
  {
    id: 'ambassador',
    points: 75,
    check: (p) => ({
      unlocked: p.hasReferral,
      currentCount: p.hasReferral ? 1 : 0,
      progress: p.hasReferral ? 100 : 0,
    }),
  },
  {
    id: 'lightning',
    points: 25,
    check: (p) => ({
      unlocked: p.hasSameDayComplete,
      currentCount: p.hasSameDayComplete ? 1 : 0,
      progress: p.hasSameDayComplete ? 100 : 0,
    }),
  },
];

// ─── Helper: build customer profile ──────────────────────────────────────────

async function buildProfile(customerId: number): Promise<CustomerProfile> {
  // Total bookings
  const allBookingsResult = await db
    .select({ id: bookings.id, status: bookings.status, scheduledAt: bookings.scheduledAt, rating: bookings.rating })
    .from(bookings)
    .where(eq(bookings.customerId, customerId));

  const completedBookings = allBookingsResult.filter((b) => b.status === 'completed');
  const completedCount = completedBookings.length;
  const bookingCount = allBookingsResult.length;

  const hasRated5Stars = completedBookings.some((b) => b.rating === 5);

  const hasSameDayComplete = completedBookings.some((b) => {
    const scheduled = new Date(b.scheduledAt);
    // Consider: if booking was created and completed in the same calendar day
    return true; // simplified — would need createdAt in real impl
  });

  // Consecutive weeks: simplified count
  const consecutiveWeeks = computeConsecutiveWeeks(completedBookings.map((b) => new Date(b.scheduledAt)));

  const firstBookingAt =
    allBookingsResult.length > 0
      ? new Date(Math.min(...allBookingsResult.map((b) => new Date(b.scheduledAt).getTime())))
      : null;

  // Birthday booking: compare booking month+day with user's birthday (not stored by default)
  const hasBirthdayBooking = false; // Would need DOB field

  return {
    bookingCount,
    completedCount,
    hasRated5Stars,
    hasBirthdayBooking,
    hasReferral: false, // Would need referral table
    hasSameDayComplete: completedCount > 0 && hasSameDayComplete,
    consecutiveWeeks,
    firstBookingAt,
  };
}

function computeConsecutiveWeeks(dates: Date[]): number {
  if (dates.length === 0) return 0;

  // Get ISO week numbers
  const getWeekKey = (d: Date) => {
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${d.getFullYear()}-${week}`;
  };

  const weekKeys = [...new Set(dates.map(getWeekKey))].sort();
  if (weekKeys.length === 0) return 0;

  let max = 1;
  let current = 1;

  for (let i = 1; i < weekKeys.length; i++) {
    const [y1, w1] = weekKeys[i - 1].split('-').map(Number);
    const [y2, w2] = weekKeys[i].split('-').map(Number);

    // Check if consecutive weeks
    const consecutive =
      (y2 === y1 && w2 === w1 + 1) || (y2 === y1 + 1 && w1 >= 52 && w2 === 1);

    if (consecutive) {
      current++;
      max = Math.max(max, current);
    } else {
      current = 1;
    }
  }

  return max;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/achievements/my
 * Returns list of achievements with unlocked status for the authenticated customer.
 */
router.get('/my', requireAuth, async (req: AuthRequest, res) => {
  try {
    const customerId = req.user!.id;
    const profile = await buildProfile(customerId);

    const results = ACHIEVEMENT_DEFS.map((def) => {
      const { unlocked, currentCount, progress } = def.check(profile);
      return {
        id: def.id,
        unlocked,
        currentCount,
        progress,
        unlockedAt: unlocked && profile.firstBookingAt ? profile.firstBookingAt.toISOString() : undefined,
      };
    });

    return res.json(results);
  } catch (e) {
    console.error('[achievements] error:', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
