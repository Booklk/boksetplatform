/**
 * PageHeader — consistent top-of-page header across all dashboard screens.
 *
 *  ┌───────────────────────────────┐
 *  │ [icon]  Title            [actions] │
 *  │         Subtitle                   │
 *  └───────────────────────────────┘
 */

import type { ReactNode } from 'react';

export interface PageHeaderProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  /** Slot for buttons on the opposite side of the title. */
  actions?: ReactNode;
  /** Breadcrumb / back link rendered above the title. */
  eyebrow?: ReactNode;
  className?: string;
}

export function PageHeader({
  icon, title, subtitle, actions, eyebrow, className = '',
}: PageHeaderProps) {
  return (
    <header className={`mb-6 ${className}`}>
      {eyebrow && <div className="mb-2 text-xs text-ink-400">{eyebrow}</div>}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div
              className="shrink-0 w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400"
              aria-hidden
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-white mb-1 truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-ink-400 leading-relaxed">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
