/**
 * Haptic feedback — semantic patterns calibrated for the Saudi user.
 *
 * Each pattern is tuned so the user can recognize the event by feel
 * alone, even before looking at the screen. The merchant who's
 * driving / serving a customer / on a job site should never have
 * to glance at the phone to know what happened.
 *
 * Patterns are silent no-ops on unsupported browsers (iOS Safari
 * doesn't support navigator.vibrate but iOS gives system haptics
 * for native PWA notifications anyway).
 */

const v = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
};

export const haptics = {
  // ── Generic levels ──────────────────────────────────────────────────────
  /** Very light tap — selection changes, hover-press transitions */
  light: () => v(8),
  /** Medium impact — confirmations, toggles, list item taps */
  medium: () => v(20),
  /** Heavy impact — destructive actions, important decisions */
  heavy: () => v(40),

  // ── Semantic events (recognizable by feel) ──────────────────────────────
  /** Success — single satisfying pulse */
  success: () => v(80),
  /** Three-tap accomplishment — bigger achievements (booking made, milestone) */
  accomplishment: () => v([120, 60, 120, 60, 120]),
  /** Two-tap notification — new booking, message arrived */
  notify: () => v([180, 80, 180]),
  /** Critical alert — long pattern, can't miss it */
  critical: () => v([300, 100, 300, 100, 300]),
  /** Error — three quick taps (recognizable as "wrong") */
  error: () => v([40, 40, 40, 40, 40]),
  /** Warning — sharp double */
  warn: () => v([60, 40, 60]),
  /** Cash — every riyal that comes in (subtle "ka-ching") */
  cashIn: () => v([30, 30, 60]),
  /** Pull-to-refresh release */
  refresh: () => v([10, 30, 10]),
  /** Long-press initiated */
  longPress: () => v([15, 10, 15]),

  // ── Helpers ─────────────────────────────────────────────────────────────
  /** Custom pattern — escape hatch for special cases */
  pattern: (p: number[]) => v(p),
  /** Cancel any ongoing vibration */
  cancel: () => v(0),
};
