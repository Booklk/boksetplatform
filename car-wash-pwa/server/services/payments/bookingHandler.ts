/**
 * Subscribes to payment events and keeps bookings in sync. Loaded once
 * at server boot (see index.ts) — do not import from route handlers.
 */

import { db } from '../../db/index.js';
import { bookings } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { bookingPaymentEvents } from './events.js';

bookingPaymentEvents.on('paid', async ({ payment, metadata }) => {
  const bookingId = Number(metadata?.bookingId ?? 0);
  if (!Number.isFinite(bookingId) || bookingId <= 0) return;
  try {
    await db.update(bookings).set({
      paymentStatus: 'paid',
      updatedAt: new Date(),
    }).where(eq(bookings.id, bookingId));
    console.log(`[payments] booking #${bookingId} marked paid (ref=${payment.providerRef})`);
  } catch (e) {
    console.error('[payments bookingHandler:paid]', e);
  }
});

bookingPaymentEvents.on('refunded', async ({ metadata }) => {
  const bookingId = Number(metadata?.bookingId ?? 0);
  if (!Number.isFinite(bookingId) || bookingId <= 0) return;
  try {
    await db.update(bookings).set({
      paymentStatus: 'refunded',
      updatedAt: new Date(),
    }).where(eq(bookings.id, bookingId));
  } catch (e) {
    console.error('[payments bookingHandler:refunded]', e);
  }
});

bookingPaymentEvents.on('failed', async ({ metadata }) => {
  const bookingId = Number(metadata?.bookingId ?? 0);
  if (!Number.isFinite(bookingId) || bookingId <= 0) return;
  try {
    await db.update(bookings).set({
      paymentStatus: 'failed',
      updatedAt: new Date(),
    }).where(eq(bookings.id, bookingId));
  } catch (e) {
    console.error('[payments bookingHandler:failed]', e);
  }
});
