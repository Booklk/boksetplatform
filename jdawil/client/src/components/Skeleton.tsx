// Shimmer skeleton components for loading states
// The shimmer keyframe is already in tailwind.config.ts as 'shimmer'

function ShimmerBase({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{
        background:
          'linear-gradient(90deg, rgb(30 41 59 / 0.3) 0%, rgb(51 65 85 / 0.5) 50%, rgb(30 41 59 / 0.3) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  );
}

/** Single booking / order card skeleton */
export function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <ShimmerBase className="h-3 w-16 rounded-full" />
          <ShimmerBase className="h-5 w-40" />
          <ShimmerBase className="h-4 w-52" />
        </div>
        <ShimmerBase className="h-7 w-20 rounded-full" />
      </div>
      <div className="space-y-2 pt-1">
        <ShimmerBase className="h-3.5 w-36" />
        <ShimmerBase className="h-3.5 w-48" />
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-slate-700">
        <ShimmerBase className="h-5 w-20" />
        <ShimmerBase className="h-8 w-24 rounded-xl" />
      </div>
    </div>
  );
}

/** Multiple skeleton cards in a list */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Stat number card (e.g. dashboard metrics) */
export function SkeletonStat() {
  return (
    <div className="card text-center py-4 space-y-2">
      <ShimmerBase className="h-8 w-8 rounded-full mx-auto" />
      <ShimmerBase className="h-8 w-12 mx-auto" />
      <ShimmerBase className="h-3 w-10 mx-auto rounded-full" />
    </div>
  );
}

/** Circle avatar skeleton */
export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return (
    <div
      className="rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background:
          'linear-gradient(90deg, rgb(30 41 59 / 0.3) 0%, rgb(51 65 85 / 0.5) 50%, rgb(30 41 59 / 0.3) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  );
}

/** Multi-line text skeleton */
export function SkeletonText({ lines = 2 }: { lines?: number }) {
  const widths = ['w-full', 'w-5/6', 'w-4/6', 'w-3/4', 'w-2/3'];
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerBase
          key={i}
          className={`h-4 ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  );
}

/** Table row skeleton */
export function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid grid-cols-4 gap-3 px-4 py-2">
        {[...Array(4)].map((_, i) => (
          <ShimmerBase key={i} className="h-3.5 rounded-full" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="card grid grid-cols-4 gap-3 py-3">
          {[...Array(4)].map((_, colIdx) => (
            <ShimmerBase
              key={colIdx}
              className={`h-4 rounded-full ${colIdx === 0 ? 'w-3/4' : 'w-2/3'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
