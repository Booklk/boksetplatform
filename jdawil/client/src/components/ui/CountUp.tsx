import { useEffect, useState } from 'react';

interface Props {
  to: number;
  /** Animation duration in ms. */
  duration?: number;
  /** Decimals to show (default 0). */
  decimals?: number;
  /** Suffix appended after the number (e.g. " ر.س"). */
  suffix?: string;
  /** Prefix before the number. */
  prefix?: string;
  /** Localize with Arabic number formatting. */
  ar?: boolean;
  /** className passed through. */
  className?: string;
}

/**
 * Animates a number from 0 → `to` over `duration` ms with an ease-out
 * curve so it feels like the value "lands" rather than ticking
 * mechanically. Used for revenue, ROI, KPIs — every "big number" the
 * dashboard shows.
 *
 * Subtle but powerful: humans perceive a static "12,540 ر.س" as data,
 * but the same number animating to its final value reads as a result.
 */
export function CountUp({
  to,
  duration = 900,
  decimals = 0,
  suffix,
  prefix,
  ar = true,
  className,
}: Props) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (to === 0) {
      setValue(0);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // Ease-out cubic — fast start, soft landing.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(to * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);

  const formatted = ar
    ? new Intl.NumberFormat('ar-SA', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value)
    : value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
