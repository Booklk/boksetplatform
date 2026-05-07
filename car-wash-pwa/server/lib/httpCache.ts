/**
 * HTTP cache headers for endpoints fronted by Cloudflare (or any CDN).
 *
 * The values here are the contract the CDN sees — Cloudflare honours
 * `Cache-Control: public, s-maxage=N` and serves the cached response
 * for the next N seconds before re-validating with the origin. We layer
 * a shorter `max-age` for the browser so an end user navigating away
 * and back gets a fresh-ish copy without burning origin bandwidth.
 *
 * `stale-while-revalidate` lets the CDN serve a stale copy for an extra
 * window while it refreshes in the background — important during deploys
 * and for the "marketing campaign just dropped" traffic spikes where the
 * cold-cache miss must NOT cause a stampede.
 *
 * NEVER apply these to endpoints that mutate state or expose authenticated
 * data — Cloudflare will happily serve one user's data to another if the
 * Cache-Control says public.
 */
import type { Response } from 'express';

interface PublicCacheOptions {
  /** Browser TTL (seconds). Default 30. */
  browserSec?: number;
  /** CDN TTL (seconds). Default 300 (5 minutes). */
  cdnSec?: number;
  /** Stale-while-revalidate window (seconds). Default 60. */
  swrSec?: number;
}

export function setPublicCache(res: Response, opts: PublicCacheOptions = {}): void {
  const browser = opts.browserSec ?? 30;
  const cdn = opts.cdnSec ?? 300;
  const swr = opts.swrSec ?? 60;
  res.setHeader(
    'Cache-Control',
    `public, max-age=${browser}, s-maxage=${cdn}, stale-while-revalidate=${swr}`,
  );
  // Vary on Accept-Language so an Arabic and English client get distinct
  // cache entries when we serve localised payloads.
  res.setHeader('Vary', 'Accept-Language, Accept-Encoding');
}

/**
 * Strict no-cache for authenticated or short-lived data. Use on every
 * route that returns vendor admin data, customer bookings, financials,
 * etc. — anything where a stale read is a bug.
 */
export function setNoCache(res: Response): void {
  res.setHeader('Cache-Control', 'private, no-store, must-revalidate');
}
