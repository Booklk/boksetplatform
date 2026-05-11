/**
 * GallerySection — storefront image gallery for templates that declare
 * features.gallery (spa, studio, salon, beauty-at-home).
 *
 * Reads GET /api/photos/gallery/:slug which combines:
 *   (a) vendor-curated URLs from settings.gallery[]
 *   (b) recent "after" photos from completed bookings
 */

import { useQuery } from '@tanstack/react-query';
import { ImageIcon } from 'lucide-react';
import api from '../../lib/api';

interface GalleryItem {
  url: string;
  caption: string | null;
  source: 'curated' | 'booking';
}

interface GalleryResponse {
  items: GalleryItem[];
}

export default function GallerySection({
  vendorSlug,
  surface,
  text,
  accent,
  radius,
}: {
  vendorSlug: string;
  surface: string;
  text: string;
  accent: string;
  radius: string;
}) {
  const { data, isLoading } = useQuery<GalleryResponse>({
    queryKey: ['vendor-gallery', vendorSlug],
    queryFn: () => api.get(`/photos/gallery/${encodeURIComponent(vendorSlug)}?limit=12`).then((r) => r.data),
    enabled: !!vendorSlug,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return null;
  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="max-w-3xl mx-auto px-5 py-10" dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <ImageIcon size={16} style={{ color: accent }} />
        <h2 className="text-base font-black" style={{ color: text }}>معرض أعمالنا</h2>
        <span className="text-[10px] opacity-60 mr-auto" style={{ color: text }}>
          {items.length} صورة
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {items.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative aspect-square overflow-hidden group"
            style={{ background: surface, borderRadius: radius }}
          >
            <img
              src={item.url}
              alt={item.caption ?? `عمل ${i + 1}`}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {item.caption && (
              <div
                className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <p className="text-[10px] text-white font-bold line-clamp-2">{item.caption}</p>
              </div>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}
