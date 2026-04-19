import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, CreditCard, BarChart3, Users, MapPin, CheckCircle,
  ArrowLeft, Smartphone, Layout, Shield, MessageCircle, TrendingUp,
  Package, Star, Clock, CalendarCheck, Phone, Zap, ChevronLeft,
} from 'lucide-react';
import MarketingLayout from '../components/marketing/MarketingLayout';

// ─── Industry Data ───────────────────────────────────────────────────────────

const industries = [
  {
    id: 'salon', icon: '💈', name: 'صالون / حلاقة',
    services: ['قص شعر — 30 ر.س', 'قص + لحية — 50 ر.س', 'صبغة — 80 ر.س', 'بروتين — 200 ر.س', 'حمام مغربي — 150 ر.س'],
    color: '#8b5cf6',
    mockStats: { bookings: 47, revenue: '4,250', rating: 4.9, customers: 156 },
    heroText: 'احجز موعدك الآن',
  },
  {
    id: 'beauty', icon: '💄', name: 'تجميل منزلي',
    services: ['مكياج سهرة — 300 ر.س', 'مكياج عروس — 800 ر.س', 'مانيكير + بديكير — 120 ر.س', 'مساج — 250 ر.س', 'هيدرافيشل — 350 ر.س'],
    color: '#ec4899',
    mockStats: { bookings: 32, revenue: '8,400', rating: 4.8, customers: 89 },
    heroText: 'احجزي موعدك',
  },
  {
    id: 'car_wash', icon: '🚗', name: 'مغسلة سيارات',
    services: ['غسيل خارجي — 50 ر.س', 'غسيل كامل — 120 ر.س', 'بوليش — 250 ر.س', 'نانو سيراميك — 500 ر.س', 'تنظيف محرك — 100 ر.س'],
    color: '#3b82f6',
    mockStats: { bookings: 63, revenue: '5,870', rating: 4.7, customers: 234 },
    heroText: 'احجز غسلتك',
  },
  {
    id: 'cleaning', icon: '🏠', name: 'تنظيف منازل',
    services: ['شقة صغيرة — 150 ر.س', 'شقة كبيرة — 250 ر.س', 'فيلا — 700 ر.س', 'بعد البناء — 500 ر.س', 'تعقيم — 300 ر.س'],
    color: '#10b981',
    mockStats: { bookings: 28, revenue: '6,200', rating: 4.9, customers: 67 },
    heroText: 'احجز زيارة التنظيف',
  },
  {
    id: 'ac', icon: '❄️', name: 'صيانة مكيفات',
    services: ['تنظيف سبليت — 100 ر.س', 'تنظيف دولابي — 150 ر.س', 'شحن فريون — 250 ر.س', 'فحص شامل — 200 ر.س', 'تركيب — 350 ر.س'],
    color: '#06b6d4',
    mockStats: { bookings: 41, revenue: '5,100', rating: 4.6, customers: 112 },
    heroText: 'اطلب صيانة',
  },
  {
    id: 'freelancer', icon: '💼', name: 'فري لانسر',
    services: ['جلسة تصوير — 200 ر.س', 'تدريب شخصي — 150 ر.س', 'درس خصوصي — 80 ر.س', 'استشارة — 100 ر.س', 'طبخ منزلي — 250 ر.س'],
    color: '#f59e0b',
    mockStats: { bookings: 19, revenue: '2,850', rating: 5.0, customers: 43 },
    heroText: 'احجز الآن',
  },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay },
});

// ─── Phone Mockup ────────────────────────────────────────────────────────────

