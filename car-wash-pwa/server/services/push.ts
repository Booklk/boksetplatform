/**
 * Reusable web-push helper. Lives alongside automationEngine (which has
 * its own inline push implementation for templated automation actions).
 * This helper is for "transactional" push events — booking created,
 * employee on the way, booking confirmed, reminder — where we just want
 * to reach every active subscription for a user.
 *
 * Gracefully no-ops if VAPID keys are not configured (dev mode).
 */

import webpush from 'web-push';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';

let ready = false;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL ?? 'admin@jdawil.sa'}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    ready = true;
  } catch (e) {
    console.error('[push] VAPID init failed:', e);
  }
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

export async function sendPush(userId: number, payload: PushPayload): Promise<{ delivered: number; failed: number }> {
  if (!ready) return { delivered: 0, failed: 0 };
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true)));
  if (subs.length === 0) return { delivered: 0, failed: 0 };
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    icon: payload.icon ?? '/icons/icon-192x192.png',
    badge: payload.badge ?? '/icons/icon-96x96.png',
    data: { url: payload.url, ...(payload.data ?? {}) },
  });
  let delivered = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
      );
      delivered++;
    } catch (err) {
      failed++;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await db.update(pushSubscriptions).set({ isActive: false }).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }
  return { delivered, failed };
}

/** Fan out a push to every vendor_admin / admin user attached to a vendor. */
export async function sendPushToVendorOwners(vendorId: number, payload: PushPayload) {
  const { users } = await import('../db/schema.js');
  const { or } = await import('drizzle-orm');
  const owners = await db.select({ id: users.id }).from(users)
    .where(and(
      eq(users.vendorId, vendorId),
      or(eq(users.role, 'vendor_admin'), eq(users.role, 'admin')),
    ));
  let delivered = 0;
  for (const u of owners) {
    const r = await sendPush(u.id, payload);
    delivered += r.delivered;
  }
  return { delivered };
}
