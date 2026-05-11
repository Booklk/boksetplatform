/**
 * Skeleton — placeholder primitives. Prefer these over spinners; they
 * communicate shape and set expectations.
 */

import type { HTMLAttributes } from 'react';

export function Skeleton({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white/[0.05] rounded-md animate-pulse ${className}`}
      aria-hidden
      {...rest}
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-white/[0.05] rounded animate-pulse"
          style={{ width: `${80 + (i * 7) % 18}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3 ${className}`}
      aria-hidden
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/[0.06] animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 bg-white/[0.06] rounded animate-pulse" />
          <div className="h-3 w-24 bg-white/[0.05] rounded animate-pulse" />
        </div>
      </div>
      <div className="h-20 bg-white/[0.04] rounded-xl animate-pulse" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden" aria-hidden>
      <div className="divide-y divide-white/[0.04]">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }).map((__, c) => (
              <div key={c} className="h-3 bg-white/[0.05] rounded animate-pulse" style={{ width: `${60 + ((r + c) * 13) % 30}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4" aria-hidden>
      <div className="h-3 w-20 bg-white/[0.05] rounded animate-pulse mb-3" />
      <div className="h-8 w-28 bg-white/[0.08] rounded animate-pulse" />
    </div>
  );
}
