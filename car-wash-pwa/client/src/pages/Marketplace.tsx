import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, MapPin, Star, Users, ChevronLeft, Droplets, Sparkles, ArrowLeft, SlidersHorizontal, TrendingUp, DollarSign, Clock } from 'lucide-react';
import api from '../lib/api';

type SortBy = 'rating' | 'reviews' | 'price_asc' | 'newest';

interface Vendor {
  id: number;
  nameAr: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  primaryColor: string | null;
  descriptionAr: string | null;
  city: string;
  serviceAreas: string[];
  rating: number | null;
  reviewsCount: number;
  phone: string;
  industry: string;
  minPrice: string | null;
  createdAt: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3.5 h-3.5 ${
            star <= Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'fill-slate-700 text-slate-700'
          }`}
        />
      ))}
    </div>
  );
}

function VendorCardSkeleton() {
  return (
    <div className="glass rounded-3xl overflow-hidden animate-pulse">
      <div className="h-44 bg-slate-800/80" />
      <div className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-700/80 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-slate-700/80 rounded-lg w-3/4" />
            <div className="h-3.5 bg-slate-700/60 rounded w-1/2" />
          </div>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-16 bg-slate-700/60 rounded-full" />
          ))}
        </div>
        <div className="h-10 bg-slate-700/60 rounded-xl" />
      </div>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-full flex flex-col items-center justify-center py-20 text-center"
    >
      <svg
        viewBox="0 0 200 180"
        className="w-48 h-40 mb-6 opacity-60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse cx="100" cy="160" rx="70" ry="10" fill="#1e3a8a" opacity="0.3" />
        <rect x="40" y="60" width="120" height="85" rx="18" fill="#1e3a8a" opacity="0.6" />
        <rect x="55" y="75" width="90" height="55" rx="10" fill="#0f172a" opacity="0.7" />
        <circle cx="68" cy="155" r="14" fill="#334155" />
        <circle cx="68" cy="155" r="8" fill="#1e293b" />
        <circle cx="132" cy="155" r="14" fill="#334155" />
        <circle cx="132" cy="155" r="8" fill="#1e293b" />
        <path d="M40 95 L25 105 L25 120 L40 120" fill="#1e3a8a" opacity="0.5" />
        <path d="M160 95 L175 105 L175 120 L160 120" fill="#1e3a8a" opacity="0.5" />
        <circle cx="85" cy="102" r="12" fill="#2563eb" opacity="0.4" />
        <circle cx="115" cy="102" r="12" fill="#2563eb" opacity="0.4" />
        <path d="M85 30 Q100 10 115 30" stroke="#38bdf8" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="100" cy="35" r="4" fill="#38bdf8" opacity="0.8" />
        <path d="M70 20 Q80 8 90 20" stroke="#7dd3fc" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
        <path d="M110 20 Q120 8 130 20" stroke="#7dd3fc" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
        <line x1="100" y1="39" x2="100" y2="58" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 3" opacity="0.5" />
        <circle cx="150" cy="35" r="5" fill="#38bdf8" opacity="0.3">
          <animate attributeName="cy" values="35;28;35" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="55" cy="45" r="4" fill="#7dd3fc" opacity="0.3">
          <animate attributeName="cy" values="45;38;45" dur="2.5s" repeatCount="indefinite" />
        </circle>
      </svg>
      <h3 className="text-xl font-black text-white mb-2">
        {query ? `لا نتائج لـ "${query}"` : 'لا توجد مغاسل بعد'}
      </h3>
      <p className="text-slate-400 text-sm max-w-xs">
        {query
          ? 'جرب البحث بكلمات أخرى أو اختر منطقة مختلفة'
          : 'كن أول من ينضم إلى المنصة وابدأ رحلة النجاح'}
      </p>
    </motion.div>
  );
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

const SORT_OPTIONS: { value: SortBy; label: string; icon: typeof Star }[] = [
  { value: 'rating',    label: 'الأعلى تقييماً', icon: Star },
  { value: 'reviews',   label: 'الأكثر تقييماً', icon: TrendingUp },
  { value: 'price_asc', label: 'الأقل سعراً',     icon: DollarSign },
  { value: 'newest',    label: 'الأحدث',           icon: Clock },
];

export default function Marketplace() {
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('rating');
  const [showSort, setShowSort] = useState(false);

  const { data: industries = [] } = useQuery<Array<{ key: string; nameAr: string }>>({
    queryKey: ['industries'],
    queryFn: () => api.get('/vendors/industries').then(r => r.data),
    staleTime: 1000 * 60 * 60,
  });

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ['vendors-public', selectedIndustry],
    queryFn: () => api.get(`/vendors/public${selectedIndustry ? `?industry=${selectedIndustry}` : ''}`).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });

  const cities = useMemo(() => {
    const all = vendors.map((v) => v.city).filter(Boolean);
    return [...new Set(all)];
  }, [vendors]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = vendors.filter((v) => {
      const matchesSearch =
        !q ||
        v.nameAr.toLowerCase().includes(q) ||
        v.city.toLowerCase().includes(q) ||
        v.serviceAreas?.some((a) => a.toLowerCase().includes(q));
      const matchesCity = !selectedCity || v.city === selectedCity;
      return matchesSearch && matchesCity;
    });

    return [...base].sort((a, b) => {
      if (sortBy === 'rating')    return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === 'reviews')   return b.reviewsCount - a.reviewsCount;
      if (sortBy === 'price_asc') return parseFloat(a.minPrice ?? '9999') - parseFloat(b.minPrice ?? '9999');
      if (sortBy === 'newest')    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });
  }, [vendors, search, selectedCity, sortBy]);

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-brand-950 to-blue-950" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, #2563eb44 0%, transparent 50%), radial-gradient(circle at 80% 20%, #7c3aed44 0%, transparent 50%)',
          }}
        />
        {/* Animated droplets */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-3 rounded-full bg-blue-400/20"
              style={{ left: `${10 + i * 15}%`, top: '-10%' }}
              animate={{ y: ['0vh', '110vh'] }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                delay: i * 0.8,
                ease: 'linear',
              }}
            />
          ))}
        </div>

        <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <Droplets className="w-10 h-10 text-blue-400" />
              </motion.div>
              <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
                منصة{' '}
                <span className="bg-gradient-to-l from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Bokset
                </span>
              </h1>
              <motion.div
                animate={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
              >
                <Sparkles className="w-10 h-10 text-purple-400" />
              </motion.div>
            </div>
            <p className="text-slate-300 text-lg md:text-xl max-w-xl mx-auto mb-8">
              اكتشف أفضل مغاسل السيارات في منطقتك واحجز موعدك بضغطة واحدة
            </p>

            {/* Search bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو المنطقة..."
                  className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl pr-12 pl-4 py-4 text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300 text-base"
                />
              </div>
            </div>

            {/* Industry filters */}
            {industries.length > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap items-center justify-center gap-2 mt-4"
              >
                <button
                  onClick={() => setSelectedIndustry('')}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-200 ${
                    !selectedIndustry
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20 border border-white/10'
                  }`}
                >
                  جميع الخدمات
                </button>
                {industries.map((ind) => (
                  <button
                    key={ind.key}
                    onClick={() => setSelectedIndustry(ind.key === selectedIndustry ? '' : ind.key)}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-200 ${
                      selectedIndustry === ind.key
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20 border border-white/10'
                    }`}
                  >
                    {ind.nameAr}
                  </button>
                ))}
              </motion.div>
            )}

            {/* City filters */}
            {cities.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap items-center justify-center gap-2 mt-4"
              >
                <button
                  onClick={() => setSelectedCity('')}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-200 ${
                    !selectedCity
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20 border border-white/10'
                  }`}
                >
                  جميع المدن
                </button>
                {cities.map((city) => (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(city === selectedCity ? '' : city)}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-200 ${
                      selectedCity === city
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20 border border-white/10'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Results count + sort */}
        {!isLoading && vendors.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between mb-6"
          >
            <p className="text-slate-400 text-sm">
              {filtered.length} مزود خدمة{search || selectedCity || selectedIndustry ? ' (نتائج مفلترة)' : ''}
            </p>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSort((v) => !v)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl px-3 py-2 text-slate-300 text-sm transition-all"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
              </button>
              {showSort && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute left-0 top-full mt-2 bg-slate-800 border border-slate-700 rounded-2xl p-1.5 shadow-2xl z-20 min-w-[170px]"
                >
                  {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => { setSortBy(value); setShowSort(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                        sortBy === value
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {isLoading
            ? [...Array(6)].map((_, i) => <VendorCardSkeleton key={i} />)
            : filtered.length === 0
            ? <EmptyState query={search} />
            : filtered.map((vendor) => (
                <motion.div key={vendor.id} variants={cardVariants}>
                  <VendorCard vendor={vendor} />
                </motion.div>
              ))}
        </motion.div>
      </div>

      {/* Join CTA Banner */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl"
        >
          <div className="absolute inset-0 bg-gradient-to-l from-purple-900/90 via-blue-900/90 to-indigo-900/90" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at 10% 50%, #7c3aed33 0%, transparent 40%), radial-gradient(circle at 90% 50%, #2563eb33 0%, transparent 40%)',
            }}
          />
          <div className="relative px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span className="text-purple-300 text-sm font-bold">انضم إلى منصة Bokset</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-white mb-2">
                هل تمتلك مغسلة سيارات؟
              </h3>
              <p className="text-slate-300 text-sm md:text-base max-w-md">
                انضم إلى أكبر منصة مغاسل سيارات في المملكة وابدأ في استقبال الحجوزات الإلكترونية اليوم
              </p>
            </div>
            <Link
              to="/onboard"
              className="shrink-0 group flex items-center gap-2 bg-gradient-to-l from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black px-8 py-4 rounded-2xl shadow-2xl shadow-purple-600/30 transition-all duration-300 hover:scale-105 active:scale-95 text-base whitespace-nowrap"
            >
              انضم بمغسلتك
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function VendorCard({ vendor }: { vendor: Vendor }) {
  const primaryColor = vendor.primaryColor || '#2563eb';

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="group relative bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden hover:border-white/20 hover:shadow-2xl transition-all duration-300"
      style={{
        boxShadow: `0 4px 30px ${primaryColor}15`,
      }}
    >
      {/* Cover Image */}
      <div className="relative h-44 overflow-hidden">
        {vendor.coverImageUrl ? (
          <img
            src={vendor.coverImageUrl}
            alt={vendor.nameAr}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}33 0%, ${primaryColor}15 50%, #0f172a 100%)`,
            }}
          >
            <Droplets
              className="w-16 h-16 opacity-30"
              style={{ color: primaryColor }}
            />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

        {/* Rating badge */}
        {vendor.rating && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-2.5 py-1">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-white text-xs font-bold">{vendor.rating.toFixed(1)}</span>
          </div>
        )}

        {/* Starting price badge */}
        {vendor.minPrice && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-emerald-500/90 backdrop-blur-md rounded-full px-2.5 py-1">
            <span className="text-white text-xs font-black">من {Math.round(parseFloat(vendor.minPrice))} ريال</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Logo + Name */}
        <div className="flex items-start gap-3 mb-3 -mt-8 relative z-10">
          <div
            className="w-14 h-14 rounded-2xl border-2 border-white/20 overflow-hidden bg-slate-800 shrink-0 shadow-xl"
            style={{ borderColor: `${primaryColor}40` }}
          >
            {vendor.logoUrl ? (
              <img
                src={vendor.logoUrl}
                alt={vendor.nameAr}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-xl font-black"
                style={{ background: `${primaryColor}33`, color: primaryColor }}
              >
                {vendor.nameAr.charAt(0)}
              </div>
            )}
          </div>
          <div className="pt-8">
            <h3 className="text-white font-black text-base leading-tight">{vendor.nameAr}</h3>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400 text-xs">{vendor.city}</span>
            </div>
          </div>
        </div>

        {/* Stars + review count */}
        {vendor.rating !== null && (
          <div className="flex items-center gap-2 mb-3">
            <StarRating rating={vendor.rating ?? 0} />
            {vendor.reviewsCount > 0 && (
              <span className="text-slate-500 text-xs flex items-center gap-1">
                <Users className="w-3 h-3" />
                {vendor.reviewsCount} تقييم
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {vendor.descriptionAr && (
          <p className="text-slate-400 text-xs line-clamp-2 mb-3 leading-relaxed">
            {vendor.descriptionAr}
          </p>
        )}

        {/* Service areas */}
        {vendor.serviceAreas?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {vendor.serviceAreas.slice(0, 3).map((area) => (
              <span
                key={area}
                className="px-2.5 py-1 rounded-full text-xs font-semibold border"
                style={{
                  backgroundColor: `${primaryColor}15`,
                  borderColor: `${primaryColor}30`,
                  color: primaryColor,
                }}
              >
                {area}
              </span>
            ))}
            {vendor.serviceAreas.length > 3 && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-400">
                +{vendor.serviceAreas.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Price + CTA row */}
        <div className="flex items-center gap-3 mt-2">
          {vendor.minPrice && (
            <div className="flex flex-col">
              <span className="text-slate-500 text-[10px]">يبدأ من</span>
              <span className="text-emerald-400 font-black text-sm">{Math.round(parseFloat(vendor.minPrice))} ريال</span>
            </div>
          )}
          <Link
            to={`/store/${vendor.slug}`}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
              boxShadow: `0 4px 20px ${primaryColor}40`,
            }}
          >
            احجز الآن
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
