import { Router } from 'express';
import { db } from '../db/index.js';
import { bookings, users, vendors } from '../db/schema.js';
import { eq, and, gte, lte, sql, count } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { sendRawWhatsAppMessage } from '../services/whatsapp.js';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function dayBounds(dateStr?: string): { start: Date; end: Date } {
  const base = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function buildWhatsAppMessage(data: {
  date: string;
  bookings: { total: number; completed: number; cancelled: number; pending: number; inProgress: number };
  revenue: { today: number; currency: string };
  avgRating: number | null;
  topEmployee: { name: string; completions: number } | null;
  vehiclesUsed: number;
  newCustomers: number;
  tomorrowBookings: number;
}): string {
  const ratingStr = data.avgRating != null ? `${data.avgRating.toFixed(1)}/5` : 'لا يوجد';
  const employeeStr = data.topEmployee
    ? `${data.topEmployee.name} (${data.topEmployee.completions} غسلة)`
    : 'لا يوجد';

  return (
    `📊 *ملخص يوم ${data.date}*\n\n` +
    `✅ الحجوزات: ${data.bookings.completed}/${data.bookings.total} مكتمل\n` +
    `💰 الدخل: ${data.revenue.today.toFixed(0)} ر.س\n` +
    `⭐ متوسط التقييم: ${ratingStr}\n` +
    `🏆 أفضل موظف: ${employeeStr}\n` +
    `🚗 سيارات عملت: ${data.vehiclesUsed}\n` +
    `📅 غداً: ${data.tomorrowBookings} حجز\n\n` +
    `_تقرير يومي تلقائي_`
  );
}

// ── GET /api/summary/daily?date=YYYY-MM-DD ────────────────────────────────────
router.get('/daily', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة' });

    const dateParam = req.query.date as string | undefined;
    const { start, end } = dayBounds(dateParam);
    const dateLabel = start.toISOString().slice(0, 10);

    // Tomorrow bounds
    const tomorrowStart = new Date(start);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const vf = eq(bookings.vendorId, vendorId);

    const [
      allTodayBookings,
      completedRows,
      cancelledCount,
      inProgressCount,
      revenueRow,
      avgRatingRow,
      employeeCompletions,
      vehicleRows,
      newCustomerCount,
      tomorrowCount,
    ] = await Promise.all([
      // 1. Total bookings today
      db.select({ count: count() })
        .from(bookings)
        .where(and(vf, gte(bookings.scheduledAt, start), lte(bookings.scheduledAt, end))),

      // 2. Completed today
      db.select({ count: count() })
        .from(bookings)
        .where(and(vf, eq(bookings.status, 'completed'), gte(bookings.updatedAt, start), lte(bookings.updatedAt, end))),

      // 3. Cancelled today
      db.select({ count: count() })
        .from(bookings)
        .where(and(vf, eq(bookings.status, 'cancelled'), gte(bookings.updatedAt, start), lte(bookings.updatedAt, end))),

      // 4. In progress right now
      db.select({ count: count() })
        .from(bookings)
        .where(and(vf, eq(bookings.status, 'in_progress'))),

      // 5. Revenue from completed today
      db.select({ total: sql<string>`COALESCE(SUM(${bookings.totalPrice}), 0)` })
        .from(bookings)
        .where(and(vf, eq(bookings.status, 'completed'), gte(bookings.updatedAt, start), lte(bookings.updatedAt, end))),

      // 6. Avg rating today
      db.select({ avg: sql<string>`ROUND(AVG(${bookings.rating}), 1)` })
        .from(bookings)
        .where(and(vf, sql`${bookings.rating} IS NOT NULL`, gte(bookings.updatedAt, start), lte(bookings.updatedAt, end))),

      // 7. Top employee — most completed today
      db.select({
        employeeId: bookings.employeeId,
        completions: count(),
        employeeName: users.name,
      })
        .from(bookings)
        .leftJoin(users, eq(bookings.employeeId, users.id))
        .where(and(vf, eq(bookings.status, 'completed'), gte(bookings.updatedAt, start), lte(bookings.updatedAt, end), sql`${bookings.employeeId} IS NOT NULL`))
        .groupBy(bookings.employeeId, users.name)
        .orderBy(sql`count(*) DESC`)
        .limit(1),

      // 8. Vehicles utilisation — distinct fleet vehicle IDs with bookings today
      db.select({ fleetVehicleId: bookings.fleetVehicleId })
        .from(bookings)
        .where(and(vf, sql`${bookings.fleetVehicleId} IS NOT NULL`, gte(bookings.scheduledAt, start), lte(bookings.scheduledAt, end))),

      // 9. New customers today (users created today belonging to this vendor with role 'customer')
      db.select({ count: count() })
        .from(users)
        .where(and(eq(users.vendorId, vendorId), eq(users.role, 'customer'), gte(users.createdAt, start), lte(users.createdAt, end))),

      // 10. Tomorrow's bookings count
      db.select({ count: count() })
        .from(bookings)
        .where(and(vf, gte(bookings.scheduledAt, tomorrowStart), lte(bookings.scheduledAt, tomorrowEnd))),
    ]);

    const total = allTodayBookings[0]?.count ?? 0;
    const completed = completedRows[0]?.count ?? 0;
    const cancelled = cancelledCount[0]?.count ?? 0;
    const inProgress = inProgressCount[0]?.count ?? 0;
    const pending = Math.max(0, total - completed - cancelled - inProgress);
    const revenue = parseFloat(revenueRow[0]?.total ?? '0');
    const avgRating = revenueRow[0] && avgRatingRow[0]?.avg ? parseFloat(avgRatingRow[0].avg) : null;
    const topEmployee = employeeCompletions[0]
      ? { name: employeeCompletions[0].employeeName ?? 'موظف', completions: employeeCompletions[0].completions }
      : null;
    // Count distinct vehicle IDs
    const uniqueVehicleIds = new Set(vehicleRows.map(r => r.fleetVehicleId).filter(Boolean));
    const vehiclesUsed = uniqueVehicleIds.size;
    const newCustomers = newCustomerCount[0]?.count ?? 0;
    const tomorrowBookings = tomorrowCount[0]?.count ?? 0;

    const summary = {
      date: dateLabel,
      bookings: { total, completed, cancelled, pending, inProgress },
      revenue: { today: revenue, currency: 'SAR' },
      avgRating,
      topEmployee,
      vehiclesUsed,
      newCustomers,
      tomorrowBookings,
      message: buildWhatsAppMessage({
        date: dateLabel,
        bookings: { total, completed, cancelled, pending, inProgress },
        revenue: { today: revenue, currency: 'SAR' },
        avgRating,
        topEmployee,
        vehiclesUsed,
        newCustomers,
        tomorrowBookings,
      }),
    };

    return res.json(summary);
  } catch (e) {
    console.error('[summary/daily]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── POST /api/summary/send-whatsapp ──────────────────────────────────────────
router.post('/send-whatsapp', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة' });

    // Get vendor phone
    const [vendor] = await db.select({ phone: vendors.phone })
      .from(vendors)
      .where(eq(vendors.id, vendorId));

    if (!vendor?.phone) {
      return res.status(400).json({ error: 'لا يوجد رقم هاتف مسجّل للمغسلة' });
    }

    // Build today's daily summary
    const { start, end } = dayBounds();
    const dateLabel = start.toISOString().slice(0, 10);
    const tomorrowStart = new Date(start);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const vf = eq(bookings.vendorId, vendorId);

    const [
      allTodayBookings,
      completedRows,
      cancelledCount,
      inProgressCount,
      revenueRow,
      avgRatingRow,
      employeeCompletions,
      vehicleRows,
      newCustomerCount,
      tomorrowCount,
    ] = await Promise.all([
      db.select({ count: count() }).from(bookings).where(and(vf, gte(bookings.scheduledAt, start), lte(bookings.scheduledAt, end))),
      db.select({ count: count() }).from(bookings).where(and(vf, eq(bookings.status, 'completed'), gte(bookings.updatedAt, start), lte(bookings.updatedAt, end))),
      db.select({ count: count() }).from(bookings).where(and(vf, eq(bookings.status, 'cancelled'), gte(bookings.updatedAt, start), lte(bookings.updatedAt, end))),
      db.select({ count: count() }).from(bookings).where(and(vf, eq(bookings.status, 'in_progress'))),
      db.select({ total: sql<string>`COALESCE(SUM(${bookings.totalPrice}), 0)` }).from(bookings).where(and(vf, eq(bookings.status, 'completed'), gte(bookings.updatedAt, start), lte(bookings.updatedAt, end))),
      db.select({ avg: sql<string>`ROUND(AVG(${bookings.rating}), 1)` }).from(bookings).where(and(vf, sql`${bookings.rating} IS NOT NULL`, gte(bookings.updatedAt, start), lte(bookings.updatedAt, end))),
      db.select({ employeeId: bookings.employeeId, completions: count(), employeeName: users.name })
        .from(bookings)
        .leftJoin(users, eq(bookings.employeeId, users.id))
        .where(and(vf, eq(bookings.status, 'completed'), gte(bookings.updatedAt, start), lte(bookings.updatedAt, end), sql`${bookings.employeeId} IS NOT NULL`))
        .groupBy(bookings.employeeId, users.name)
        .orderBy(sql`count(*) DESC`)
        .limit(1),
      db.select({ fleetVehicleId: bookings.fleetVehicleId }).from(bookings).where(and(vf, sql`${bookings.fleetVehicleId} IS NOT NULL`, gte(bookings.scheduledAt, start), lte(bookings.scheduledAt, end))),
      db.select({ count: count() }).from(users).where(and(eq(users.vendorId, vendorId), eq(users.role, 'customer'), gte(users.createdAt, start), lte(users.createdAt, end))),
      db.select({ count: count() }).from(bookings).where(and(vf, gte(bookings.scheduledAt, tomorrowStart), lte(bookings.scheduledAt, tomorrowEnd))),
    ]);

    const total = allTodayBookings[0]?.count ?? 0;
    const completed = completedRows[0]?.count ?? 0;
    const cancelled = cancelledCount[0]?.count ?? 0;
    const inProgress = inProgressCount[0]?.count ?? 0;
    const pending = Math.max(0, total - completed - cancelled - inProgress);
    const revenue = parseFloat(revenueRow[0]?.total ?? '0');
    const avgRating = avgRatingRow[0]?.avg ? parseFloat(avgRatingRow[0].avg) : null;
    const topEmployee = employeeCompletions[0]
      ? { name: employeeCompletions[0].employeeName ?? 'موظف', completions: employeeCompletions[0].completions }
      : null;
    const uniqueVehicleIds = new Set(vehicleRows.map(r => r.fleetVehicleId).filter(Boolean));
    const vehiclesUsed = uniqueVehicleIds.size;
    const newCustomers = newCustomerCount[0]?.count ?? 0;
    const tomorrowBookings = tomorrowCount[0]?.count ?? 0;

    const message = buildWhatsAppMessage({
      date: dateLabel,
      bookings: { total, completed, cancelled, pending, inProgress },
      revenue: { today: revenue, currency: 'SAR' },
      avgRating,
      topEmployee,
      vehiclesUsed,
      newCustomers,
      tomorrowBookings,
    });

    const sent = await sendRawWhatsAppMessage(vendor.phone, message);

    return res.json({ sent, phone: vendor.phone });
  } catch (e) {
    console.error('[summary/send-whatsapp]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
