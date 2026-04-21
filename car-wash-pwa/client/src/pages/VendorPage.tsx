/**
 * Storefront page renderer — /store/:slug/p/:pageSlug
 * Fetches a vendor's published custom page (GET /api/pages/public/:slug/:pageSlug)
 * and renders the markdown-ish content inside the vendor's CustomTheme.
 */

import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Loader2 } from 'lucide-react';
import api from '../lib/api';
import { CustomTheme, DEFAULT_CUSTOM_THEME, RADIUS_VALUES } from '../lib/customTheme';

interface PageData {
  slug: string;
  title: string;
  kind: 'custom' | 'terms';
  content: string;
  updatedAt: string;
}

interface VendorBasics {
  nameAr: string;
  logoUrl?: string;
  settings?: Record<string, unknown>;
}

/**
 * Very small markdown renderer — just enough for our templates:
 *   ## heading → <h2>
 *   - item    → <ul><li>
 *   **bold**  → <strong>
 *   blank line between paragraphs.
 * Safe: never injects raw HTML attributes.
 */
function renderMarkdown(md: string): { __html: string } {
  const escape = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;

  for (let raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push('');
      continue;
    }

    // Heading
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h2>${inlineFmt(escape(h2[1]))}</h2>`);
      continue;
    }
    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3>${inlineFmt(escape(h3[1]))}</h3>`);
      continue;
    }

    // List item
    const li = /^[-*]\s+(.+)$/.exec(line);
    if (li) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inlineFmt(escape(li[1]))}</li>`);
      continue;
    }

    // Paragraph
    if (inList) { out.push('</ul>'); inList = false; }
    out.push(`<p>${inlineFmt(escape(line))}</p>`);
  }
  if (inList) out.push('</ul>');

  return { __html: out.join('\n') };
}

function inlineFmt(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export default function VendorPage() {
  const { slug: vendorSlug, pageSlug } = useParams<{ slug: string; pageSlug: string }>();

  const { data: vendor } = useQuery<VendorBasics>({
    queryKey: ['vendor-basics', vendorSlug],
    queryFn: () => api.get(`/vendors/public/${vendorSlug}`).then((r) => r.data),
    enabled: !!vendorSlug,
  });

  const { data: page, isLoading, isError } = useQuery<PageData>({
    queryKey: ['vendor-page', vendorSlug, pageSlug],
    queryFn: () => api.get(`/pages/public/${vendorSlug}/${pageSlug}`).then((r) => r.data),
    enabled: !!vendorSlug && !!pageSlug,
    retry: false,
  });

  if (!vendorSlug || !pageSlug) return <Navigate to="/" replace />;

  const ct: CustomTheme =
    ((vendor?.settings as Record<string, unknown> | undefined)?.customTheme as CustomTheme | undefined) ??
    DEFAULT_CUSTOM_THEME;
  const radius = RADIUS_VALUES[ct.radius];

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-arabic"
        style={{ background: ct.bg, color: ct.text }}
        dir="rtl"
      >
        <Loader2 className="w-6 h-6 animate-spin opacity-60" />
      </div>
    );
  }

  if (isError || !page) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-center px-4 font-arabic"
        style={{ background: ct.bg, color: ct.text }}
        dir="rtl"
      >
        <div>
          <p className="text-4xl font-black mb-2">404</p>
          <p className="opacity-60 mb-5">الصفحة غير موجودة</p>
          <Link
            to={`/store/${vendorSlug}`}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold"
            style={{ background: ct.button, color: '#fff', borderRadius: radius }}
          >
            <ArrowRight size={14} />
            العودة للمتجر
          </Link>
        </div>
      </div>
    );
  }

  const body = renderMarkdown(page.content);

  return (
    <>
      <Helmet>
        <title>{page.title} — {vendor?.nameAr ?? 'المتجر'}</title>
        <meta name="description" content={`${page.title} — ${vendor?.nameAr ?? ''}`} />
        <link rel="canonical" href={`https://bokset.sa/store/${vendorSlug}/p/${page.slug}`} />
      </Helmet>

      <div
        className="min-h-screen font-arabic"
        style={{ background: ct.bg, color: ct.text }}
        dir="rtl"
      >
        <div className="max-w-3xl mx-auto px-5 py-10">
          {/* Back link */}
          <Link
            to={`/store/${vendorSlug}`}
            className="inline-flex items-center gap-1.5 text-sm opacity-60 hover:opacity-100 mb-8 transition-opacity"
          >
            <ArrowRight size={14} />
            العودة إلى {vendor?.nameAr ?? 'المتجر'}
          </Link>

          {/* Page header */}
          <h1 className="text-3xl sm:text-4xl font-black mb-8 leading-tight" style={{ color: ct.text }}>
            {page.title}
          </h1>

          {/* Rendered content */}
          <article
            className="vendor-page-content"
            style={{ color: ct.text }}
            dangerouslySetInnerHTML={body}
          />

          {/* Footer meta */}
          <div className="mt-12 pt-6 border-t opacity-40 text-xs" style={{ borderColor: `${ct.text}15` }}>
            <p>آخر تحديث: {new Date(page.updatedAt).toLocaleDateString('ar-SA', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}</p>
          </div>
        </div>
      </div>
    </>
  );
}
