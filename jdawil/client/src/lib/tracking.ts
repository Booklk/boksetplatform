/**
 * Per-vendor tracking pixels — Google Ads, GA4, GTM, Meta, TikTok, Snap.
 *
 * Each vendor pastes their OWN tracking IDs in /vendor/settings → التكاملات.
 * When a customer visits that vendor's public store/booking page, this hook
 * fetches the vendor's IDs and dynamically injects the pixel scripts ONLY
 * for the vendor whose page is being viewed. Vendor A's pixels never fire
 * on vendor B's store.
 *
 * Standard ecommerce events are exposed via trackEvent():
 *   - view_store        (page_view alias)
 *   - view_item         (looking at a service/package)
 *   - begin_checkout    (started booking flow)
 *   - purchase          (booking confirmed) — also fires Google Ads
 *                       conversion if conversion ID is set
 *
 * UTM params are read from the URL on first load and stashed in
 * sessionStorage so the booking POST can attach them.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from './api';

export interface VendorTracking {
  ga4MeasurementId?: string;
  googleAdsId?: string;
  googleAdsConversion?: string;
  gtmContainerId?: string;
  metaPixelId?: string;
  tiktokPixelId?: string;
  snapPixelId?: string;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, params?: Record<string, unknown>) => void; load?: (id: string) => void; page: () => void };
    snaptr?: (...args: unknown[]) => void;
  }
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

function loadScript(src: string, id: string, attrs?: Record<string, string>): void {
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.id = id;
  s.async = true;
  s.src = src;
  if (attrs) for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
}

function injectInline(id: string, code: string): void {
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.id = id;
  s.text = code;
  document.head.appendChild(s);
}

// ─── Captures UTMs on first page load → sessionStorage ──────────────────────
export function captureUtmFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const captured: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = url.searchParams.get(k);
      if (v) captured[k] = v;
    }
    if (Object.keys(captured).length > 0) {
      const existing = JSON.parse(sessionStorage.getItem('utm') ?? '{}');
      sessionStorage.setItem('utm', JSON.stringify({ ...existing, ...captured }));
    }
  } catch {/* noop */}
}

