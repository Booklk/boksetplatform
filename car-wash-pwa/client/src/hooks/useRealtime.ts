/**
 * useRealtime — connects to /realtime over WebSocket with the user's JWT,
 * auto-reconnects with exponential backoff, and surfaces a small typed API:
 *
 *   const { status, presence, subscribe } = useRealtime();
 *   // status   : 'connecting' | 'online' | 'offline'
 *   // presence : Array<{ userId, role, name, focus }>
 *   useEffect(() => subscribe('booking.created', (ev) => ...), []);
 *
 * Only one WebSocket is kept for the entire tab (module-level singleton).
 * Consumers get their own subscriber list; unsubscribing is automatic on
 * unmount. Ping-pong every 30s keeps NAT / proxies happy.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface PresenceUser {
  userId: number;
  role: string;
  name: string;
  focus: string | null;
}

export type RealtimeStatus = 'connecting' | 'online' | 'offline';
export interface RealtimeEvent<T = unknown> {
  type: string;
  payload: T;
  at: string;
  actorId?: number;
}

type Listener = (event: RealtimeEvent) => void;

let socket: WebSocket | null = null;
let pingTimer: number | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempt = 0;
const listeners = new Set<Listener>();
const statusListeners = new Set<(s: RealtimeStatus) => void>();
const presenceListeners = new Set<(p: PresenceUser[]) => void>();
let currentStatus: RealtimeStatus = 'offline';
let currentPresence: PresenceUser[] = [];

function setStatus(s: RealtimeStatus) {
  if (currentStatus === s) return;
  currentStatus = s;
  for (const l of statusListeners) l(s);
}
function setPresence(p: PresenceUser[]) {
  currentPresence = p;
  for (const l of presenceListeners) l(p);
}
function emit(ev: RealtimeEvent) {
  for (const l of listeners) l(ev);
}

function wsUrl(): string {
  const token = localStorage.getItem('token') ?? '';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host  = window.location.host;
  return `${proto}://${host}/realtime?token=${encodeURIComponent(token)}`;
}

function connect() {
  if (typeof window === 'undefined') return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  if (!localStorage.getItem('token')) return; // not logged in — skip
  setStatus('connecting');
  try {
    socket = new WebSocket(wsUrl());
  } catch {
    setStatus('offline');
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    reconnectAttempt = 0;
    setStatus('online');
    // Keepalive — servers / proxies kill idle WS after ~60s.
    if (pingTimer) window.clearInterval(pingTimer);
    pingTimer = window.setInterval(() => {
      try { socket?.send(JSON.stringify({ type: 'ping' })); } catch { /* ignore */ }
    }, 25_000);
  };

  socket.onmessage = (msg) => {
    try {
      const ev: RealtimeEvent = JSON.parse(String(msg.data));
      if (ev.type === 'presence.roster') {
        setPresence((ev.payload as PresenceUser[]) ?? []);
        return;
      }
      emit(ev);
    } catch { /* ignore */ }
  };

  socket.onclose = () => {
    if (pingTimer) { window.clearInterval(pingTimer); pingTimer = null; }
    setStatus('offline');
    setPresence([]);
    scheduleReconnect();
  };
  socket.onerror = () => {
    try { socket?.close(); } catch { /* ignore */ }
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectAttempt++;
  // Cap backoff at 30s — don't hammer if the server's down.
  const delay = Math.min(30_000, 1000 * Math.pow(1.6, reconnectAttempt));
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

export function sendRealtime(type: string, payload?: unknown) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  try {
    socket.send(JSON.stringify({ type, payload }));
    return true;
  } catch { return false; }
}

export function useRealtime() {
  const [status, setLocalStatus]     = useState<RealtimeStatus>(currentStatus);
  const [presence, setLocalPresence] = useState<PresenceUser[]>(currentPresence);

  useEffect(() => {
    connect();
    statusListeners.add(setLocalStatus);
    presenceListeners.add(setLocalPresence);
    return () => {
      statusListeners.delete(setLocalStatus);
      presenceListeners.delete(setLocalPresence);
    };
  }, []);

  const subscribe = useCallback(<T = unknown>(type: string, handler: (e: RealtimeEvent<T>) => void) => {
    const wrap: Listener = (ev) => { if (ev.type === type) handler(ev as RealtimeEvent<T>); };
    listeners.add(wrap);
    return () => { listeners.delete(wrap); };
  }, []);

  const setFocus = useCallback((focus: string | null) => {
    sendRealtime('presence.focus', focus);
  }, []);

  return { status, presence, subscribe, setFocus };
}
