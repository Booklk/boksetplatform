/**
 * Web Push wrapper — uses VAPID + the `web-push` library + the
 * push_subscriptions table (populated by the PWA client) to deliver
 * notifications to a user's registered devices.
 *
 * Returns { sent, failed } counts. Inactive subscriptions are auto-disabled
 * on 404/410 to keep the table clean.
 */
import webpush from 'web-push';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
import { getSettings } from './platformSettings.js';

let configuredKey: string | null = null;

async function ensureConfigured(): Promise<boolean> {
  const { 'vapid.publicKey': pub, 'vapid.privateKey': priv, 'vapid.email': email } =
    await getSettings(['vapid.publicKey', 'vapid.privateKey', 'vapid.email']);
  if (!pub || !priv) return false;
  // Re-init only if the key changed (super-admin may have rotated it)
  if (configuredKey !== pub) {
    webpush.setVapidDetails(`mailto:${email ?? 'admin@example.com'}`, pub, priv);
    configuredKey = pub;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  data?: Record<string, unknown>;
}

export async function sendWebPushToUser(
  userId: number,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!(await ensureConfigured())) {
    return { sent: 0, failed: 0 };
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true)));

  if (subs.length === 0) return { sent: 0, failed: 0 };

  const json = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    icon: payload.icon ?? '/icons/icon-192x192.png',
    data: payload.data ?? {},
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json,
        );
        sent++;
      } catch (e: any) {
        failed++;
        // 404/410 = subscription gone; deactivate so we don't keep retrying
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await db
            .update(pushSubscriptions)
            .set({ isActive: false })
            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
        }
      }
    }),
  );

  return { sent, failed };
}
