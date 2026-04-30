/**
 * EmptyState — "nothing here yet" with a clear next step.
 *
 * Every list, table, and feed in the app should use this instead of a
 * bare "no data" line. The goal is to turn an empty screen into an
 * onboarding moment.
 */

import type { ReactNode } from 'react';
import { Card } from './Card';

export interface EmptyStateProps {
  /** Icon rendered inside a tinted circle. */
  icon?: ReactNode;
  /** Short title — what's missing. */
  title: string;
  /** One-liner body — why it matters + how to fix it. */
  body?: string;
  /** Primary call-to-action. */
  action?: ReactNode;
  /** Secondary action (e.g. "Learn more"). */
  secondary?: ReactNode;
  tone?: 'neutral' | 'primary';
  /** Compact variant for in-card empties. */
  compact?: boolean;
  className?: string;
}

const iconTones = {
  neutral: 'bg-white/[0.05] text-ink-400',
  primary: 'bg-primary-500/10 text-primary-400',
};

export function EmptyState({
  icon, title, body, action, secondary, tone = 'neutral', compact, className = '',
}: EmptyStateProps) {
  return (
    <Card variant="default" padding={compact ? 'md' : 'lg'} className={`text-center ${className}`}>
      {icon && (
        <div
          className={`
            mx-auto mb-3 rounded-full flex items-center justify-center
            ${iconTones[tone]}
            ${compact ? 'w-10 h-10' : 'w-14 h-14'}
          `}
          aria-hidden
        >
          {icon}
        </div>
      )}
      <h3 className={`font-bold text-white ${compact ? 'text-sm' : 'text-base'}`}>{title}</h3>
      {body && (
        <p className={`text-ink-400 mt-1 leading-relaxed max-w-sm mx-auto ${compact ? 'text-xs' : 'text-sm'}`}>
          {body}
        </p>
      )}
      {(action || secondary) && (
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          {action}
          {secondary}
        </div>
      )}
    </Card>
  );
}