export function getStoredUtms(): Partial<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(sessionStorage.getItem('utm') ?? '{}');
  } catch {
    return {};
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useVendorTracking(slug?: string) {
  const injectedRef = useRef<Set<string>>(new Set());

  const { data: tracking } = useQuery<VendorTracking>({
    queryKey: ['vendor-tracking', slug],
    queryFn: () => api.get(`/vendors/public/${slug}/tracking`).then((r) => r.data),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    captureUtmFromUrl();
  }, []);

  useEffect(() => {
    if (!tracking) return;
    window.dataLayer = window.dataLayer ?? [];
    if (!window.gtag) {
      window.gtag = function gtag(...args: unknown[]) { window.dataLayer!.push(args); };
      window.gtag('js', new Date());
    }

    // ── Google Tag Manager ─────────────────────────────────────────────────
    if (tracking.gtmContainerId && !injectedRef.current.has('gtm')) {
      injectInline(
        'gtm-init',
        `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
        var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;
        f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${tracking.gtmContainerId}');`,
      );
      injectedRef.current.add('gtm');
    }

    // ── GA4 ────────────────────────────────────────────────────────────────
    if (tracking.ga4MeasurementId && !injectedRef.current.has('ga4')) {
      loadScript(`https://www.googletagmanager.com/gtag/js?id=${tracking.ga4MeasurementId}`, 'ga4-loader');
      window.gtag!('config', tracking.ga4MeasurementId, { anonymize_ip: true });
      injectedRef.current.add('ga4');
    }

    // ── Google Ads ─────────────────────────────────────────────────────────
    if (tracking.googleAdsId && !injectedRef.current.has('gads')) {
      // gtag.js already loaded by GA4 if set; otherwise add it
      if (!tracking.ga4MeasurementId) {
        loadScript(`https://www.googletagmanager.com/gtag/js?id=${tracking.googleAdsId}`, 'gads-loader');
      }
      window.gtag!('config', tracking.googleAdsId);
      injectedRef.current.add('gads');
    }

    // ── Meta Pixel ─────────────────────────────────────────────────────────
    if (tracking.metaPixelId && !injectedRef.current.has('meta')) {
      injectInline(
        'meta-init',
        `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init','${tracking.metaPixelId}');fbq('track','PageView');`,
      );
      injectedRef.current.add('meta');
    }

    // ── TikTok Pixel ───────────────────────────────────────────────────────
    if (tracking.tiktokPixelId && !injectedRef.current.has('tt')) {
      injectInline(
        'tt-init',
        `!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
        ttq.load('${tracking.tiktokPixelId}');ttq.page();}(window, document, 'ttq');`,
      );
      injectedRef.current.add('tt');
    }

    // ── Snap Pixel ─────────────────────────────────────────────────────────
    if (tracking.snapPixelId && !injectedRef.current.has('snap')) {
      injectInline(
        'snap-init',
        `(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};
        a.queue=[];var s='script';r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');
        snaptr('init','${tracking.snapPixelId}');snaptr('track','PAGE_VIEW');`,
      );
      injectedRef.current.add('snap');
    }
  }, [tracking]);

  /**
   * Fire a standard ecommerce event across all configured pixels at once.
   * `value` should be the SAR amount (number). `currency` defaults to SAR.
   */
  const trackEvent = useCallback(
    (event: 'view_store' | 'view_item' | 'begin_checkout' | 'purchase',
     params?: { value?: number; itemName?: string; transactionId?: string | number }) => {
      if (!tracking) return;
      const { value, itemName, transactionId } = params ?? {};
      const sar = typeof value === 'number' ? value : undefined;

      // GA4 / Google Ads
      if (window.gtag) {
        const ga4Map: Record<string, string> = {
          view_store: 'page_view', view_item: 'view_item',
          begin_checkout: 'begin_checkout', purchase: 'purchase',
        };
        window.gtag('event', ga4Map[event], {
          ...(sar != null ? { value: sar, currency: 'SAR' } : {}),
          ...(itemName ? { items: [{ item_name: itemName }] } : {}),
          ...(transactionId ? { transaction_id: String(transactionId) } : {}),
        });

        // Google Ads conversion (only on purchase)
        if (event === 'purchase' && tracking.googleAdsId && tracking.googleAdsConversion) {
          window.gtag('event', 'conversion', {
            send_to: `${tracking.googleAdsId}/${tracking.googleAdsConversion}`,
            ...(sar != null ? { value: sar, currency: 'SAR' } : {}),
            ...(transactionId ? { transaction_id: String(transactionId) } : {}),
          });
        }
      }

      // Meta
      if (window.fbq) {
        const fbMap: Record<string, string> = {
          view_store: 'PageView', view_item: 'ViewContent',
          begin_checkout: 'InitiateCheckout', purchase: 'Purchase',
        };
        window.fbq('track', fbMap[event], {
          ...(sar != null ? { value: sar, currency: 'SAR' } : {}),
          ...(itemName ? { content_name: itemName } : {}),
        });
      }

      // TikTok
      if (window.ttq?.track) {
        const ttMap: Record<string, string> = {
          view_store: 'ViewContent', view_item: 'ViewContent',
          begin_checkout: 'InitiateCheckout', purchase: 'CompletePayment',
        };
        window.ttq.track(ttMap[event], {
          ...(sar != null ? { value: sar, currency: 'SAR' } : {}),
          ...(itemName ? { content_name: itemName } : {}),
        });
      }

      // Snap
      if (window.snaptr) {
        const snapMap: Record<string, string> = {
          view_store: 'PAGE_VIEW', view_item: 'VIEW_CONTENT',
          begin_checkout: 'START_CHECKOUT', purchase: 'PURCHASE',
        };
        window.snaptr('track', snapMap[event], {
          ...(sar != null ? { price: sar, currency: 'SAR' } : {}),
        });
      }
    },
    [tracking],
  );

  return { tracking, trackEvent };
}
