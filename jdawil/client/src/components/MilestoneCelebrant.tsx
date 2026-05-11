/**
 * MilestoneCelebrant — listens for `milestone.earned` events from the
 * WebSocket layer and renders a full-screen celebration:
 *   - Glass trophy card with tier-tinted halo
 *   - Confetti burst (60 particles, 2.5s cleanup)
 *   - Short "achievement" chime (optional, Web Audio API)
 *   - Haptic pulse
 *
 * Strictly additive — never blocks the UI; card auto-dismisses after 5s
 * unless the user clicks it.
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useRealtime } from '../hooks/useRealtime';
import { useAuth } from '../hooks/useAuth';
import { springs } from '../design/motion';

interface Milestone {
  id: string;
  title: string;
  subtitle?: string;
  emoji: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
}

const tierStyle = {
  bronze:  { from: 'from-amber-700',  to: 'to-amber-500',  ring: 'ring-amber-400/40' },
  silver:  { from: 'from-ink-500',    to: 'to-ink-300',    ring: 'ring-ink-200/40' },
  gold:    { from: 'from-warn-600',   to: 'to-warn-400',   ring: 'ring-warn-300/50' },
  diamond: { from: 'from-sky-500',    to: 'to-primary-400', ring: 'ring-sky-300/50' },
};

// Deterministic particle layout — seeded so every render is the same burst.
const PARTICLES = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: Math.cos((i / 60) * Math.PI * 2) * (80 + (i * 7) % 40),
  y: Math.sin((i / 60) * Math.PI * 2) * (80 + (i * 11) % 40),
  r: (i * 23) % 360,
  delay: (i % 10) * 0.02,
  color: ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#a855f7'][i % 5],
}));

function playChime() {
  // A short, gentle 2-note chime. Guarded against missing AudioContext.
  const AC: typeof AudioContext | undefined =
    (window as any).AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return;
  try {
    const ctx = new AC();
    const play = (freq: number, when: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + when);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + dur);
      o.start(ctx.currentTime + when);
      o.stop(ctx.currentTime + when + dur + 0.05);
    };
    play(880, 0, 0.22);
    play(1320, 0.12, 0.32);
    setTimeout(() => ctx.close(), 1200);
  } catch { /* ignore */ }
}

export default function MilestoneCelebrant() {
  const { user } = useAuth();
  const { subscribe } = useRealtime();
  const [current, setCurrent] = useState<Milestone | null>(null);
  const [queue, setQueue] = useState<Milestone[]>([]);

  // Fan out incoming events into a queue — if two fire in quick succession
  // (e.g. 100 bookings + record day), show them one after another.
  useEffect(() => {
    if (!user || user.role === 'customer') return;
    const unsub = subscribe<Milestone>('milestone.earned', (ev) => {
      setQueue((q) => [...q, ev.payload]);
    });
    return unsub;
  }, [user?.id, user?.role, subscribe]);

  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
    try { (navigator as any).vibrate?.([80, 40, 120, 40, 200]); } catch {}
    playChime();
    const t = window.setTimeout(() => setCurrent(null), 5500);
    return () => window.clearTimeout(t);
  }, [queue, current]);

  const style = useMemo(() => current ? tierStyle[current.tier] : tierStyle.silver, [current]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
          dir="rtl"
        >
          {/* Radial halo */}
          <div className={`absolute inset-0 bg-gradient-radial from-white/5 to-transparent`} />

          {/* Confetti burst */}
          <div className="absolute inset-0 flex items-center justify-center">
            {PARTICLES.map((p) => (
              <motion.span
                key={p.id}
                className="absolute block w-2 h-2 rounded-sm"
                style={{ backgroundColor: p.color }}
                initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0 }}
                animate={{
                  x: p.x,
                  y: p.y + 140, // gravity drag
                  opacity: [0, 1, 1, 0],
                  rotate: p.r + 360,
                  scale: [0, 1, 0.8, 0],
                }}
                transition={{ duration: 1.8, delay: p.delay, ease: [0.2, 0.7, 0.3, 1] }}
              />
            ))}
          </div>

          {/* Card */}
          <motion.div
            initial={{ scale: 0.5, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 10, opacity: 0 }}
            transition={springs.overshoot}
            className="pointer-events-auto relative"
          >
            <div
              className={`
                relative w-[320px] rounded-3xl p-6 text-center text-white
                bg-gradient-to-br ${style.from} ${style.to}
                shadow-2xl ring-4 ${style.ring}
              `}
            >
              <button
                onClick={() => setCurrent(null)}
                className="absolute top-3 left-3 w-7 h-7 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center"
                aria-label="إغلاق"
              >
                <X size={14} />
              </button>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: [0, -10, 10, -5, 0] }}
                transition={{ ...springs.overshoot, delay: 0.15 }}
                className="text-7xl mb-2"
              >
                {current.emoji}
              </motion.div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70 mb-1">
                إنجاز جديد
              </p>
              <h2 className="text-2xl font-black mb-1">{current.title}</h2>
              {current.subtitle && (
                <p className="text-sm text-white/90 leading-relaxed">{current.subtitle}</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
