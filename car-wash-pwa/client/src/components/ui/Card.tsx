/**
 * Card — the single surface primitive for the app.
 *
 * Variants:
 *   - `default`     → subtle surface, most content blocks
 *   - `elevated`    → slightly raised, for important groupings
 *   - `interactive` → hover lift, intended for link/button wrappers
 *   - `outline`     → no fill, just a border — use sparingly
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { hoverLift, springs } from '../../design/motion';

type Variant = 'default' | 'elevated' | 'interactive' | 'outline';
type Padding = 'none' | 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  default:     'bg-white/[0.03] border border-white/[0.06]',
  elevated:    'bg-white/[0.05] border border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.25)]',
  interactive: 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.10] cursor-pointer',
  outline:     'bg-transparent border border-white/10',
};

const paddings: Record<Padding, string> = {
  none: '',
  sm:   'p-3',
  md:   'p-4 sm:p-5',
  lg:   'p-5 sm:p-6',
};

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: Variant;
  padding?: Padding;
  /** When true, wraps in a motion.div with a subtle hover lift. */
  animateHover?: boolean;
  as?: 'div' | 'article' | 'section';
  children?: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', padding = 'md', animateHover, className = '', children, ...rest },
  ref,
) {
  const classes = `rounded-2xl ${variants[variant]} ${paddings[padding]} ${className}`;
  if (animateHover) {
    return (
      <motion.div
        ref={ref}
        whileHover={hoverLift}
        transition={springs.snappy}
        className={classes}
        {...(rest as any)}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <div ref={ref} className={classes} {...rest}>
      {children}
    </div>
  );
});

// ── Sub-components for consistent card structure ────────────────────────────

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mb-3 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-base font-bold text-white ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-sm text-ink-400 leading-relaxed ${className}`}>{children}</p>;
}

export function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mt-4 pt-4 border-t border-white/[0.06] ${className}`}>{children}</div>;
}
