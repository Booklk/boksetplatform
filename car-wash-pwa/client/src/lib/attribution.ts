import { useEffect } from 'react';

const STORAGE_KEY = 'jdawil-attribution-v1';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'ttclid'] as const;
type UtmKey = (typeof UTM_KEYS)[number];

export interface Attribution {
  capturedAt: number;
  landingPath: string;
  referrer: string;
  utm: Partial<Record<UtmKey, string>>;
}

/**
 * On first visit, capture UTM/click-id params + landing page + referrer
 * into localStorage. Persists across the entire onboarding journey so
 * we know which campaign converted.
 *
 * Reads window.location once on mount and never overwrites — first-touch
 * attribution is the convention. Existing record is sticky for 30 days,
 * after which fresh visit re-captures.
 */
export function useCaptureAttribution() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const utm: Partial<Record<UtmKey, string>> = {};
    for (const k of UTM_KEYS) {
      const v = url.searchParams.get(k);
      if (v) utm[k] = v;
    }
    const hasParams = Object.keys(utm).length > 0;

    let existing: Attribution | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) existing = JSON.parse(raw) as Attribution;
    } catch { /* ignore */ }

    const expired = existing && Date.now() - existing.capturedAt > 30 * 86400_000;

    if (!existing || expired || hasParams) {
      const next: Attribution = {
        capturedAt: Date.now(),
        landingPath: url.pathname,
        referrer: document.referrer || '',
        utm,
      };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }
  }, []);
}

export function readAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Attribution;
  } catch {
    return null;
  }
}

/** Append attribution params back to a destination URL (for cross-domain handoffs). */
export function appendAttribution(href: string): string {
  const a = readAttribution();
  if (!a) return href;
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://jdawil.sa');
    for (const [k, v] of Object.entries(a.utm)) {
      if (v && !url.searchParams.has(k)) url.searchParams.set(k, v);
    }
    return url.toString().replace(/^https?:\/\/[^/]+/, '');
  } catch {
    return href;
  }
}
