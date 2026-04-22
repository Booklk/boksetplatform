/**
 * Real-time layer — vendor-scoped WebSocket rooms.
 *
 * Every client authenticates with a JWT via the `?token=` query param
 * (subprotocols are awkward in PWAs; query param is encrypted in transit).
 * Clients join a room keyed by their `vendorId`. Broadcast helpers are
 * exposed for the rest of the backend — booking routes, payment webhook,
 * etc. publish, and every connected browser tab in that vendor sees the
 * update without polling.
 *
 * Event shape (JSON):
 *   { type: 'booking.created' | 'booking.updated' | 'payment.paid' | ...,
 *     payload: {...}, at: ISO-timestamp, actorId?: number }
 *
 * Presence:
 *   - On connect: the server broadcasts `presence.join` with the user id
 *     + role + name to the vendor room.
 *   - Every 25s, the server reaps dead sockets and rebroadcasts the full
 *     roster via `presence.roster`.
 */

import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { URL } from 'url';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export interface RealtimeEvent {
  type: string;
  payload: unknown;
  at: string;
  actorId?: number;
}

interface ClientMeta {
  vendorId: number;
  userId: number;
  role: string;
  name: string;
  lastSeen: number;
  focus?: string; // e.g. "booking:42"
}

/** vendorId → Set<ws>. A WeakMap isn't appropriate because we iterate. */
const rooms = new Map<number, Set<WebSocket>>();
const meta  = new WeakMap<WebSocket, ClientMeta>();

let wss: WebSocketServer | null = null;

function roomOf(vendorId: number): Set<WebSocket> {
  let set = rooms.get(vendorId);
  if (!set) { set = new Set(); rooms.set(vendorId, set); }
  return set;
}

function send(ws: WebSocket, event: RealtimeEvent) {
  if (ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(event)); } catch { /* ignore */ }
  }
}

export function broadcast(vendorId: number, type: string, payload: unknown, actorId?: number) {
  const set = rooms.get(vendorId);
  if (!set || set.size === 0) return;
  const event: RealtimeEvent = { type, payload, at: new Date().toISOString(), actorId };
  for (const ws of set) send(ws, event);
}

function rosterOf(vendorId: number) {
  const set = rooms.get(vendorId);
  if (!set) return [];
  const seen = new Map<number, ClientMeta>();
  for (const ws of set) {
    const m = meta.get(ws);
    if (!m) continue;
    // Deduplicate by userId so one person with two tabs counts once.
    seen.set(m.userId, m);
  }
  return Array.from(seen.values()).map((m) => ({
    userId: m.userId,
    role: m.role,
    name: m.name,
    focus: m.focus ?? null,
  }));
}

function broadcastRoster(vendorId: number) {
  const roster = rosterOf(vendorId);
  broadcast(vendorId, 'presence.roster', roster);
}

export function attachRealtime(httpServer: HttpServer) {
  if (wss) return wss;
  wss = new WebSocketServer({ server: httpServer, path: '/realtime' });

  wss.on('connection', async (ws, req) => {
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      const token = url.searchParams.get('token');
      if (!token) { ws.close(4401, 'no-token'); return; }

      const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as {
        id: number; role: string; vendorId?: number;
      };
      if (!payload.vendorId) { ws.close(4403, 'no-vendor'); return; }

      // Fetch display name once — small price for a nicer presence UI.
      const [user] = await db.select({ name: users.name })
        .from(users).where(eq(users.id, payload.id)).limit(1);

      const m: ClientMeta = {
        vendorId: payload.vendorId,
        userId: payload.id,
        role: payload.role,
        name: user?.name ?? 'مستخدم',
        lastSeen: Date.now(),
      };
      meta.set(ws, m);
      roomOf(payload.vendorId).add(ws);

      send(ws, { type: 'presence.self', payload: { userId: m.userId, role: m.role }, at: new Date().toISOString() });
      broadcastRoster(payload.vendorId);

      ws.on('message', (raw) => {
        const current = meta.get(ws);
        if (!current) return;
        current.lastSeen = Date.now();
        let parsed: any;
        try { parsed = JSON.parse(String(raw)); } catch { return; }
        if (parsed?.type === 'ping') {
          send(ws, { type: 'pong', payload: null, at: new Date().toISOString() });
          return;
        }
        if (parsed?.type === 'presence.focus') {
          current.focus = typeof parsed.payload === 'string' ? parsed.payload : undefined;
          broadcastRoster(current.vendorId);
          return;
        }
      });

      ws.on('close', () => {
        const current = meta.get(ws);
        if (!current) return;
        const set = rooms.get(current.vendorId);
        set?.delete(ws);
        if (set && set.size === 0) rooms.delete(current.vendorId);
        broadcastRoster(current.vendorId);
      });
    } catch (e) {
      console.error('[realtime connection]', e);
      ws.close(4500, 'auth-error');
    }
  });

  // Heartbeat reaper — drops dead sockets every 30s and rebroadcasts rosters
  // for vendors whose roster actually changed.
  setInterval(() => {
    const now = Date.now();
    const affected = new Set<number>();
    for (const [vendorId, set] of rooms) {
      for (const ws of Array.from(set)) {
        const m = meta.get(ws);
        if (!m) { set.delete(ws); affected.add(vendorId); continue; }
        if (ws.readyState === WebSocket.CLOSED || now - m.lastSeen > 90_000) {
          try { ws.terminate(); } catch { /* ignore */ }
          set.delete(ws);
          affected.add(vendorId);
        }
      }
      if (set.size === 0) rooms.delete(vendorId);
    }
    for (const v of affected) broadcastRoster(v);
  }, 30_000);

  return wss;
}
