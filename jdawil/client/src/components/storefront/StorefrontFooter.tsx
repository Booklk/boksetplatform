/**
 * StorefrontFooter — vendor storefront footer with:
 *   - The vendor's custom pages that opted into nav.
 *   - Always-visible links: unified Privacy policy, the vendor's Terms
 *     (when present), and the "Powered by Jdawil" mark (unless the
 *     vendor turned on white-label or is on a custom domain).
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Shield, FileCheck } from 'lucide-react';
import api from '../../lib/api';
import { CustomTheme, RADIUS_VALUES } from '../../lib/customTheme';

interface NavPage {
  slug: string;
  title: string;
  kind: 'custom' | 'terms';
  sortOrder: number;
}

interface Props {
  vendorSlug: string;
  customTheme: CustomTheme;
  whiteLabel: boolean;
}

export default function StorefrontFooter({ vendorSlug, customTheme, whiteLabel }: Props) {
  const { data } = useQuery<{ pages: NavPage[] }>({
    queryKey: ['vendor-nav-pages', vendorSlug],
    queryFn: () => api.get(`/pages/public/${vendorSlug}/nav`).then((r) => r.data),
    enabled: !!vendorSlug,
    staleTime: 5 * 60 * 1000,
  });

  const pages = data?.pages ?? [];
  const termsPage = pages.find((p) => p.kind === 'terms');
  const customPages = pages.filter((p) => p.kind === 'custom');

  const linkStyle: React.CSSProperties = {
    color: customTheme.text,
    borderRadius: RADIUS_VALUES[customTheme.radius],
  };

  return (
    <footer
      className="mt-10 border-t"
      style={{ borderColor: `${customTheme.text}15`, color: customTheme.text }}
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Pages list */}
        {(customPages.length > 0 || termsPage) && (
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-6">
            {customPages.map((p) => (
              <Link
                key={p.slug}
                to={`/store/${vendorSlug}/p/${p.slug}`}
                className="text-sm opacity-70 hover:opacity-100 transition-opacity"
                style={linkStyle}
              >
                {p.title}
              </Link>
            ))}
            {termsPage && (
              <Link
                to={`/store/${vendorSlug}/p/${termsPage.slug}`}
                className="text-sm opacity-70 hover:opacity-100 transition-opacity inline-flex items-center gap-1.5"
                style={linkStyle}
              >
                <FileCheck size={12} />
                {termsPage.title}
              </Link>
            )}
            {/* Unified platform privacy — served from /privacy on the
                platform. On a vendor's custom domain this opens Jdawil's
                privacy page in a new tab; on the platform itself it's a
                same-site link. */}
            <a
              href="https://jdawil.sa/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm opacity-70 hover:opacity-100 transition-opacity inline-flex items-center gap-1.5"
              style={linkStyle}
            >
              <Shield size={12} />
              سياسة الخصوصية
            </a>
          </nav>
        )}

        {/* "Powered by" mark */}
        {!whiteLabel && (
          <p className="text-center text-[10px] opacity-40" style={{ color: customTheme.text }}>
            Powered by{' '}
            <a href="https://jdawil.sa" target="_blank" rel="noopener noreferrer" className="hover:opacity-100">
              Jdawil
            </a>
          </p>
        )}
      </div>
    </footer>
  );
}
