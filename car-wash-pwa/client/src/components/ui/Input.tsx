/**
 * Input — text input with label, help text, and error slots.
 *
 * Rules:
 *   - Label is always rendered when provided. Never use placeholder as a label.
 *   - Error replaces help text and colours the border.
 *   - Icons live on the leading side (RTL-aware by using logical props).
 */

import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Label text. Accepts ReactNode for badges / inline rich content. */
  label?: ReactNode;
  help?: ReactNode;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, help, error, leftIcon, rightIcon, id, className = '', containerClassName = '', ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? `input-${autoId}`;
  const describedBy: string[] = [];
  if (help)  describedBy.push(`${inputId}-help`);
  if (error) describedBy.push(`${inputId}-error`);

  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-bold text-ink-300 mb-1.5">
          {label}
        </label>
      )}
      <div
        className={`
          relative flex items-center rounded-xl bg-white/[0.04]
          border transition-colors
          ${error
            ? 'border-danger-500/60 focus-within:border-danger-400'
            : 'border-white/[0.08] focus-within:border-primary-500/60'}
        `}
      >
        {leftIcon && (
          <span className="ps-3 text-ink-400 pointer-events-none shrink-0" aria-hidden>
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy.join(' ') || undefined}
          className={`
            flex-1 bg-transparent outline-none px-3 py-2.5 text-sm text-white
            placeholder:text-ink-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...rest}
        />
        {rightIcon && (
          <span className="pe-3 text-ink-400 shrink-0" aria-hidden>
            {rightIcon}
          </span>
        )}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1 text-[11px] text-danger-400" role="alert">
          {error}
        </p>
      ) : help ? (
        <p id={`${inputId}-help`} className="mt-1 text-[11px] text-ink-500">
          {help}
        </p>
      ) : null}
    </div>
  );
});
