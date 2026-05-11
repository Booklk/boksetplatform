/**
 * HR Suite v1 — leave requests + attendance.
 *
 * Vendor admin reviews requests; employees submit them. Attendance
 * uses one-row-per-shift (check-in opens, check-out closes).
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { leaveRequests, attendanceRecords, users } from '../db/schema.js';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function vendorScope(req: AuthRequest): number | null {
  return req.user?.vendorId ?? null;
}

function isAdmin(req: AuthRequest): boolean {
  const r = req.user?.role;
  return r === 'vendor_admin' || r === 'admin';
}

// ─── LEAVE REQUESTS ────────────────────────────────────────────────────────

router.get('/leave', async (req: AuthRequest, res) => {
  try {
    const vendorId = vendorScope(req);
    if (!vendorId) return res.status(403).json({ error: 'لا تنتمي لمتجر' });

    const mineOnly = !isAdmin(req);
    const rows = await db.select({
      id: leaveRequests.id,
      type: leaveRequests.type,
      status: leaveRequests.status,
      fromDate: leaveRequests.fromDate,
      toDate: leaveRequests.toDate,
      reason: leaveRequests.reason,
      reviewNote: leaveRequests.reviewNote,
      reviewedAt: leaveRequests.reviewedAt,
      createdAt: leaveRequests.createdAt,
      employeeId: leaveRequests.employeeId,
      employeeName: users.name,
    })
      .from(leaveRequests)
      .leftJoin(users, eq(users.id, leaveRequests.employeeId))
      .where(and(
        eq(leaveRequests.vendorId, vendorId),
        ...(mineOnly ? [eq(leaveRequests.employeeId, req.user!.id)] : []),
      ))
      .orderBy(desc(leaveRequests.createdAt));
    return res.json(rows);
  } catch (e) {
    console.error('[hr/leave list]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

const submitLeaveSchema = z.object({
  type: z.enum(['annual', 'sick', 'emergency', 'unpaid']),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
  reason: z.string().max(500).optional(),
});
router.post('/leave', async (req: AuthRequest, res) => {
  try {
    const vendorId = vendorScope(req);
    if (!vendorId) return res.status(403).json({ error: 'لا تنتمي لمتجر' });

    const data = submitLeaveSchema.parse(req.body);
    const fromDate = new Date(data.fromDate);
    const toDate = new Date(data.toDate);
    if (fromDate > toDate) {
      return res.status(400).json({ error: 'تاريخ البداية بعد النهاية' });
    }

    const [row] = await db.insert(leaveRequests).values({
      vendorId,
      employeeId: req.user!.id,
      type: data.type,
      fromDate,
      toDate,
      reason: data.reason ?? null,
      status: 'pending',
    }).returning();
    return res.status(201).json(row);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[hr/leave post]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

const reviewLeaveSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled']),
  reviewNote: z.string().max(500).optional(),
});
router.patch('/leave/:id', async (req: AuthRequest, res) => {
  try {
    const vendorId = vendorScope(req);
    if (!vendorId) return res.status(403).json({ error: 'لا تنتمي لمتجر' });
    const id = Number(req.params.id);
    const data = reviewLeaveSchema.parse(req.body);

    const [existing] = await db.select().from(leaveRequests)
      .where(and(eq(leaveRequests.id, id), eq(leaveRequests.vendorId, vendorId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'الطلب غير موجود' });

    // Employees can only cancel their own pending requests.
    if (!isAdmin(req)) {
      if (existing.employeeId !== req.user!.id) return res.status(403).json({ error: 'غير مصرح' });
      if (data.status !== 'cancelled') return res.status(403).json({ error: 'يمكنك فقط إلغاء طلبك' });
      if (existing.status !== 'pending') return res.status(400).json({ error: 'هذا الطلب لا يمكن تعديله' });
    }

    const [updated] = await db.update(leaveRequests)
      .set({
        status: data.status,
        reviewNote: data.reviewNote ?? null,
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      })
      .where(eq(leaveRequests.id, id))
      .returning();
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[hr/leave patch]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── ATTENDANCE ────────────────────────────────────────────────────────────

router.get('/attendance/me/today', async (req: AuthRequest, res) => {
  try {
    const vendorId = vendorScope(req);
    if (!vendorId) return res.status(403).json({ error: 'لا تنتمي لمتجر' });

    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [open] = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.vendorId, vendorId),
        eq(attendanceRecords.employeeId, req.user!.id),
        sql`${attendanceRecords.checkInAt} >= ${start}`,
      ))
      .orderBy(desc(attendanceRecords.checkInAt))
      .limit(1);
    return res.json({ active: open ?? null });
  } catch (e) {
    console.error('[hr/attendance today]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

const checkInSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  notes: z.string().max(300).optional(),
});
router.post('/attendance/check-in', async (req: AuthRequest, res) => {
  try {
    const vendorId = vendorScope(req);
    if (!vendorId) return res.status(403).json({ error: 'لا تنتمي لمتجر' });

    const data = checkInSchema.parse(req.body ?? {});

    // If there's an open shift today, return that instead of duplicating.
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [open] = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.vendorId, vendorId),
        eq(attendanceRecords.employeeId, req.user!.id),
        isNull(attendanceRecords.checkOutAt),
        sql`${attendanceRecords.checkInAt} >= ${start}`,
      ))
      .limit(1);
    if (open) return res.json({ alreadyOpen: true, record: open });

    const [row] = await db.insert(attendanceRecords).values({
      vendorId,
      employeeId: req.user!.id,
      checkInAt: new Date(),
      checkInLat: data.lat !== undefined ? String(data.lat) : null,
      checkInLng: data.lng !== undefined ? String(data.lng) : null,
      notes: data.notes ?? null,
    }).returning();
    return res.status(201).json({ alreadyOpen: false, record: row });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[hr/attendance check-in]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.post('/attendance/check-out', async (req: AuthRequest, res) => {
  try {
    const vendorId = vendorScope(req);
    if (!vendorId) return res.status(403).json({ error: 'لا تنتمي لمتجر' });

    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [open] = await db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.vendorId, vendorId),
        eq(attendanceRecords.employeeId, req.user!.id),
        isNull(attendanceRecords.checkOutAt),
        sql`${attendanceRecords.checkInAt} >= ${start}`,
      ))
      .limit(1);
    if (!open) return res.status(404).json({ error: 'لا يوجد دوام مفتوح اليوم' });

    const [updated] = await db.update(attendanceRecords)
      .set({ checkOutAt: new Date() })
      .where(eq(attendanceRecords.id, open.id))
      .returning();
    return res.json(updated);
  } catch (e) {
    console.error('[hr/attendance check-out]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin-only: full attendance log for the team.
router.get('/attendance', async (req: AuthRequest, res) => {
  try {
    const vendorId = vendorScope(req);
    if (!vendorId) return res.status(403).json({ error: 'لا تنتمي لمتجر' });
    if (!isAdmin(req)) return res.status(403).json({ error: 'للمديرين فقط' });

    const days = Math.min(90, Math.max(1, Number(req.query.days ?? 30)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db.select({
      id: attendanceRecords.id,
      employeeId: attendanceRecords.employeeId,
      employeeName: users.name,
      checkInAt: attendanceRecords.checkInAt,
      checkOutAt: attendanceRecords.checkOutAt,
      notes: attendanceRecords.notes,
    })
      .from(attendanceRecords)
      .leftJoin(users, eq(users.id, attendanceRecords.employeeId))
      .where(and(
        eq(attendanceRecords.vendorId, vendorId),
        sql`${attendanceRecords.checkInAt} >= ${since}`,
      ))
      .orderBy(desc(attendanceRecords.checkInAt))
      .limit(500);
    return res.json(rows);
  } catch (e) {
    console.error('[hr/attendance list]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
