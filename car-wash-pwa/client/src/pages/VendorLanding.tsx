import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Star, Phone, MessageCircle, ChevronLeft, Clock,
  CheckCircle, Droplets, ArrowLeft,
  CalendarClock, ChevronRight,
} from 'lucide-react';
import api from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { VendorThemeProvider } from '../components/VendorThemeProvider';

interface TimeSlot {
  time: string;
  available: boolean;
  bookedCount: number;
  capacity: number;
}

function toArabicNumerals(str: string | number): string {
  return String(str).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
}

function formatTimeAr(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h < 12 ? 'ص' : 'م';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const mm = m === 0 ? '' : `:${toArabicNumerals(String(m).padStart(2, '0'))}`;
  return `${toArabicNumerals(h12)}${mm} ${period}`;
}

interface VendorPublic {
  id: number;
  nameAr: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  primaryColor: string;
  descriptionAr: string | null;
  city: string;
  serviceAreas: string[];
  rating: number | null;
  reviewsCount: number;
  phone: string;
  settings?: {
    storeTheme?: string;
    storeColor?: string;
    heroTextId?: string;
    customTagline?: string;
    storeSections?: {
      showRating?: boolean;
      showAreas?: boolean;
      showSlots?: boolean;
      showReviews?: boolean;
      showWhatsApp?: boolean;
      showCallButton?: boolean;
    };
    [key: string]: unknown;
  };
}

interface Package {
  id: number;
  serviceId: number;
  name: string;
  price: string;
  duration: number;
  features: string[];
  isActive: boolean;
}

interface Service {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  packages: Package[];
}

interface Review {
  id: number;
  rating: number | null;
  comment: string | null;
  ratedAt: string | null;
  customerName: string;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days < 7) return `منذ ${days} أيام`;
  if (days < 30) return `منذ ${Math.floor(days / 7)} أسابيع`;
  if (days < 365) return `منذ ${Math.floor(days / 30)} أشهر`;
  return `منذ ${Math.floor(days / 365)} سنوات`;
}

const AVATARS = ['👨‍💼', '🧑', '👨', '👩', '🧔', '👱'];
function seedAvatar(id: number) { return AVATARS[id % AVATARS.length]; }

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={star <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-slate-700 text-slate-600'}
        />
      ))}
    </div>
  );
}

function ServicesSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div key={i} className="bg-slate-800/60 rounded-2xl p-5 animate-pulse">
          <div className="h-5 bg-slate-700/80 rounded w-1/3 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2].map((j) => (
              <div key={j} className="bg-slate-700/50 rounded-xl h-28" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function VendorLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [activeServiceId, setActiveServiceId] = useState<number | null>(null);

  const { data: vendor, isLoading: vendorLoading } = useQuery<VendorPublic>({
    queryKey: ['vendor-public', slug],
    queryFn: () => api.get(`/vendors/public/${slug}`).then((r) => r.data),
    enabled: !!slug,
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ['services-public', vendor?.id],
    queryFn: () => api.get(`/services?vendorId=${vendor!.id}`).then((r) => r.data),
    enabled: !!vendor?.id,
  });

  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ['vendor-reviews', slug],
    queryFn: () => api.get(`/vendors/public/${slug}/reviews`).then((r) => r.data),
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });

  const todayDate = new Date().toISOString().slice(0, 10);
  const { data: slotsData } = useQuery<{
    appointmentMode: boolean;
    slots: TimeSlot[];
    config?: { isAppointmentMode: boolean };
  }>({
    queryKey: ['quick-slots', vendor?.id, todayDate],
    queryFn: () =>
      api.get(`/appointments/available?vendorId=${vendor!.id}&date=${todayDate}`).then((r) => r.data),
    enabled: !!vendor?.id,
  });

  const isAppointmentMode = slotsData?.appointmentMode ?? false;
  const availableSlots = (slotsData?.slots ?? []).filter((s) => s.available).slice(0, 3);

  const color = vendor?.primaryColor || '#2563eb';

  // ─── Read Store Builder settings ───────────────────────────────────────────
  const storeSettings = vendor?.settings ?? {};
  const themeId = storeSettings.storeTheme ?? 'premium-dark';
  const sections = storeSettings.storeSections ?? {
    showRating: true, showAreas: true, showSlots: true,
    showReviews: true, showWhatsApp: true, showCallButton: true,
  };
  const heroTextId = storeSettings.heroTextId ?? 'classic';
  const customTagline = storeSettings.customTagline as string | undefined;

  // Hero subtitle based on settings
  const HERO_SUBS: Record<string, string> = {
    classic: 'احجز خدمتك الآن بسهولة',
    trust: `خدمة موثوقة بتقييم ${(vendor?.rating ?? 4.9).toFixed?.(1) ?? '4.9'} من أصل 5`,
    speed: 'احجز في ثوانٍ — نوصلك في الوقت',
    quality: 'نظافة لا تقبل المنافسة — جرّب بنفسك',
    promo: 'أول غسلة بخصم خاص — لا تفوّت الفرصة',
  };
  const heroSubtitle = customTagline || HERO_SUBS[heroTextId] || HERO_SUBS.classic;

  // Theme-based style variations
  const isGlassTheme = themeId === 'premium-dark' || themeId === 'wave-water';
  const isBoldTheme = themeId === 'bold-gradient';
  const isMinimalTheme = themeId === 'minimal-speed' || themeId === 'clean-modern';

  const cardClass = isGlassTheme
    ? 'bg-white/[0.04] backdrop-blur-xl border border-white/[0.08]'
    : isBoldTheme
    ? 'bg-slate-900/80 border border-white/10'
    : 'bg-slate-900/60 border border-slate-700/40';

  const ctaClass = isBoldTheme
    ? 'rounded-full px-8'
    : isMinimalTheme
    ? 'rounded-full'
    : 'rounded-2xl';

  const glowStyle = (isGlassTheme || isBoldTheme)
    ? { boxShadow: `0 4px 30px ${color}30` }
    : {};

  const activeServices = services.filter((s) => s.isActive);
  const currentService =
    activeServiceId != null
      ? activeServices.find((s) => s.id === activeServiceId) ?? activeServices[0]
      : activeServices[0];

  if (vendorLoading) {
    return (
      <div className="min-h-screen bg-surface-1 flex items-center justify-center" dir="rtl">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent"
        />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-surface-1 flex flex-col items-center justify-center text-center px-4" dir="rtl">
        <div className="text-6xl mb-4">🚫</div>
        <h2 className="text-2xl font-black text-white mb-2">المغسلة غير موجودة</h2>
        <p className="text-slate-400 mb-6">لم نتمكن من العثور على هذه المغسلة</p>
        <Link to="/marketplace" className="btn-primary">العودة للسوق</Link>
      </div>
    );
  }

  const whatsappUrl = `https://wa.me/966${vendor.phone.replace(/^0/, '')}?text=${encodeURIComponent(`مرحباً، أريد الاستفسار عن خدماتكم في ${vendor.nameAr}`)}`;
  const callUrl = `tel:${vendor.phone}`;

  const DOMAIN = 'https://jdawil.sa';
  const storeUrl = `${DOMAIN}/store/${slug}`;
  const pageTitle = `${vendor.nameAr} — احجز خدمتك | ${vendor.city ?? ''}`;
  const pageDesc = vendor.descriptionAr
    ? `${vendor.descriptionAr} — احجز الآن عبر الإنترنت.`
    : `احجز خدمتك مع ${vendor.nameAr}${vendor.city ? ` في ${vendor.city}` : ''}. حجز سريع وآمن.`;

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: vendor.nameAr,
    url: storeUrl,
    ...(vendor.logoUrl ? { logo: vendor.logoUrl } : {}),
    ...(vendor.coverImageUrl ? { image: vendor.coverImageUrl } : {}),
    description: pageDesc,
    ...(vendor.city ? { address: { '@type': 'PostalAddress', addressLocality: vendor.city, addressCountry: 'SA' } } : {}),
    ...(vendor.phone ? { telephone: vendor.phone } : {}),
    ...(vendor.rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: vendor.rating, reviewCount: vendor.reviewsCount ?? 1, bestRating: 5 } } : {}),
    priceRange: '$$',
    paymentAccepted: 'Cash, Credit Card, STC Pay',
    currenciesAccepted: 'SAR',
    areaServed: vendor.serviceAreas?.length ? vendor.serviceAreas : vendor.city,
  };

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={storeUrl} />
        <meta property="og:type" content="business.business" />
        <meta property="og:url" content={storeUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        {vendor.coverImageUrl && <meta property="og:image" content={vendor.coverImageUrl} />}
        <meta property="og:locale" content="ar_SA" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <script type="application/ld+json">{JSON.stringify(localBusinessSchema)}</script>
        <link rel="manifest" href={`/api/manifest/${slug}.json`} />
        <meta name="theme-color" content={color} />
        <meta name="apple-mobile-web-app-title" content={vendor.nameAr} />
        {vendor.logoUrl && <link rel="apple-touch-icon" href={vendor.logoUrl} />}
      </Helmet>
    <VendorThemeProvider slug={slug}>
    <div className="min-h-screen bg-surface-1 font-arabic" dir="rtl">
      {/* Subtle background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[180px] opacity-[0.07]" style={{ background: color }} />
      </div>

      <div className="relative z-10">

        {/* ═══ HERO ═══════════════════════════════════════════════════════ */}
        <section className="relative">
          {/* Cover */}
          <div className="h-48 sm:h-64 relative">
            {vendor.coverImageUrl ? (
              <img src={vendor.coverImageUrl} alt={vendor.nameAr} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ background: `linear-gradient(160deg, ${color}25, #0a0a14 80%)` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface-1/60 to-surface-1" />
          </div>

          {/* Content */}
          <div className="max-w-3xl mx-auto px-5 -mt-16 relative z-10 pb-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              {/* Logo */}
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 shadow-xl mb-5" style={{ borderColor: `${color}40`, background: '#12121e' }}>
                {vendor.logoUrl ? (
                  <img src={vendor.logoUrl} alt={vendor.nameAr} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-black" style={{ color }}>{vendor.nameAr.charAt(0)}</div>
                )}
              </div>

              {/* Name */}
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-2">{vendor.nameAr}</h1>

              {/* Subtitle */}
              <p className="text-slate-400 text-sm leading-relaxed mb-4 max-w-xl">{heroSubtitle}</p>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-4 mb-5">
                {sections.showRating !== false && vendor.rating !== null && (
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={vendor.rating ?? 0} size={14} />
                    <span className="text-sm font-bold text-white">{(vendor.rating ?? 0).toFixed(1)}</span>
                    <span className="text-xs text-slate-600">({vendor.reviewsCount})</span>
                  </div>
                )}
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPin size={13} className="opacity-60" />
                  {vendor.city}
                </span>
              </div>

              {/* Areas */}
              {sections.showAreas !== false && vendor.serviceAreas?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {vendor.serviceAreas.map(area => (
                    <span key={area} className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/[0.04] border border-white/[0.06] text-slate-400">
                      {area}
                    </span>
                  ))}
                </div>
              )}

              {vendor.descriptionAr && (
                <p className="text-slate-500 text-xs leading-relaxed mb-5 max-w-xl">{vendor.descriptionAr}</p>
              )}

              {/* CTAs */}
              <div className="flex gap-3">
                {sections.showWhatsApp !== false && (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-95"
                    style={{ background: color }}>
                    <MessageCircle size={15} />
                    تواصل معنا
                  </a>
                )}
                {sections.showCallButton !== false && (
                  <a href={callUrl}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white/[0.05] border border-white/[0.08] text-slate-300 hover:bg-white/[0.08] transition-all active:scale-95">
                    <Phone size={15} />
                    اتصال
                  </a>
                )}
              </div>
            </motion.div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </section>

        {/* ═══ SERVICES ═══════════════════════════════════════════════ */}
        <section className="max-w-3xl mx-auto px-5 py-10">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-xl font-black text-white mb-6"
          >
            الخدمات والباقات
          </motion.h2>

          {servicesLoading ? (
            <ServicesSkeleton />
          ) : activeServices.length === 0 ? (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-10 text-center text-slate-500">
              <p>لا توجد خدمات متاحة حالياً</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {/* Service tabs */}
              <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
                {activeServices.map((service) => {
                  const isActive = (currentService?.id ?? activeServices[0]?.id) === service.id;
                  return (
                  <button
                    key={service.id}
                    onClick={() => setActiveServiceId(service.id)}
                    className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      isActive
                        ? 'text-white'
                        : 'bg-white/[0.04] border border-white/[0.06] text-slate-400 hover:text-white'
                    }`}
                    style={isActive ? { background: color } : {}}
                  >
                    {service.name}
                  </button>
                  );
                })}
              </div>

              {/* Packages grid */}
              <AnimatePresence mode="wait">
                {currentService && (
                  <motion.div
                    key={currentService.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                  >
                    {currentService.description && (
                      <p className="text-slate-400 text-sm mb-4 leading-relaxed">{currentService.description}</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {currentService.packages
                        .filter((p) => p.isActive)
                        .map((pkg, idx) => (
                          <motion.div
                            key={pkg.id}
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.06 }}
                            className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.12] transition-all duration-300 flex flex-col"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <h3 className="font-black text-white text-base">{pkg.name}</h3>
                              <div className="text-right">
                                <div className="inline-block bg-gradient-to-r from-blue-600 to-blue-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                                  {formatCurrency(pkg.price)}
                                </div>
                                <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5 justify-end">
                                  <Clock size={11} />
                                  {pkg.duration} دقيقة
                                </div>
                              </div>
                            </div>

                            {pkg.features && pkg.features.length > 0 && (
                              <ul className="space-y-1.5 mb-4 flex-1">
                                {pkg.features.map((feature, fi) => (
                                  <li key={fi} className="flex items-center gap-2 text-sm text-slate-300">
                                    <CheckCircle size={13} style={{ color }} className="shrink-0" />
                                    {feature}
                                  </li>
                                ))}
                              </ul>
                            )}

                            <Link
                              to={`/app/book/${pkg.id}?vendorId=${vendor.id}`}
                              className="mt-auto block w-full text-center font-bold text-sm py-2.5 rounded-xl transition-all active:scale-[0.97] text-white"
                              style={{ background: color }}
                            >
                              احجز الآن
                            </Link>
                          </motion.div>
                        ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </section>

        <div className="max-w-3xl mx-auto px-5"><div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" /></div>

        {/* ═══ QUICK BOOK ───────────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto px-4"><div className="h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent my-8" /></div>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <CalendarClock size={22} style={{ color }} />
                احجز موعد
              </h2>
              <Link
                to={`/store/${slug}/book`}
                className="flex items-center gap-1 text-sm font-bold transition-colors hover:opacity-80"
                style={{ color }}
              >
                عرض الكل
                <ChevronLeft size={16} />
              </Link>
            </div>

            {isAppointmentMode && availableSlots.length > 0 ? (
              <>
                <p className="text-slate-400 text-sm mb-4">أقرب المواعيد المتاحة اليوم</p>
                <div className="flex flex-wrap gap-3 mb-5">
                  {availableSlots.map((slot) => (
                    <Link
                      key={slot.time}
                      to={`/store/${slug}/book`}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all hover:brightness-110"
                      style={{
                        borderColor: `${color}50`,
                        background: `${color}15`,
                        color,
                      }}
                    >
                      <Clock size={14} />
                      {formatTimeAr(slot.time)}
                    </Link>
                  ))}
                </div>
                <Link
                  to={`/store/${slug}/book`}
                  className="block w-full text-center font-black text-base py-3.5 rounded-2xl text-white transition-all hover:brightness-110 active:scale-98"
                  style={{
                    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                    boxShadow: `0 4px 20px ${color}35`,
                  }}
                >
                  عرض كل المواعيد المتاحة
                </Link>
              </>
            ) : isAppointmentMode ? (
              <div className="text-center py-8">
                <p className="text-slate-400 text-sm mb-4">لا توجد مواعيد متاحة اليوم</p>
                <Link
                  to={`/store/${slug}/book`}
                  className="inline-flex items-center gap-2 font-black text-base px-8 py-3.5 rounded-2xl text-white transition-all hover:brightness-110"
                  style={{
                    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                    boxShadow: `0 4px 20px ${color}35`,
                  }}
                >
                  <CalendarClock size={18} />
                  احجز موعدك
                </Link>
              </div>
            ) : (
              /* Walk-in mode fallback */
              <div className="flex flex-wrap gap-3">
                <a
                  href={`https://wa.me/966${vendor?.phone?.replace(/^0/, '')}?text=${encodeURIComponent(`مرحباً، أريد الحجز في ${vendor?.nameAr}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 font-black text-sm px-5 py-3 rounded-xl text-white transition-all active:scale-95"
                  style={{ backgroundColor: '#25D366', boxShadow: '0 4px 16px rgba(37,211,102,0.35)' }}
                >
                  <MessageCircle size={16} />
                  احجز الآن عبر واتساب
                </a>
              </div>
            )}
          </motion.div>
        </div>

        {/* ─── REVIEWS (controlled by Store Builder) ─────────────────── */}
        {sections.showReviews !== false && (<>
        <div className="max-w-4xl mx-auto px-4"><div className="h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent my-8" /></div>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex items-center justify-between mb-6"
          >
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <Star size={22} className="fill-amber-400 text-amber-400" />
              آراء العملاء
            </h2>
            {reviews.length > 0 && (
              <div className="glass-premium rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-3xl font-black text-amber-400">{vendor.rating?.toFixed(1)}</span>
                <div className="flex flex-col gap-0.5">
                  {[5,4,3,2,1].map((star) => {
                    const count = reviews.filter(r => r.rating === star).length;
                    const pct = reviews.length ? Math.round(count / reviews.length * 100) : 0;
                    return (
                      <div key={star} className="flex items-center gap-1">
                        <span className="text-slate-500 text-[10px] w-2">{star}</span>
                        <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {reviews.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-3">⭐</p>
              <p className="text-slate-400 text-sm">لا توجد تقييمات بعد</p>
              <p className="text-slate-600 text-xs mt-1">كن أول من يقيّم هذه المغسلة</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {reviews.slice(0, 6).map((review, idx) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="glass-premium rounded-2xl p-5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700/70 flex items-center justify-center text-xl">
                      {seedAvatar(review.id)}
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">{review.customerName}</p>
                      <p className="text-slate-500 text-xs">{timeAgo(review.ratedAt)}</p>
                    </div>
                  </div>
                  <StarRating rating={review.rating ?? 0} size={13} />
                  {review.comment && (
                    <p className="text-slate-300 text-sm mt-2 leading-relaxed line-clamp-3">{review.comment}</p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
        </>)}

        {/* ─── FOOTER ─────────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto px-4 py-8 pb-16">
          <p className="text-center text-slate-600 text-[10px] mt-8 opacity-40">
            Powered by Jadawel
          </p>
        </div>
      </div>
    </div>
    </VendorThemeProvider>
    </>
  );
}
