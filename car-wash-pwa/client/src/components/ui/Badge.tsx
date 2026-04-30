/**
 * Badge — small status chip with six semantic tones.
 *
 * Each tone is tinted (low-opacity fill + matching border + text) so
 * it reads clearly on our dark surfaces without shouting.
 */

import type { HTMLAttributes, ReactNode } from 'react';

type Tone = 'neutral' | 'primary' | 'success' | 'warn' | 'danger' | 'info';
type Size = 'sm' | 'md';

const tones: Record<Tone, string> = {
  neutral: 'bg-white/[0.06]      border-white/[0.10]      text-ink-200',
  primary: 'bg-primary-500/15    border-primary-500/30    text-primary-200',
  success: 'bg-success-500/15    border-success-500/30    text-success-300',
  warn:    'bg-warn-500/15       border-warn-500/30       text-warn-300',
  danger:  'bg-danger-500/15     border-danger-500/30     text-danger-300',
  info:    'bg-sky-500/15        border-sky-500/30        text-sky-300',
};

const sizes: Record<Size, string> = {
  sm: 'h-5 px-2 text-[10px] gap-1',
  md: 'h-6 px-2.5 text-xs gap-1.5',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: Size;
  leftIcon?: ReactNode;
  dot?: boolean;
}

export function Badge({
  tone = 'neutral', size = 'md', leftIcon, dot, className = '', children, ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border ${tones[tone]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden
          className={`w-1.5 h-1.5 rounded-full ${
            tone === 'success' ? 'bg-success-400' :
            tone === 'warn'    ? 'bg-warn-400' :
            tone === 'danger'  ? 'bg-danger-400' :
            tone === 'primary' ? 'bg-primary-400' :
            tone === 'info'    ? 'bg-sky-400' : 'bg-ink-400'
          }`}
        />
      )}
      {leftIcon && <span aria-hidden>{leftIcon}</span>}
      {children}
    </span>
  );
}
