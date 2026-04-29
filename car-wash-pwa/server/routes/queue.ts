import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  queueSessions,
  queueTickets,
  vendors,
} from '../db/schema.js';
import { eq, and, desc, asc, count } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

const AVG_SERVICE_TIME_MINUTES = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getOrCreateSession(vendorId: number, date: string) {
  const [existing] = await db
    .select()
    .from(queueSessions)
    .where(and(eq(queueSessions.vendorId, vendorId), eq(queueSessions.date, date)))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(queueSessions)
    .values({ vendorId, date, isOpen: true })
    .returning();

  return created;
}

// ─── GET /api/queue/current  (public — no auth) ───────────────────────────────
router.get('/current', async (req, res) => {
  try {
    const { vendorId, slug } = req.query as { vendorId?: string; slug?: string };

    let resolvedVendorId: number | null = null;

    if (vendorId) {
      resolvedVendorId = Number(vendorId);
    } else if (slug) {
      const [vendor] = await db
        .select({ id: vendors.id })
        .from(vendors)
        .where(eq(vendors.slug, slug as string))
        .limit(1);
      if (vendor) resolvedVendorId = vendor.id;
    }

    if (!resolvedVendorId) {
      return res.status(400).json({ error: 'vendorId or slug required' });
    }

    const today = todayStr();
    const [session] = await db
      .select()
      .from(queueSessions)
      .where(
        and(eq(queueSessions.vendorId, resolvedVendorId), eq(queueSessions.date, today))
      )
      .limit(1);

    if (!session) {
      return res.json({
        isOpen: false,
        currentNumber: 0,
        waitingCount: 0,
        totalServed: 0,
      });
    }

    const [{ waitingCount }] = await db
      .select({ waitingCount: count() })
      .from(queueTickets)
      .where(
        and(
          eq(queueTickets.sessionId, session.id),
          eq(queueTickets.status, 'waiting')
        )
      );

    // Last 5 completed
    const recentCompleted = await db
      .select({
        ticketNumber: queueTickets.ticketNumber,
        customerName: queueTickets.customerName,
        completedAt: queueTickets.completedAt,
      })
      .from(queueTickets)
      .where(
        and(
          eq(queueTickets.sessionId, session.id),
          eq(queueTickets.status, 'completed')
        )
      )
      .orderBy(desc(queueTickets.completedAt))
      .limit(5);

    return res.json({
      isOpen: session.isOpen,
      currentNumber: session.currentNumber,
      waitingCount: Number(waitingCount),
      totalServed: session.totalServed,
      estimatedWaitMinutes: Number(waitingCount) * AVG_SERVICE_TIME_MINUTES,
      recentCompleted,
    });
  } catch (e) {
    console.error('[queue/current]', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/queue/session/today  (auth) ─────────────────────────────────────
router.get('/session/today', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'No vendor' });

    const today = todayStr();
    const session = await getOrCreateSession(vendorId, today);

    const tickets = await db
      .select()
      .from(queueTickets)
      .where(eq(queueTickets.sessionId, session.id))
      .orderBy(asc(queueTickets.ticketNumber));

    const [{ waitingCount }] = await db
      .select({ waitingCount: count() })
      .from(queueTickets)
      .where(
        and(
          eq(queueTickets.sessionId, session.id),
          eq(queueTickets.status, 'waiting')
        )
      );

    return res.json({
      session,
      tickets,
      waitingCount: Number(waitingCount),
      estimatedWaitMinutes: Number(waitingCount) * AVG_SERVICE_TIME_MINUTES,
    });
  } catch (e) {
    console.error('[queue/session/today]', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/queue/session/open  (vendor_admin/admin/employee) ──────────────
router.post(
  '/session/open',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'employee'),
  async (req: AuthRequest, res) => {
    try {
      const vendorId = req.user!.vendorId;
      if (!vendorId) return res.status(403).json({ error: 'No vendor' });

      const today = todayStr();
      const [existing] = await db
        .select()
        .from(queueSessions)
        .where(and(eq(queueSessions.vendorId, vendorId), eq(queueSessions.date, today)))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(queueSessions)
          .set({ isOpen: true, closedAt: null })
          .where(eq(queueSessions.id, existing.id))
          .returning();
        return res.json(updated);
      }

      const [session] = await db
        .insert(queueSessions)
        .values({ vendorId, date: today, isOpen: true })
        .returning();

      return res.json(session);
    } catch (e) {
      console.error('[queue/session/open]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── POST /api/queue/session/close ────────────────────────────────────────────
router.post(
  '/session/close',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'employee'),
  async (req: AuthRequest, res) => {
    try {
      const vendorId = req.user!.vendorId;
      if (!vendorId) return res.status(403).json({ error: 'No vendor' });

      const today = todayStr();
      const [existing] = await db
        .select()
        .from(queueSessions)
        .where(and(eq(queueSessions.vendorId, vendorId), eq(queueSessions.date, today)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: 'No session today' });

      const [updated] = await db
        .update(queueSessions)
        .set({ isOpen: false, closedAt: new Date() })
        .where(eq(queueSessions.id, existing.id))
        .returning();

      return res.json(updated);
    } catch (e) {
      console.error('[queue/session/close]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── POST /api/queue/ticket  (public — customer scans QR or employee adds) ────
const issueTicketSchema = z.object({
  vendorId: z.number().optional(),
  vendorSlug: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  vehiclePlate: z.string().optional(),
  vehicleType: z.string().optional(),
  serviceId: z.number().optional(),
});

router.post('/ticket', async (req, res) => {
  try {
    const data = issueTicketSchema.parse(req.body);

    let resolvedVendorId: number | null = null;

    if (data.vendorId) {
      resolvedVendorId = data.vendorId;
    } else if (data.vendorSlug) {
      const [vendor] = await db
        .select({ id: vendors.id })
        .from(vendors)
        .where(eq(vendors.slug, data.vendorSlug))
        .limit(1);
      if (vendor) resolvedVendorId = vendor.id;
    } else {
      // If auth available, use vendorId from user
      const authReq = req as AuthRequest;
      if (authReq.user?.vendorId) resolvedVendorId = authReq.user.vendorId;
    }

    if (!resolvedVendorId) {
      return res.status(400).json({ error: 'vendorId or vendorSlug required' });
    }

    const today = todayStr();
    const session = await getOrCreateSession(resolvedVendorId, today);

    if (!session.isOpen) {
      return res.status(400).json({ error: 'الطابور مغلق حاليًا' });
    }

    // Increment currentNumber
    const [updatedSession] = await db
      .update(queueSessions)
      .set({ currentNumber: (session.currentNumber ?? 0) + 1 })
      .where(eq(queueSessions.id, session.id))
      .returning();

    const ticketNumber = updatedSession.currentNumber ?? 1;

    // Count waiting tickets to estimate wait
    const [{ waitingCount }] = await db
      .select({ waitingCount: count() })
      .from(queueTickets)
      .where(
        and(
          eq(queueTickets.sessionId, session.id),
          eq(queueTickets.status, 'waiting')
        )
      );

    const position = Number(waitingCount) + 1;
    const estimatedWaitMinutes = Number(waitingCount) * AVG_SERVICE_TIME_MINUTES;

    const [ticket] = await db
      .insert(queueTickets)
      .values({
        vendorId: resolvedVendorId,
        sessionId: session.id,
        ticketNumber,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        vehiclePlate: data.vehiclePlate,
        vehicleType: data.vehicleType,
        serviceId: data.serviceId,
        status: 'waiting',
      })
      .returning();

    return res.status(201).json({
      ...ticket,
      position,
      estimatedWaitMinutes,
    });
  } catch (e) {
    console.error('[queue/ticket POST]', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/queue/tickets  (auth) ───────────────────────────────────────────
router.get('/tickets', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'No vendor' });

    const today = todayStr();
    const [session] = await db
      .select()
      .from(queueSessions)
      .where(and(eq(queueSessions.vendorId, vendorId), eq(queueSessions.date, today)))
      .limit(1);

    if (!session) return res.json({ tickets: [], session: null });

    const tickets = await db
      .select()
      .from(queueTickets)
      .where(eq(queueTickets.sessionId, session.id))
      .orderBy(asc(queueTickets.ticketNumber));

    return res.json({ tickets, session });
  } catch (e) {
    console.error('[queue/tickets GET]', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/queue/next  (call next customer) ───────────────────────────────
router.post(
  '/next',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'employee'),
  async (req: AuthRequest, res) => {
    try {
      const vendorId = req.user!.vendorId;
      if (!vendorId) return res.status(403).json({ error: 'No vendor' });

      const today = todayStr();
      const [session] = await db
        .select()
        .from(queueSessions)
        .where(and(eq(queueSessions.vendorId, vendorId), eq(queueSessions.date, today)))
        .limit(1);

      if (!session) return res.status(404).json({ error: 'No session today' });
      if (!session.isOpen) return res.status(400).json({ error: 'الطابور مغلق' });

      // Find next waiting ticket
      const [nextTicket] = await db
        .select()
        .from(queueTickets)
        .where(
          and(
            eq(queueTickets.sessionId, session.id),
            eq(queueTickets.status, 'waiting')
          )
        )
        .orderBy(asc(queueTickets.ticketNumber))
        .limit(1);

      if (!nextTicket) {
        return res.status(404).json({ error: 'لا يوجد عملاء في الانتظار' });
      }

      const [updated] = await db
        .update(queueTickets)
        .set({ status: 'called', calledAt: new Date() })
        .where(eq(queueTickets.id, nextTicket.id))
        .returning();

      return res.json(updated);
    } catch (e) {
      console.error('[queue/next]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── POST /api/queue/ticket/:id/start ─────────────────────────────────────────
router.post(
  '/ticket/:id/start',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'employee'),
  async (req: AuthRequest, res) => {
    try {
      const ticketId = Number(req.params.id);
      const [ticket] = await db
        .select()
        .from(queueTickets)
        .where(eq(queueTickets.id, ticketId))
        .limit(1);

      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      if (ticket.vendorId !== req.user!.vendorId) return res.status(403).json({ error: 'Forbidden' });

      const [updated] = await db
        .update(queueTickets)
        .set({ status: 'in_service', startedAt: new Date() })
        .where(eq(queueTickets.id, ticketId))
        .returning();

      return res.json(updated);
    } catch (e) {
      console.error('[queue/ticket/start]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── POST /api/queue/ticket/:id/complete ──────────────────────────────────────
router.post(
  '/ticket/:id/complete',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'employee'),
  async (req: AuthRequest, res) => {
    try {
      const ticketId = Number(req.params.id);
      const [ticket] = await db
        .select()
        .from(queueTickets)
        .where(eq(queueTickets.id, ticketId))
        .limit(1);

      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      if (ticket.vendorId !== req.user!.vendorId) return res.status(403).json({ error: 'Forbidden' });

      const now = new Date();
      const waitMinutes = ticket.startedAt
        ? Math.round((now.getTime() - new Date(ticket.startedAt).getTime()) / 60000)
        : null;

      const [updated] = await db
        .update(queueTickets)
        .set({ status: 'completed', completedAt: now, waitMinutes })
        .where(eq(queueTickets.id, ticketId))
        .returning();

      // Increment totalServed on session
      const [sessionRow] = await db
        .select()
        .from(queueSessions)
        .where(eq(queueSessions.id, ticket.sessionId))
        .limit(1);

      if (sessionRow) {
        await db
          .update(queueSessions)
          .set({ totalServed: (sessionRow.totalServed ?? 0) + 1 })
          .where(eq(queueSessions.id, sessionRow.id));
      }

      return res.json(updated);
    } catch (e) {
      console.error('[queue/ticket/complete]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── POST /api/queue/ticket/:id/skip  (no-show) ───────────────────────────────
router.post(
  '/ticket/:id/skip',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'employee'),
  async (req: AuthRequest, res) => {
    try {
      const ticketId = Number(req.params.id);
      const [ticket] = await db
        .select()
        .from(queueTickets)
        .where(eq(queueTickets.id, ticketId))
        .limit(1);

      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      if (ticket.vendorId !== req.user!.vendorId) return res.status(403).json({ error: 'Forbidden' });

      const [updated] = await db
        .update(queueTickets)
        .set({ status: 'no_show' })
        .where(eq(queueTickets.id, ticketId))
        .returning();

      return res.json(updated);
    } catch (e) {
      console.error('[queue/ticket/skip]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

export default router;
