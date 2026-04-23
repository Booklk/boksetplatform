/**
 * StorefrontHeader — public-facing announcement bar + hero media for the
 * customer-visible storefront. Renders nothing if the vendor hasn't set
 * any media (or is on the free plan).
 *
 * Fetches from the authenticated-exempt endpoint
 * GET /api/vendor-storefront/public/:slug — which already applies all
 * the scheduling + plan gating server-side, so this component just
 * renders what it gets.
 */

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import api from '../../lib/api';
import BrandStyleProvider from './BrandStyleProvider';

type Tone = 'info' | 'success' | 'warn' | 'danger' | 'brand';

interface Announcement {
  text: string;
  href: string | null;
  tone: Tone;
}
interface Hero {
  mediaType: 'none' | 'image' | 'video';
  mediaUrl: string;
  posterUrl: string;
  headlineAr: string;
  subheadlineAr: string;
  ctaLabelAr: string;
  ctaHref: string;
}
interface BrandPayload {
  colors: { primary: string; accent: string; background: string; surface: string; text: string };
  fonts:  { heading: string; body: string };
  typographyScale: 'compact' | 'comfortable' | 'spacious';
  buttonShape:     'rounded' | 'pill' | 'square';
  identity: { logoUrl: string; faviconUrl: string; ogImageUrl: string };
}
interface PublicStorefront {
  announcement: Announcement | null;
  hero: Hero;
  brand?: BrandPayload;
  merchantNumber?: string;
}

const TONE_BG: Record<Tone, string> = {
  info:    'bg-sky-500 text-white',
  success: 'bg-emerald-500 text-white',
  warn:    'bg-amber-500 text-slate-900',
  danger:  'bg-rose-500 text-white',
  brand:   'bg-indigo-600 text-white',
};

export default function StorefrontHeader({ slug, brandColor }: { slug: string; brandColor?: string }) {
  const { data } = useQuery<PublicStorefront>({
    queryKey: ['storefront-public', slug],
    queryFn: async () => (await api.get(`/vendor-storefront/public/${slug}`)).data,
    staleTime: 60_000,
  });

  const announcement = data?.announcement ?? null;
  const hero = data?.hero ?? null;
  const heroVisible = hero && hero.mediaType !== 'none' && (hero.mediaUrl || hero.headlineAr);

  return (
    <>
      {data?.brand && <BrandStyleProvider brand={data.brand} />}
      {announcement && <AnnouncementBar a={announcement} />}
      {heroVisible && <HeroMedia hero={hero} brandColor={brandColor} />}
    </>
  );
}

function AnnouncementBar({ a }: { a: Announcement }) {
  const inner = (
    <div className={`w-full ${TONE_BG[a.tone]} text-center text-xs sm:text-sm font-bold px-4 py-2 flex items-center justify-center gap-2`}>
      <span>{a.text}</span>
      {a.href && <ArrowLeft size={14} className="shrink-0" />}
    </div>
  );
  if (a.href) {
    return (
      <a href={a.href} target={a.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="block hover:opacity-95 transition-opacity">
        {inner}
      </a>
    );
  }
  return inner;
}

function HeroMedia({ hero, brandColor }: { hero: Hero; brandColor?: string }) {
  const yt = hero.mediaUrl.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  const vm = hero.mediaUrl.match(/vimeo\.com\/(\d+)/);

  return (
    <section className="relative aspect-[21/9] sm:aspect-[21/8] w-full overflow-hidden bg-slate-900">
      {/* Media layer */}
      {hero.mediaType === 'video' && yt && (
        <iframe
          className="absolute inset-0 w-full h-full pointer-events-none scale-[1.2]"
          src={`https://www.youtube.com/embed/${yt[1]}?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&controls=0&showinfo=0&modestbranding=1&playsinline=1`}
          allow="autoplay; encrypted-media; picture-in-picture"
          title="hero"
        />
      )}
      {hero.mediaType === 'video' && vm && (
        <iframe
          className="absolute inset-0 w-full h-full pointer-events-none"
          src={`https://player.vimeo.com/video/${vm[1]}?autoplay=1&muted=1&loop=1&background=1`}
          allow="autoplay; fullscreen; picture-in-picture"
          title="hero"
        />
      )}
      {hero.mediaType === 'video' && hero.mediaUrl && !yt && !vm && (
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={hero.mediaUrl}
          poster={hero.posterUrl || undefined}
          autoPlay muted loop playsInline
        />
      )}
      {hero.mediaType === 'image' && hero.mediaUrl && (
        <img src={hero.mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}

      {/* Gradient overlay for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />

      {/* Copy layer */}
      <div className="relative h-full px-6 sm:px-10 pb-8 sm:pb-12 flex flex-col justify-end max-w-4xl" dir="rtl">
        {hero.headlineAr && (
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-2xl sm:text-4xl md:text-5xl font-black text-white leading-tight mb-2 sm:mb-3 drop-shadow-lg"
          >
            {hero.headlineAr}
          </motion.h1>
        )}
        {hero.subheadlineAr && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-sm sm:text-base text-white/90 max-w-xl mb-4 sm:mb-6 leading-relaxed drop-shadow"
          >
            {hero.subheadlineAr}
          </motion.p>
        )}
        {hero.ctaLabelAr && hero.ctaHref && (
          <motion.a
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            href={hero.ctaHref}
            className="self-start inline-flex items-center gap-2 h-11 px-5 rounded-2xl bg-white text-slate-900 font-black text-sm shadow-lg hover:scale-[1.02] transition-transform"
            style={brandColor ? { background: brandColor, color: '#fff' } : undefined}
          >
            {hero.ctaLabelAr}
            <ArrowLeft size={15} />
          </motion.a>
        )}
      </div>
    </section>
  );
}
