import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { employeeShifts, users } from '../db/schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ── GET /shifts?week=YYYY-MM-DD — weekly view (vendor-scoped) ────────────────
router.get('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const weekParam = req.query.week as string | undefined;

    let weekStart: Date;
    if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
      weekStart = new Date(weekParam + 'T00:00:00.000Z');
    } else {
      weekStart = new Date();
      weekStart.setUTCHours(0, 0, 0, 0);
    }

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const shifts = await db
      .select({
        id: employeeShifts.id,
        vendorId: employeeShifts.vendorId,
        employeeId: employeeShifts.employeeId,
        employeeName: users.name,
        employeePhone: users.phone,
        date: employeeShifts.date,
        startTime: employeeShifts.startTime,
        endTime: employeeShifts.endTime,
        shiftType: employeeShifts.shiftType,
        notes: employeeShifts.notes,
        status: employeeShifts.status,
        createdBy: employeeShifts.createdBy,
        createdAt: employeeShifts.createdAt,
        updatedAt: employeeShifts.updatedAt,
      })
      .from(employeeShifts)
      .leftJoin(users, eq(employeeShifts.employeeId, users.id))
      .where(
        and(
          eq(employeeShifts.vendorId, vendorId),
          gte(employeeShifts.date, weekStart),
          lte(employeeShifts.date, weekEnd),
        )
      )
      .orderBy(employeeShifts.date, users.name);

    return res.json(shifts);
  } catch (e) {
    console.error('[GET /shifts]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── POST /shifts — create a shift ────────────────────────────────────────────
router.post('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const userId = req.user!.id;

    const schema = z.object({
      employeeId: z.number().int().positive(),
      date: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'تاريخ غير صالح' }),
      startTime: z.string().regex(/^\d{2}:\d{2}$/, 'وقت البدء غير صالح'),
      endTime: z.string().regex(/^\d{2}:\d{2}$/, 'وقت الانتهاء غير صالح'),
      shiftType: z.enum(['regular', 'overtime', 'off']).optional().default('regular'),
      notes: z.string().max(500).optional(),
    });

    const data = schema.parse(req.body);

    // Verify employee belongs to vendor
    const [employee] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, data.employeeId), eq(users.vendorId, vendorId)))
      .limit(1);

    if (!employee) {
      return res.status(404).json({ error: 'الموظف غير موجود' });
    }

    const [shift] = await db
      .insert(employeeShifts)
      .values({
        vendorId,
        employeeId: data.employeeId,
        date: new Date(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        shiftType: data.shiftType,
        notes: data.notes ?? null,
        status: 'scheduled',
        createdBy: userId,
      })
      .returning();

    return res.status(201).json(shift);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0].message });
    }
    console.error('[POST /shifts]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── PATCH /shifts/:id — update a shift ───────────────────────────────────────
router.patch('/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const shiftId = Number(req.params.id);

    if (isNaN(shiftId)) {
      return res.status(400).json({ error: 'معرف غير صالح' });
    }

    const schema = z.object({
      startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      shiftType: z.enum(['regular', 'overtime', 'off']).optional(),
      notes: z.string().max(500).nullable().optional(),
      status: z.enum(['scheduled', 'completed', 'absent', 'cancelled']).optional(),
    });

    const data = schema.parse(req.body);

    // Ownership check
    const [existing] = await db
      .select({ id: employeeShifts.id })
      .from(employeeShifts)
      .where(and(eq(employeeShifts.id, shiftId), eq(employeeShifts.vendorId, vendorId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'الوردية غير موجودة' });
    }

    const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
    if (data.startTime !== undefined) updatePayload.startTime = data.startTime;
    if (data.endTime !== undefined) updatePayload.endTime = data.endTime;
    if (data.shiftType !== undefined) updatePayload.shiftType = data.shiftType;
    if (data.notes !== undefined) updatePayload.notes = data.notes;
    if (data.status !== undefined) updatePayload.status = data.status;

    const [updated] = await db
      .update(employeeShifts)
      .set(updatePayload)
      .where(eq(employeeShifts.id, shiftId))
      .returning();

    return res.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0].message });
    }
    console.error('[PATCH /shifts/:id]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── DELETE /shifts/:id — delete a shift ──────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const shiftId = Number(req.params.id);

    if (isNaN(shiftId)) {
      return res.status(400).json({ error: 'معرف غير صالح' });
    }

    const [existing] = await db
      .select({ id: employeeShifts.id })
      .from(employeeShifts)
      .where(and(eq(employeeShifts.id, shiftId), eq(employeeShifts.vendorId, vendorId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'الوردية غير موجودة' });
    }

    await db.delete(employeeShifts).where(eq(employeeShifts.id, shiftId));

    return res.json({ success: true });
  } catch (e) {
    console.error('[DELETE /shifts/:id]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── GET /shifts/employee/:employeeId?month=X&year=Y — monthly history ────────
router.get('/employee/:employeeId', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const employeeId = Number(req.params.employeeId);

    if (isNaN(employeeId)) {
      return res.status(400).json({ error: 'معرف الموظف غير صالح' });
    }

    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    if (month < 1 || month > 12 || isNaN(month) || isNaN(year)) {
      return res.status(400).json({ error: 'الشهر أو السنة غير صالح' });
    }

    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 1));

    // Verify employee belongs to vendor
    const [employee] = await db
      .select({ id: users.id, name: users.name, phone: users.phone })
      .from(users)
      .where(and(eq(users.id, employeeId), eq(users.vendorId, vendorId)))
      .limit(1);

    if (!employee) {
      return res.status(404).json({ error: 'الموظف غير موجود' });
    }

    const shifts = await db
      .select()
      .from(employeeShifts)
      .where(
        and(
          eq(employeeShifts.vendorId, vendorId),
          eq(employeeShifts.employeeId, employeeId),
          gte(employeeShifts.date, startOfMonth),
          lte(employeeShifts.date, endOfMonth),
        )
      )
      .orderBy(employeeShifts.date);

    // Summary stats
    const stats = {
      total: shifts.length,
      regular: shifts.filter((s) => s.shiftType === 'regular').length,
      overtime: shifts.filter((s) => s.shiftType === 'overtime').length,
      off: shifts.filter((s) => s.shiftType === 'off').length,
      completed: shifts.filter((s) => s.status === 'completed').length,
      absent: shifts.filter((s) => s.status === 'absent').length,
      scheduled: shifts.filter((s) => s.status === 'scheduled').length,
    };

    return res.json({ employee, shifts, stats, month, year });
  } catch (e) {
    console.error('[GET /shifts/employee/:id]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
