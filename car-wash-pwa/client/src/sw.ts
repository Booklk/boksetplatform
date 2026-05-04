/// <reference lib="webworker" />

/**
 * Custom service worker — uses Workbox precaching for app shell and adds
 * push + notificationclick handlers so transactional notifications land
 * correctly.
 */

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// Take over every open tab the moment a new SW is installed — keeps the
// "fresh data, always" guarantee across sessions.
self.skipWaiting();
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

precacheAndRoute(self.__WB_MANIFEST);

// Google Fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
);

// Public vendor data — short NetworkFirst
registerRoute(
  ({ url }) => /\/api\/(services|plans|vendors\/public)/.test(url.pathname),
  new NetworkFirst({
    cacheName: 'api-public',
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxAgeSeconds: 120, maxEntries: 50 })],
  }),
);

// User uploads
registerRoute(
  ({ url }) => /\/uploads\/.*\.(png|jpe?g|webp|gif|svg)$/i.test(url.pathname),
  new CacheFirst({
    cacheName: 'user-uploads',
    plugins: [new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 30, maxEntries: 200 })],
  }),
);

// SPA navigation fallback — but don't swallow /api/* or /uploads/*.
const fallback = new NavigationRoute(
  async () => (await caches.match('/index.html')) ?? Response.error(),
  {
    denylist: [/^\/api\//, /^\/uploads\//],
  },
);
registerRoute(fallback);

// ─── Push ────────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data: {
    title?: string; body?: string; icon?: string; badge?: string;
    tag?: string; data?: { url?: string; [k: string]: unknown };
    actions?: Array<{ action: string; title: string; url?: string }>;
    requireInteraction?: boolean;
    vibrate?: number[];
  } = {};
  try { data = event.data.json(); } catch { data = { title: 'Jdawil', body: event.data.text() }; }
  const title = data.title ?? 'Jdawil';
  const options: NotificationOptions = {
    body: data.body ?? '',
    icon: data.icon ?? '/icons/icon-192x192.png',
    badge: data.badge ?? '/icons/icon-96x96.png',
    tag: data.tag,
    data: { ...(data.data ?? {}), actions: data.actions ?? [] },
    dir: 'rtl',
    // High-priority pushes (booking events) keep the notification visible
    // until the vendor taps it — no missed bookings.
    requireInteraction: data.requireInteraction ?? false,
    vibrate: data.vibrate ?? [120, 60, 120],
    // Up to 2 action buttons render on Android. iOS ignores them.
    actions: (data.actions ?? []).slice(0, 2).map((a) => ({
      action: a.action,
      title: a.title,
    })),
  } as NotificationOptions;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = (event.notification.data as { url?: string; actions?: Array<{ action: string; url?: string }> } | null) ?? {};
  // Action button → its own URL if defined, otherwise the default URL.
  let targetUrl = data.url ?? '/';
  if (event.action && Array.isArray(data.actions)) {
    const match = data.actions.find((a) => a.action === event.action);
    if (match?.url) targetUrl = match.url;
  }
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client && targetUrl) await (client as WindowClient).navigate(targetUrl);
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});
