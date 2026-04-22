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
 * Pocket markdown renderer — enough for vendor-authored pages to look
 * good without pulling in a full markdown engine.
 *
 * Supports:
 *   # / ## / ### headings
 *   - or * bullet lists
 *   1. numbered lists
 *   > blockquote
 *   | table | with | pipes |
 *   ```code blocks```
 *   ![alt](https-url) images (HTTPS only, basic sanitising)
 *   [text](https-url) links
 *   **bold**, *italic*, `inline code`
 *   blank line → paragraph break
 *
 * Everything is HTML-escaped first, so the vendor can't inject raw
 * HTML/JS. Only http(s) URLs are accepted in links + images.
 */
function renderMarkdown(md: string): { __html: string } {
  const escape = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const safeUrl = (u: string): string | null => {
    const trimmed = u.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^\/[^/]/.test(trimmed)) return trimmed; // relative path
    return null;
  };

  const inlineFmt = (s: string): string => {
    let r = escape(s);
    // Inline code first so its contents don't get further-parsed.
    r = r.replace(/`([^`]+?)`/g, '<code>$1</code>');
    // Images ![alt](url)
    r = r.replace(/!\[([^\]]*?)\]\(([^)\s]+?)\)/g, (_m, alt: string, url: string) => {
      const safe = safeUrl(url);
      if (!safe) return '';
      return `<img src="${escape(safe)}" alt="${alt}" loading="lazy" />`;
    });
    // Links [text](url)
    r = r.replace(/\[([^\]]+?)\]\(([^)\s]+?)\)/g, (_m, text: string, url: string) => {
      const safe = safeUrl(url);
      if (!safe) return text;
      return `<a href="${escape(safe)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });
    // Bold + italic
    r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    r = r.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
    return r;
  };

  const lines = md.split('\n');
  const out: string[] = [];

  let listKind: 'ul' | 'ol' | null = null;
  let inQuote = false;
  let codeFence = false;
  let codeBuf: string[] = [];
  let tableHeader: string[] | null = null;
  let tableRows: string[][] = [];
  let inTable = false;

  const closeList = () => {
    if (listKind) { out.push(`</${listKind}>`); listKind = null; }
  };
  const closeQuote = () => {
    if (inQuote) { out.push('</blockquote>'); inQuote = false; }
  };
  const closeTable = () => {
    if (inTable && tableHeader) {
      out.push('<div class="table-wrap"><table>');
      out.push('<thead><tr>');
      for (const h of tableHeader) out.push(`<th>${inlineFmt(h)}</th>`);
      out.push('</tr></thead><tbody>');
      for (const row of tableRows) {
        out.push('<tr>');
        for (const c of row) out.push(`<td>${inlineFmt(c)}</td>`);
        out.push('</tr>');
      }
      out.push('</tbody></table></div>');
    }
    inTable = false;
    tableHeader = null;
    tableRows = [];
  };
  const closeAll = () => { closeList(); closeQuote(); closeTable(); };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Code-fence start/end
    if (/^```/.test(line)) {
      if (!codeFence) {
        closeAll();
        codeFence = true;
        codeBuf = [];
      } else {
        out.push(`<pre><code>${escape(codeBuf.join('\n'))}</code></pre>`);
        codeFence = false;
        codeBuf = [];
      }
      continue;
    }
    if (codeFence) { codeBuf.push(raw); continue; }

    if (!line.trim()) { closeAll(); continue; }

    // Table row (pipe-separated)
    if (line.startsWith('|') && line.endsWith('|') && line.includes('|', 1)) {
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());
      const isSeparator = cells.every((c) => /^:?-+:?$/.test(c));
      if (!inTable) {
        closeList(); closeQuote();
        inTable = true;
        tableHeader = cells;
        continue;
      }
      if (isSeparator) continue; // skip the --- row
      tableRows.push(cells);
      continue;
    }
    if (inTable) closeTable();

    // Headings
    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3) { closeAll(); out.push(`<h3>${inlineFmt(h3[1])}</h3>`); continue; }
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) { closeAll(); out.push(`<h2>${inlineFmt(h2[1])}</h2>`); continue; }
    const h1 = /^#\s+(.+)$/.exec(line);
    if (h1) { closeAll(); out.push(`<h1>${inlineFmt(h1[1])}</h1>`); continue; }

    // Blockquote
    const bq = /^>\s?(.*)$/.exec(line);
    if (bq) {
      closeList();
      if (!inQuote) { out.push('<blockquote>'); inQuote = true; }
      out.push(`<p>${inlineFmt(bq[1])}</p>`);
      continue;
    }
    if (inQuote) closeQuote();

    // Unordered list
    const ul = /^[-*]\s+(.+)$/.exec(line);
    if (ul) {
      if (listKind !== 'ul') { closeList(); out.push('<ul>'); listKind = 'ul'; }
      out.push(`<li>${inlineFmt(ul[1])}</li>`);
      continue;
    }
    // Ordered list
    const ol = /^\d+[.)]\s+(.+)$/.exec(line);
    if (ol) {
      if (listKind !== 'ol') { closeList(); out.push('<ol>'); listKind = 'ol'; }
      out.push(`<li>${inlineFmt(ol[1])}</li>`);
      continue;
    }
    if (listKind) closeList();

    // Paragraph fallback
    out.push(`<p>${inlineFmt(line)}</p>`);
  }

  // Final cleanup
  if (codeFence) out.push(`<pre><code>${escape(codeBuf.join('\n'))}</code></pre>`);
  closeAll();

  return { __html: out.join('\n') };
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
