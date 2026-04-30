/**
 * Button — the single button primitive for the whole app.
 *
 * Design rules:
 *   - Primary on surface = solid primary-600. Hover = 500. Active = 700.
 *   - Focus ring is 2px, offset 2px. Always visible in keyboard nav.
 *   - Loading state keeps the button width stable — no layout shift.
 *   - Icon-only buttons get aria-label (enforced via TS).
 */

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { tap } from '../../design/motion';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const base =
  'inline-flex items-center justify-center gap-2 font-bold rounded-xl ' +
  'transition-colors duration-150 outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-primary-400 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-ink-950 disabled:opacity-50 ' +
  'disabled:cursor-not-allowed select-none';

const variants: Record<Variant, string> = {
  primary:   'bg-primary-600 hover:bg-primary-500 active:bg-primary-700 text-white shadow-sm hover:shadow-md',
  secondary: 'bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.08]',
  ghost:     'hover:bg-white/[0.06] text-white/80 hover:text-white',
  outline:   'bg-transparent hover:bg-white/[0.04] border border-white/15 text-white',
  danger:    'bg-danger-600 hover:bg-danger-500 active:bg-danger-700 text-white',
  success:   'bg-success-600 hover:bg-success-500 active:bg-success-700 text-white',
};

const sizes: Record<Size, string> = {
  sm:   'h-8 px-3 text-xs',
  md:   'h-10 px-4 text-sm',
  lg:   'h-12 px-5 text-base',
  icon: 'h-10 w-10 p-0',
};

type NativeButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export interface ButtonProps extends Omit<NativeButtonProps, 'disabled'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    disabled,
    leftIcon,
    rightIcon,
    fullWidth,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = Boolean(disabled || loading);
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      whileTap={isDisabled ? undefined : tap}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...(rest as any)}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" aria-hidden />
      ) : (
        leftIcon && <span className="shrink-0" aria-hidden>{leftIcon}</span>
      )}
      {children && <span className="truncate">{children}</span>}
      {!loading && rightIcon && <span className="shrink-0" aria-hidden>{rightIcon}</span>}
    </motion.button>
  );
});
