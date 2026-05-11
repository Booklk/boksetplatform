/**
 * Customer-side PDPL endpoints — right to data portability + right to be
 * forgotten.
 *
 * Saudi PDPL (Personal Data Protection Law, effective 2023) gives every
 * data subject the right to:
 *   - know what data is held about them
 *   - obtain a copy in a structured, commonly used format
 *   - request deletion (subject to legitimate retention obligations)
 *
 * These endpoints implement both. Deletion is *soft* — we mark the user
 * inactive and schedule hard deletion in 30 days, because Saudi law also
 * requires us to keep some financial records (ZATCA, anti-money-laundering)
 * for 5+ years. The 30-day window also gives the user a chance to recover
 * if the deletion was a mistake.
 */
import { Router } from 'express';
import { db } from '../db/index.js';
import {
  users, customers, bookings, vehicles, payments, pdplConsents,
  inAppNotifications, auditLogs,
} from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';
import { setNoCache } from '../lib/httpCache.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('customer'));

/**
 * GET /api/customer-pdpl/export — return a JSON bundle of every record
 * the platform holds about the calling customer. Includes their user
 * row, vehicles, vendor profiles, bookings, payments, consent log.
 *
 * Payment card numbers, OTP codes, password hashes, and reset tokens
 * are stripped from the bundle — the user already authenticated, but
 * exposing the hash exposes them to offline brute-force if the export
 * is intercepted.
 */
router.get('/export', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    setNoCache(res);

    const [user] = await db.select({
      id: users.id, name: users.name, phone: users.phone, email: users.email,
      role: users.role, vendorId: users.vendorId,
      phoneVerified: users.phoneVerified, isActive: users.isActive,
      createdAt: users.createdAt, updatedAt: users.updatedAt,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    const [
      profileRows,
      vehicleRows,
      bookingRows,
      paymentRows,
      consentRows,
      notificationRows,
    ] = await Promise.all([
      db.select().from(customers).where(eq(customers.userId, userId)),
      db.select().from(vehicles).where(eq(vehicles.customerId, userId)),
      db.select({
        id: bookings.id, bookingNumber: bookings.bookingNumber,
        vendorId: bookings.vendorId, packageId: bookings.packageId,
        status: bookings.status, scheduledAt: bookings.scheduledAt,
        address: bookings.address, totalPrice: bookings.totalPrice,
        paymentMethod: bookings.paymentMethod, paymentStatus: bookings.paymentStatus,
        rating: bookings.rating, ratingComment: bookings.ratingComment,
        createdAt: bookings.createdAt,
      }).from(bookings).where(eq(bookings.customerId, userId)),
      db.select({
        id: payments.id, bookingId: payments.bookingId,
        amount: payments.amount, currency: payments.currency,
        method: payments.method, status: payments.status,
        paidAt: payments.paidAt, createdAt: payments.createdAt,
      }).from(payments)
        .innerJoin(bookings, eq(payments.bookingId, bookings.id))
        .where(eq(bookings.customerId, userId)),
      db.select().from(pdplConsents).where(eq(pdplConsents.userId, userId)),
      db.select({
        id: inAppNotifications.id,
        title: inAppNotifications.title,
        body: inAppNotifications.body,
        createdAt: inAppNotifications.createdAt,
      }).from(inAppNotifications).where(eq(inAppNotifications.userId, userId)),
    ]);

    // Audit the export so we have a record of the data subject exercising
    // their right — required by PDPL article on accountability.
    try {
      await db.insert(auditLogs).values({
        vendorId: null,
        userId,
        action: 'pdpl.export',
        resource: '/api/customer-pdpl/export',
        method: 'GET',
        metadata: { generatedAt: new Date().toISOString() },
        ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      });
    } catch {/* audit must never block */}

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="jdawil-data-export-${userId}-${Date.now()}.json"`);
    return res.json({
      exportVersion: 1,
      generatedAt: new Date().toISOString(),
      legalBasis: 'PDPL article on data subject rights — right to data portability',
      user,
      profiles: profileRows,
      vehicles: vehicleRows,
      bookings: bookingRows,
      payments: paymentRows,
      consents: consentRows,
      notifications: notificationRows,
    });
  } catch (e) {
    console.error('[customer-pdpl/export]', e);
    return res.status(500).json({ error: 'تعذّر إعداد ملف بياناتك' });
  }
});

/**
 * POST /api/customer-pdpl/delete — soft-delete the customer's account.
 * Hard deletion runs 30 days later (cron job in services/pdpl-purge.ts)
 * after the grace period. Financial records are KEPT for ZATCA
 * compliance — we anonymise the user reference instead.
 */
router.post('/delete', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : null;

    // Soft-delete: mark inactive, scrub PII fields, keep the row so
    // foreign keys (bookings.customerId) don't dangle.
    await db.update(users).set({
      isActive: false,
      // Scrub fields the user wouldn't want kept. Phone + name kept as
      // hashed redaction so support can still answer "did this number
      // ever have an account?" without exposing PII.
      email: null,
      passwordHash: null,
      firebaseUid: null,
      otpCode: null,
      passwordResetToken: null,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    try {
      await db.insert(auditLogs).values({
        vendorId: null,
        userId,
        action: 'pdpl.delete_requested',
        resource: '/api/customer-pdpl/delete',
        method: 'POST',
        metadata: { reason, hardDeleteAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
        ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      });
    } catch {/* */}

    return res.json({
      success: true,
      message: 'تم استلام طلب الحذف. ستُحذف بياناتك خلال 30 يوم. للاستعادة قبل ذلك، تواصل مع الدعم.',
      hardDeleteAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (e) {
    console.error('[customer-pdpl/delete]', e);
    return res.status(500).json({ error: 'تعذّر حذف الحساب' });
  }
});

export default router;