function PhoneMockup({ industry }: { industry: typeof industries[0] }) {
  return (
    <div className="w-[240px] mx-auto">
      <div className="rounded-[2.2rem] border-2 border-white/[0.1] bg-[#0a0a14] p-1.5 shadow-2xl">
        <div className="rounded-[1.8rem] overflow-hidden bg-surface-1" style={{ aspectRatio: '9/19' }}>
          {/* Notch */}
          <div className="relative h-6 flex items-center justify-center">
            <div className="w-16 h-3.5 bg-black rounded-full" />
          </div>

          {/* Hero */}
          <div className="h-20 relative px-3 flex flex-col justify-end pb-2"
            style={{ background: `linear-gradient(135deg, ${industry.color}, ${industry.color}80)` }}>
            <div className="w-7 h-7 rounded-lg bg-white/20 mb-1" />
            <div className="h-2 w-20 bg-white/50 rounded-full mb-0.5" />
            <div className="h-1.5 w-14 bg-white/30 rounded-full" />
          </div>

          {/* Rating */}
          <div className="px-3 pt-2 flex items-center gap-0.5">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ background: `${industry.color}90` }} />
            ))}
            <span className="text-[8px] text-slate-500 mr-1">{industry.mockStats.rating}</span>
          </div>

          {/* Services */}
          <div className="px-3 pt-2 space-y-1.5">
            {industry.services.slice(0, 3).map((svc, i) => (
              <motion.div
                key={svc}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.15 }}
                className="flex items-center justify-between p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]"
              >
                <div>
                  <div className="h-1.5 w-14 bg-white/20 rounded-full mb-0.5" />
                  <div className="h-1 w-8 bg-white/10 rounded-full" />
                </div>
                <span className="text-[7px] font-bold" style={{ color: industry.color }}>
                  {svc.split('—')[1]?.trim()}
                </span>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <div className="px-3 pt-2">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="h-7 rounded-lg flex items-center justify-center"
              style={{ background: industry.color }}
            >
              <span className="text-[8px] text-white font-bold">{industry.heroText}</span>
            </motion.div>
          </div>

          {/* Bottom bar */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-white/15 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Mockup ────────────────────────────────────────────────────────

function DashboardMockup({ industry }: { industry: typeof industries[0] }) {
  const stats = industry.mockStats;
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{industry.icon}</span>
        <div>
          <p className="text-sm font-bold text-white">{industry.name}</p>
          <p className="text-[10px] text-slate-500">لوحة تحكم — بيانات تجريبية</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'حجوزات اليوم', value: stats.bookings, icon: CalendarCheck, color: 'text-indigo-400' },
          { label: 'إيراد اليوم', value: `${stats.revenue} ر.س`, icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'التقييم', value: stats.rating, icon: Star, color: 'text-amber-400' },
          { label: 'العملاء', value: stats.customers, icon: Users, color: 'text-blue-400' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3"
          >
            <stat.icon className={`w-4 h-4 ${stat.color} mb-1`} />
            <p className="text-lg font-black text-white">{stat.value}</p>
            <p className="text-[10px] text-slate-500">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Services list */}
      <div>
        <p className="text-xs text-slate-500 mb-2">خدماتك</p>
        <div className="space-y-1">
          {industry.services.map((svc, i) => (
            <motion.div
              key={svc}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.08 }}
              className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02] text-xs"
            >
              <span className="text-slate-300">{svc.split('—')[0]}</span>
              <span className="text-white font-bold">{svc.split('—')[1]}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Demo() {
  const [selectedIndustry, setSelectedIndustry] = useState(0);
  const [view, setView] = useState<'site' | 'dashboard'>('site');
  const industry = industries[selectedIndustry];

  return (
    <MarketingLayout>

      {/* Top bar */}
      <div className="sticky top-16 z-30 bg-[#0b1220]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            الرئيسية
          </Link>
          <Link to="/onboard" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors">
            ابدأ مجاناً
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-12">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">
            شوف كيف يطلع موقعك
          </h1>
          <p className="text-slate-500 text-base max-w-lg mx-auto">
            اختر نوع مشروعك وشاهد الموقع ولوحة التحكم مباشرة — بدون تسجيل
          </p>
        </div>

        {/* Industry Picker */}
        <div>
          <p className="text-sm text-slate-400 mb-3 text-center">اختر مجالك:</p>
          <div className="flex gap-2 justify-center flex-wrap">
            {industries.map((ind, i) => (
              <button
                key={ind.id}
                onClick={() => setSelectedIndustry(i)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  selectedIndustry === i
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                    : 'bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:text-white'
                }`}
              >
                <span className="text-lg">{ind.icon}</span>
                {ind.name}
              </button>
            ))}
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex justify-center">
          <div className="flex items-center gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl">
            <button
              onClick={() => setView('site')}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                view === 'site' ? 'bg-indigo-600 text-white' : 'text-slate-500'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              موقع الحجز
            </button>
            <button
              onClick={() => setView('dashboard')}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                view === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-500'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              لوحة التحكم
            </button>
          </div>
        </div>

        {/* Preview */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${industry.id}-${view}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-md mx-auto"
          >
            {view === 'site' ? (
              <div className="space-y-4">
                <PhoneMockup industry={industry} />
                <p className="text-center text-xs text-slate-600">
                  هذا شكل موقع الحجز لعملائك — يتثبت كتطبيق على جوالهم
                </p>
              </div>
            ) : (
              <DashboardMockup industry={industry} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Features */}
        <div>
          <p className="text-center text-sm text-slate-400 mb-6">كل هذا تحصله مجاناً لمدة 14 يوم:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
            {[
              { icon: Globe, text: 'موقع حجز خاص' },
              { icon: Smartphone, text: 'تطبيق PWA' },
              { icon: CreditCard, text: 'مدفوعات إلكترونية' },
              { icon: MapPin, text: 'تتبع GPS' },
              { icon: BarChart3, text: 'تقارير مالية' },
              { icon: MessageCircle, text: 'واتساب تلقائي' },
              { icon: Users, text: 'إدارة موظفين' },
              { icon: Shield, text: 'فواتير ضريبية' },
              { icon: TrendingUp, text: 'مستشار AI' },
            ].map((f, i) => (
              <motion.div key={f.text} {...fadeUp(i * 0.04)}
                className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                <f.icon className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-xs text-slate-400">{f.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pb-8">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 max-w-lg mx-auto">
            <h2 className="text-2xl font-black text-white mb-3">جاهز تبني موقعك؟</h2>
            <p className="text-slate-500 text-sm mb-5">
              سجّل مجاناً، اختر مجالك، وأرسل الرابط لعملائك. خلال 5 دقائق.
            </p>
            <Link
              to="/onboard"
              className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-xl transition-colors"
            >
              ابدأ الآن — مجاناً
            </Link>
            <p className="text-xs text-slate-600 mt-4">مجاني للأبد · Pro 14 يوم مجاناً · بدون بطاقة</p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
