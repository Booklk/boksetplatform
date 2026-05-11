/**
 * Stat — hero metric tile with optional delta indicator.
 *
 * Pattern:
 *   <label>          small caps-y label
 *   <big value>      large typographic value
 *   <delta>          tiny "+8.5% مقارنة بالأمس" with color tone
 */

import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from './Card';

export interface StatProps {
  label: string;
  value: string | number;
  hint?: string;
  delta?: {
    value: string;                         // "+8.5%" — formatted by caller
    tone?: 'positive' | 'negative' | 'neutral';
    /** Optional explanation displayed after the delta, e.g. "مقارنة بالأمس". */
    note?: string;
  };
  icon?: ReactNode;
  loading?: boolean;
}

const toneMap: Record<'positive' | 'negative' | 'neutral', { text: string; icon: typeof TrendingUp }> = {
  positive: { text: 'text-success-400', icon: TrendingUp },
  negative: { text: 'text-danger-400',  icon: TrendingDown },
  neutral:  { text: 'text-ink-400',     icon: Minus },
};

export function Stat({ label, value, hint, delta, icon, loading }: StatProps) {
  const t = delta ? toneMap[delta.tone ?? 'neutral'] : null;
  const DeltaIcon = t?.icon;
  return (
    <Card variant="default" padding="md" className="min-w-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400 truncate">
          {label}
        </p>
        {icon && <span className="text-ink-500 shrink-0" aria-hidden>{icon}</span>}
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-white/[0.06] rounded animate-pulse" />
      ) : (
        <p className="text-2xl sm:text-3xl font-black text-white tabular-nums leading-tight">
          {value}
        </p>
      )}
      {delta && DeltaIcon && !loading && (
        <div className={`flex items-center gap-1 mt-1.5 text-xs font-bold ${t!.text}`}>
          <DeltaIcon size={12} />
          <span>{delta.value}</span>
          {delta.note && <span className="text-ink-500 font-normal">· {delta.note}</span>}
        </div>
      )}
      {hint && !delta && <p className="text-[11px] text-ink-500 mt-1">{hint}</p>}
    </Card>
  );
}
