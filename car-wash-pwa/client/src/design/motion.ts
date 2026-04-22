/**
 * Motion tokens — reusable Framer Motion presets so every screen
 * moves the same way. Pick a preset rather than writing a new transition.
 *
 * Design rules:
 *   - Enters and exits use SPRING, not linear easing.
 *   - Interactive press/hover use short tight springs.
 *   - Long transforms (page switches) use soft springs with damping.
 *   - Staggers are 40–80ms — any longer feels laggy.
 */

import type { Transition, Variants } from 'framer-motion';

// ── Spring presets ──────────────────────────────────────────────────────────

export const springs = {
  /** Gentle default — UI cards, modals, toasts. */
  gentle:   { type: 'spring', stiffness: 220, damping: 26, mass: 0.9 } satisfies Transition,
  /** Snappy feedback — button tap, icon wiggle. */
  snappy:   { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 } satisfies Transition,
  /** Soft — long vertical slides, page transitions. */
  soft:     { type: 'spring', stiffness: 160, damping: 28, mass: 1   } satisfies Transition,
  /** Overshoot — celebration moments, success toasts. */
  overshoot:{ type: 'spring', stiffness: 300, damping: 18, mass: 0.7 } satisfies Transition,
} as const;

// ── Variant presets ─────────────────────────────────────────────────────────

export const fadeInUp: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: springs.gentle },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: springs.gentle },
  exit:    { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};

export const slideInFromRight: Variants = {
  hidden:  { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: springs.soft },
  exit:    { opacity: 0, x: -24, transition: { duration: 0.2 } },
};

/** Container that staggers its direct motion children.
 *  Use together with `fadeInUp` (or any `hidden/visible` variant) on children. */
export const staggerContainer: Variants = {
  hidden:  {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

// ── Interaction helpers ─────────────────────────────────────────────────────

export const tap = { scale: 0.97 } as const;
export const hoverLift = { y: -2 } as const;

// ── Page transition ─────────────────────────────────────────────────────────

export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: springs.gentle },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
} as const;
