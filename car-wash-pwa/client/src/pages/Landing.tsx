import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import {
  CalendarCheck, MapPin, BarChart3, Gift, Camera, MessageSquare,
  Building2, Settings, CheckCircle, ChevronLeft, Search,
  Shield, Zap, Radio, Droplets, Star, Menu, X, ChevronDown,
  TrendingUp, Users, Clock, CreditCard, Smartphone,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import SocialProofTicker from '../components/SocialProofTicker';

/* ── Water drop particle type ── */
interface Drop { id: number; left: string; size: number; duration: number; delay: number; }

/* ── Stable water drops (generated once) ── */
const DROPS: Drop[] = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: `${(i * 4.7 + Math.sin(i * 1.3) * 3 + 3)}%`,
  size: 4 + (i % 5) * 1.8,
  duration: 4 + (i % 6) * 0.8,
  delay: (i % 7) * 0.7,
}));

/* ── Animation helpers ── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 36 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

/* ── Data ── */
const features = [
  {
    Icon: TrendingUp,
    title: 'جلب العملاء تلقائي',
    desc: 'العملاء يحجزون من المنصة مباشرة. بدون ما تدور عليهم.',
  },
  {
    Icon: CalendarCheck,
    title: 'حجوزات بدون اتصال',
    desc: 'العميل يحجز من جواله بثواني — تقويم + إشعارات واتساب فورية.',
  },
  {
    Icon: BarChart3,
    title: 'تتبع كل ريال',
    desc: 'دخل ومصاريف وأرباح بمخططات واضحة + تصدير Excel + VAT تلقائي.',
  },
  {
    Icon: Users,
    title: 'موظفينك تحت السيطرة',
    desc: 'جدولة، رواتب، أداء، GPS — شفافية كاملة من لوحة واحدة.',
  },
  {
    Icon: Camera,
    title: 'مخزون ما ينقص',
    desc: 'تنبيه تلقائي قبل ما يخلص أي منتج + طلب من الموردين بضغطة.',
  },
  {
    Icon: MessageSquare,
    title: 'تسويق ذكي',
    desc: 'حملات واتساب تلقائية + تصنيف عملاء + عروض مخصصة.',
  },
  {
    Icon: MapPin,
    title: 'تتبع GPS مباشر',
    desc: 'خريطة حية — العميل يرى الموظف يقترب بالثواني مثل أوبر.',
  },
  {
    Icon: CreditCard,
    title: 'مدفوعات فورية',
    desc: 'STC Pay · مدى · Apple Pay — المال يدخل حسابك مباشرة.',
  },
  {
    Icon: Gift,
    gradient: 'from-orange-500 to-orange-500',
    glow: 'shadow-violet-500/25',
    border: 'border-white/10',
    title: 'برامج ولاء تخليهم يرجعون',
    desc: 'نقاط أو بطاقة مخرَّمة بألوان متجرك — العميل يرجع لأنه يجمع مكافآت.',
  },
];

const stats = [
  { to: 120, suffix: '+', label: 'متجر مسجل', color: 'from-orange-500 to-orange-500' },
  { to: 15000, suffix: '+', label: 'حجز مكتمل', color: 'from-orange-500 to-orange-500' },
  { to: 4.9, suffix: '', label: 'تقييم', color: 'from-orange-500 to-orange-500', isDecimal: true },
  { to: 2, suffix: '+ مليون ر.س', label: 'إيرادات عملائنا', color: 'from-orange-500 to-orange-500' },
];

const testimonials = [
  {
    name: 'أحمد الشمري',
    role: 'صاحب الفخامة — الرياض',
    text: 'قبل Jdawil كنت أدير كل شيء على واتساب! الآن الحجوزات تنظم نفسها والإيرادات زادت ٤٠٪ في أول شهرين.',
    rating: 5,
    avatar: 'أ',
    color: 'from-orange-500 to-orange-500',
  },
  {
    name: 'محمد العتيبي',
    role: 'صاحب الكريستال — جدة',
    text: 'الميزة اللي أحبها هي تتبع الموظفين. العميل يشوف الموظف وين هو. الثقة اللي بنيناها مع عملائنا لا تقدر بثمن.',
    rating: 5,
    avatar: 'م',
    color: 'from-orange-500 to-orange-500',
  },
  {
    name: 'خالد الدوسري',
    role: 'مدير النجمة — الدمام',
    text: 'إعداد بسيط جداً — حطيت مفتاح API للدفع وبدأنا نستقبل مدفوعات STC Pay في نفس اليوم. مافي كود ولا تعقيد.',
    rating: 5,
    avatar: 'خ',
    color: 'from-orange-500 to-orange-500',
  },
];


const marqueeText = 'حجوزات ذكية ✦ GPS مباشر ✦ برامج الولاء ✦ فواتير PDF ✦ واتساب مدمج ✦ طابور الانتظار ✦ نقطة البيع ✦ أسطول المركبات ✦ تتبع لحظي ✦ White-label ✦ ';

const comparisonRows: { feature: string; before: string; after: string }[] = [
  { feature: 'استقبال الحجوزات', before: 'مكالمات وواتساب يدوي', after: 'موقع حجز ذاتي 24/7' },
  { feature: 'تأكيد الموعد', before: 'رسائل مكررة وأخطاء', after: 'تأكيد فوري عبر واتساب' },
  { feature: 'متابعة الموظفين', before: 'مكالمات وتخمين', after: 'GPS مباشر على الخريطة' },
  { feature: 'الفواتير', before: 'دفاتر ورقية', after: 'فاتورة PDF تلقائية + ضريبة' },
  { feature: 'الذكريات والمتابعة', before: 'ينسى العميل الموعد', after: 'تذكير قبل الموعد + متابعة بعده' },
  { feature: 'برامج الولاء', before: 'لا يوجد', after: 'نقاط ومستويات وعروض حصرية' },
  { feature: 'التقارير المالية', before: 'إكسل وحسابات يدوية', after: 'تقارير دخل/مصروف لحظية' },
  { feature: 'دعم متعدد الفروع', before: 'لوحات منفصلة', after: 'لوحة موحدة لكل الفروع' },
];

const faqs = [
  {
    q: 'ما هو Jdawil؟',
    a: 'Jdawil هو برنامج SaaS متكامل لإدارة الحجوزات والخدمات في المملكة العربية السعودية. يوفر حجوزات ذكية، تتبع GPS مباشر للموظفين والسيارات، مدفوعات STC Pay ومدى، إدارة رواتب، وفواتير PDF — كل شيء في مكان واحد بدون تعقيد.',
  },
  {
    q: 'هل يناسب المغاسل المتنقلة والثابتة معاً؟',
    a: 'نعم. Jdawil مُصمَّم من اليوم الأول لكلا النوعين. الخدمة المتنقلة تستفيد من تتبع GPS، حساب وقت الوصول، وتوزيع الحجوزات على السيارات المتاحة. المتجر الثابت تستفيد من نظام الطابور والكاشير وإدارة العملاء.',
  },
  {
    q: 'كم سعر الاشتراك وهل توجد رسوم إضافية؟',
    a: 'Jdawil مجاني للأبد مع 30 حجز/شهر. باقة Pro بـ 99 ر.س شهرياً أو 999 ر.س سنوياً لكل شيء مفتوح. بدون عمولة على المدفوعات.',
  },
  {
    q: 'هل أحتاج تثبيت تطبيق أو شراء أجهزة؟',
    a: 'لا. Jdawil يعمل كـ PWA من المتصفح على أي جهاز. يمكن تثبيته على الشاشة الرئيسية بدون متجر تطبيقات. لا يحتاج أجهزة خاصة — جوالك كافٍ.',
  },
  {
    q: 'كيف تعمل المدفوعات الإلكترونية؟',
    a: 'تربط حساب ميسر أو Checkout.com الخاص بك بمفتاح API. المال يذهب مباشرة لحسابك البنكي — Jdawil لا يلمس أموالك. يدعم STC Pay، مدى، Apple Pay، وNFC.',
  },
  {
    q: 'ماذا يحدث بعد انتهاء التجربة المجانية؟',
    a: 'تختار خطة وتشترك بأي طريقة دفع. إذا اخترت عدم الاستمرار، تُصدَّر بياناتك كاملةً بصيغة Excel وتُحذف بياناتك من الخوادم خلال 30 يوماً. لا يوجد أي التزام.',
  },
  {
    q: 'هل البيانات آمنة؟',
    a: 'نعم. كل متجر معزول تماماً عن الأخرى (Multi-tenant isolation). البيانات مشفرة أثناء النقل وعند التخزين. يتم نسخ احتياطي يومي تلقائي.',
  },
  {
    q: 'هل أستطيع إدارة أكثر من متجر؟',
    a: 'نعم. تتوفر خطط للفروع المتعددة (2-3 فروع، 4-10 فروع) بلوحة تحكم موحدة تتيح مقارنة أداء كل فرع وإدارة الموظفين والمخزون من مكان واحد.',
  },
];


function dashboardHref(role?: string) {
  if (!role) return '/login';
  const map: Record<string, string> = {
    super_admin: '/super-admin',
    vendor_admin: '/vendor',
    admin: '/vendor',
    employee: '/employee',
    customer: '/app',
  };
  return map[role] ?? '/';
}

/* ── Count-up hook ── */
function useCountUp(target: number, inView: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const steps = 60;
    const step = target / steps;
    let current = 0;
    const isSmall = target < 10;
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { setValue(target); clearInterval(timer); }
      else setValue(isSmall ? parseFloat(current.toFixed(1)) : Math.floor(current));
    }, 25);
    return () => clearInterval(timer);
  }, [inView, target]);
  return value;
}

/* ── Stat card ── */
function StatCard({ stat, inView }: { stat: typeof stats[0]; inView: boolean }) {
  const count = useCountUp(stat.to, inView);
  const displayValue = (stat as any).isDecimal
    ? (count === stat.to ? stat.to.toFixed(1) : count.toFixed(1))
    : count.toLocaleString('ar-SA');
  return (
    <div className="text-center">
      <div className={`text-4xl sm:text-5xl font-black bg-gradient-to-l ${stat.color} bg-clip-text text-transparent`}>
        {displayValue}{stat.suffix}
      </div>
      <div className="text-sm text-slate-500 mt-2 font-medium">{stat.label}</div>
    </div>
  );
}

/* ── Main component ── */
export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [foundingSeats, setFoundingSeats] = useState<number | null>(null);

  // Fetch founding member seats remaining
  useEffect(() => {
    fetch('/api/vendors/count/registered')
      .then(r => r.json())
      .then(d => setFoundingSeats(d.remaining ?? null))
      .catch(() => {});
  }, []);

  /* ── ROI Calculator state ── */
  const [washesPerDay, setWashesPerDay] = useState(8);
  const [pricePerWash, setPricePerWash] = useState(60);

  const heroRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsInView, setStatsInView] = useState(false);

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.7], [0, -100]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.96]);

  // Navbar scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Stats intersection observer
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsInView(true); }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Auto-advance testimonial
  useEffect(() => {
    const t = setInterval(() => setTestimonialIdx(i => (i + 1) % testimonials.length), 5000);
    return () => clearInterval(t);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate(`/marketplace${search ? `?q=${encodeURIComponent(search)}` : ''}`);
  }

  return (
    <div dir="rtl" className="min-h-screen bg-surface-1 text-white overflow-x-hidden">

      {/* No extra keyframes needed — clean design */}

      {/* ── Background — clean, minimal ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-48 right-[-20%] w-[600px] h-[600px] rounded-full bg-orange-500/[0.07] blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-orange-500/[0.04] blur-[120px]" />
      </div>

      {/* ══ NAVBAR ══════════════════════════════════════════════════════════ */}
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`fixed top-0 inset-x-0 z-50 border-b transition-all duration-300 ${
          scrolled ? 'bg-surface-1/90 border-white/8 backdrop-blur-2xl shadow-xl shadow-black/30' : 'bg-transparent border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <motion.div
              whileHover={{ scale: 1.12, rotate: -8 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="w-9 h-9 rounded-xl bg-slate-900/40 flex items-center justify-center shadow-lg shadow-black/40"
            >
              <Droplets size={17} className="text-white" />
            </motion.div>
            <div className="leading-tight">
              <p className="font-black text-white text-[15px] tracking-tight">Jdawil</p>
              <p className="text-[10px] text-slate-300/70 font-medium tracking-widest">منصة الحجوزات</p>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {[{ label: 'المزايا', href: '#features' }, { label: 'الأسعار', href: '#pricing' }, { label: 'الأسئلة الشائعة', href: '#faq' }, { label: 'المدونة', href: '/blog', isLink: true }].map(item => (
              item.isLink
                ? <Link key={item.label} to={item.href!} className="relative text-slate-400 hover:text-white text-sm font-medium transition-colors group">
                    {item.label}
                    <span className="absolute -bottom-0.5 right-0 w-0 h-px bg-orange-500 group-hover:w-full transition-all duration-300" />
                  </Link>
                : <a key={item.label} href={item.href} className="relative text-slate-400 hover:text-white text-sm font-medium transition-colors group">
                    {item.label}
                    <span className="absolute -bottom-0.5 right-0 w-0 h-px bg-orange-500 group-hover:w-full transition-all duration-300" />
                  </a>
            ))}
            {user ? (
              <Link to={dashboardHref(user.role)} className="bg-slate-900/40 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-black/40 transition-all hover:scale-105">
                لوحتي
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/onboard" className="border border-white/10 text-slate-300 hover:bg-slate-800/40 px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
                  انضم بمتجرك
                </Link>
                <Link to="/login" className="bg-slate-900/40 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-black/40 transition-all hover:scale-105">
                  ادخل
                </Link>
              </div>
            )}
          </div>

          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMenuOpen(v => !v)} className="md:hidden p-2 text-slate-400 hover:text-white">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </motion.button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              key="mob"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="md:hidden border-t border-white/5 bg-surface-1/97 backdrop-blur-2xl overflow-hidden"
            >
              <div className="px-5 py-5 space-y-3">
                {/* Marketplace hidden until 200+ vendors */}
                {user ? (
                  <Link to={dashboardHref(user.role)} onClick={() => setMenuOpen(false)} className="block bg-slate-900/40 text-white px-4 py-3 rounded-xl text-sm font-bold text-center">لوحتي</Link>
                ) : (
                  <>
                    <Link to="/onboard" onClick={() => setMenuOpen(false)} className="block border border-white/10 text-slate-300 px-4 py-3 rounded-xl text-sm font-medium text-center">انضم بمتجرك</Link>
                    <Link to="/login" onClick={() => setMenuOpen(false)} className="block bg-slate-900/40 text-white px-4 py-3 rounded-xl text-sm font-bold text-center">ادخل</Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center pt-16 px-4 overflow-hidden">

        <motion.div style={{ opacity: heroOpacity, y: heroY, scale: heroScale }} className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Badge — clean */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-white/[0.05] border border-white/[0.08] rounded-full px-4 py-1.5 mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-pulse" />
            <span className="text-xs text-slate-400 font-medium">+9 قطاعات خدمية · مغاسل · صالونات · تنظيف · صيانة · تجميل · سباكة · كهرباء · فري لانسر</span>
          </motion.div>

          {/* H1 — clean, direct */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-[64px] font-black leading-[1.15] tracking-tight mb-6"
          >
            <span className="text-white">عندك خدمة وتبي عملاء؟</span>
            <br />
            <span className="text-slate-300">جداول يبني لك نظام حجوزات كامل</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            المشكلة مو بخدمتك — المشكلة إن عملاءك ما يلقون طريقة سهلة يحجزون.
            <br className="hidden sm:block" />
            <span className="text-white font-semibold">جداول يعطيك موقع حجز + إدارة موظفين + مدفوعات + تقارير — خلال 5 دقائق.</span>
          </motion.p>

          {/* CTAs — clean */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center mb-8"
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/onboard')}
              className="bg-orange-500 hover:bg-orange-500 text-white px-8 py-4 rounded-xl font-bold text-base transition-colors"
            >
              ابدأ مجاناً — 14 يوم
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/demo')}
              className="bg-white/[0.05] border border-white/[0.1] hover:border-white/[0.2] text-slate-300 px-8 py-4 rounded-xl font-bold text-base transition-all"
            >
              شاهد العرض التجريبي
            </motion.button>
          </motion.div>

          {/* Trust — minimal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex items-center justify-center gap-6 text-xs text-slate-600 mb-20"
          >
            <span>بدون بطاقة ائتمانية</span>
            <span className="w-px h-3 bg-white/[0.08]" />
            <span>جاهز خلال 5 دقائق</span>
            <span className="w-px h-3 bg-white/[0.08]" />
            <span>باقة مجانية للأبد</span>
          </motion.div>

          {/* Stats */}
          <motion.div
            ref={statsRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-20"
          >
            {stats.map(s => <StatCard key={s.label} stat={s} inView={statsInView} />)}
          </motion.div>

          {/* Phone mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.7, type: 'spring', stiffness: 80 }}
            className="relative mx-auto w-56 sm:w-72"
          >
            <div className="absolute inset-0 bg-slate-900/40 blur-3xl rounded-full scale-75" />
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="relative rounded-[3rem] border border-white/15 bg-slate-800/60[0.03] backdrop-blur-xl shadow-2xl overflow-hidden"
              style={{ aspectRatio: '9/19' }}
            >
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-4 bg-black/70 rounded-full z-10" />
              <div className="absolute inset-0 pt-10 px-3 pb-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-2/5 rounded-full bg-white/15" />
                  <div className="w-7 h-7 rounded-full bg-slate-900/40" />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    'from-orange-500 to-orange-500',
                    'from-orange-500 to-orange-500',
                    'from-orange-500 to-orange-500',
                    'from-orange-500 to-orange-500',
                  ].map((g, i) => (
                    <div key={i} className={`h-14 rounded-2xl bg-gradient-to-br ${g} border border-white/10 p-2`}>
                      <div className="h-2 w-3/4 rounded-full bg-white/30 mb-1.5" />
                      <div className="h-1.5 w-1/2 rounded-full bg-white/20" />
                    </div>
                  ))}
                </div>
                <div className="h-24 rounded-2xl bg-slate-900/40 border border-white/10 p-3">
                  <div className="h-2.5 w-3/4 rounded-full bg-white/30 mb-2" />
                  <div className="h-2 w-1/2 rounded-full bg-white/20 mb-3" />
                  <div className="flex gap-1.5">
                    {[...Array(5)].map((_, i) => <div key={i} className="w-4 h-4 rounded-full bg-slate-700/70 flex items-center justify-center text-[7px] text-slate-300">★</div>)}
                  </div>
                </div>
                <div className="h-3 w-4/5 rounded-full bg-white/10" />
                <div className="h-3 w-3/5 rounded-full bg-white/[0.07]" />
              </div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-white/20 rounded-full" />
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 1 }} className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
            <ChevronDown size={26} className="text-white/20" />
          </motion.div>
        </motion.div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ── Divider ── */}
      <div className="max-w-5xl mx-auto px-4"><div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" /></div>

      {/* ══ FEATURES ════════════════════════════════════════════════════════ */}
      <section id="features" className="relative py-28 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
              مو بس حجوزات — نظام إدارة كامل
            </h2>
            <p className="text-slate-500 text-base max-w-lg mx-auto">كل ميزة بُنيت من مشكلة حقيقية يواجهها صاحب مشروع خدمي كل يوم</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map(({ Icon, title, desc }, i) => (
              <motion.div
                key={title}
                {...fadeUp(i * 0.04)}
                className="group bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-6 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center mb-4 group-hover:bg-slate-800/40 transition-colors">
                  <Icon size={20} className="text-slate-400 group-hover:text-slate-300 transition-colors" />
                </div>
                <h3 className="text-base font-bold text-white mb-6">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ PAIN POINTS — clean table format ═══════════════════════════════ */}
      <section id="pain-points" className="relative py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
              وش يتغير لما تستخدم جداول؟
            </h2>
            <p className="text-slate-500 text-base">الفرق اللي يحسه كل صاحب مشروع من أول أسبوع</p>
          </motion.div>

          {/* Clean before/after table */}
          <motion.div {...fadeUp(0.1)} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden mb-12">
            <div className="grid grid-cols-3 text-xs font-bold text-slate-500 border-b border-white/[0.06] px-6 py-3">
              <span></span>
              <span className="text-center text-red-400/70">بدون نظام</span>
              <span className="text-center text-slate-300/70">مع Jdawil</span>
            </div>
            {[
              { area: 'استقبال الحجوزات', before: 'واتساب فوضى — تنسى رد', after: 'العميل يحجز بنفسه 24/7' },
              { area: 'تتبع الموظفين', before: 'تتصل وما يرد — وين راح؟', after: 'خريطة GPS لحظية لكل موظف' },
              { area: 'التحصيل', before: 'كاش ويتأخرون بالدفع', after: 'الدفع قبل الخدمة إلكترونياً' },
              { area: 'حساباتك', before: 'آخر الشهر تقعد تحسب بيدك', after: 'تقارير فورية — إيرادات ومصاريف' },
              { area: 'العملاء الضايعين', before: 'حجز مرة وما رجعوا', after: 'تذكير واتساب + برنامج ولاء' },
              { area: 'الضريبة', before: 'هيئة الزكاة تطالبك وأنت مو جاهز', after: 'فاتورة VAT تلقائية لكل حجز' },
              { area: 'المخزون', before: 'تكتشف إن المادة خلصت قدام العميل', after: 'تنبيه قبل ما تخلص + طلب تلقائي' },
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-3 items-center px-6 py-4 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.01] transition-colors">
                <span className="text-sm text-white font-bold">{row.area}</span>
                <span className="text-center text-sm text-slate-500">{row.before}</span>
                <span className="text-center text-sm text-slate-300">{row.after}</span>
              </div>
            ))}
          </motion.div>

          {/* CTA — clean */}
          <motion.div {...fadeUp(0.2)} className="text-center">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/onboard')}
              className="bg-orange-500 hover:bg-orange-500 text-white px-8 py-4 rounded-xl font-bold text-base transition-colors"
            >
              جرّب الفرق بنفسك — مجاناً
            </motion.button>
            <p className="text-xs text-slate-600 mt-3">14 يوم مجاناً · بدون بطاقة · إلغاء في أي وقت</p>
          </motion.div>
        </div>
      </section>

      {/* ══ INDUSTRIES — "يناسب مشروعك" ═══════════════════════════════════ */}
      <section className="relative py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
              مهما كان مجالك — جداول يفهمه
            </h2>
            <p className="text-slate-500 text-base max-w-lg mx-auto">كل قطاع له قوالب خدمات وأسعار جاهزة. اختر مجالك وابدأ فوراً</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { icon: '🚗', name: 'مغاسل سيارات', desc: 'متنقلة وثابتة — حجوزات + GPS + تتبع', link: '/onboard' },
              { icon: '💈', name: 'صالونات وحلاقة', desc: 'مواعيد + خدمات + ولاء عملاء', link: '/onboard' },
              { icon: '💄', name: 'تجميل منزلي وسبا', desc: 'مكياج + مساج + حمام مغربي', link: '/onboard' },
              { icon: '🏠', name: 'تنظيف منازل', desc: 'شقق + فلل + مكاتب + بعد البناء', link: '/onboard' },
              { icon: '❄️', name: 'صيانة مكيفات', desc: 'تنظيف + صيانة + تركيب + فريون', link: '/onboard' },
              { icon: '🔧', name: 'سباكة', desc: 'تسليك + تسربات + صيانة عامة', link: '/onboard' },
              { icon: '⚡', name: 'كهرباء', desc: 'صيانة + تمديدات + إنارة + كاميرات', link: '/onboard' },
              { icon: '💼', name: 'فري لانسر', desc: 'مصور + مدرب + طباخ + معلم + أي خدمة', link: '/onboard' },
            ].map((industry, i) => (
              <motion.a
                key={industry.name}
                href={industry.link}
                {...fadeUp(i * 0.04)}
                className="group bg-white/[0.03] border border-white/[0.06] hover:border-white/10 rounded-2xl p-5 transition-all text-center"
              >
                <span className="text-3xl block mb-3">{industry.icon}</span>
                <h3 className="text-sm font-bold text-white mb-1 group-hover:text-slate-300 transition-colors">{industry.name}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">{industry.desc}</p>
              </motion.a>
            ))}
          </div>

          <motion.p {...fadeUp(0.3)} className="text-center text-slate-600 text-xs mt-6">
            مشروعك مو موجود؟ اختر "خدمات أخرى" وعرّف خدماتك بنفسك
          </motion.p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4"><div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" /></div>

      {/* ══ HOW IT WORKS — 3 خطوات ═══════════════════════════════════════ */}
      <section className="relative py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
              من الصفر لموقع حجوزات كامل — 3 خطوات
            </h2>
            <p className="text-slate-500 text-base">بدون مبرمج. بدون مصمم. بدون ما تدفع ريال.</p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { step: '1', title: 'اختر نشاطك وسمّي مشروعك', desc: 'حدد مجالك (صالون، مغسلة، تنظيف...) واكتب اسم مشروعك. قوالب خدمات وأسعار جاهزة تنتظرك.' },
              { step: '2', title: 'صمّم موقعك واختر ثيم', desc: 'اختر من 20 تصميم احترافي، ارفع شعارك أو أنشئ واحد، وخصّص الألوان والأقسام.' },
              { step: '3', title: 'شارك الرابط وابدأ استقبل حجوزات', desc: 'موقعك جاهز على jdawil.sa/store/اسمك. أرسل الرابط عبر واتساب أو انستقرام.' },
            ].map((item, i) => (
              <motion.div key={item.step} {...fadeUp(i * 0.1)} className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-800/40 border border-white/10 flex items-center justify-center text-slate-300 font-black text-lg">
                  {item.step}
                </div>
                <h3 className="text-base font-bold text-white mb-6">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp(0.3)} className="text-center mt-10">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/onboard')}
              className="bg-orange-500 hover:bg-orange-500 text-white px-8 py-4 rounded-xl font-bold text-base transition-colors"
            >
              ابدأ الآن — مجاناً
            </motion.button>
          </motion.div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4"><div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" /></div>

      {/* ══ ROI CALCULATOR ══════════════════════════════════════════════════ */}
      <section id="roi-calculator" className="relative py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-500 via-transparent to-transparent pointer-events-none" />
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-slate-700/8 blur-[140px] pointer-events-none rounded-full" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-slate-700/10 border border-white/10 rounded-full px-4 py-1.5 mb-5">
              <span className="text-xs text-slate-300 font-bold tracking-wide">حاسبة الأرباح</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-6">
              احسب دخلك مع
              <span className="text-white"> Jdawil</span>
            </h2>
            <p className="text-slate-400 text-lg">حرّك الشريط — وشاهد الأرقام تتغير</p>
          </motion.div>

          <motion.div
            {...fadeUp(0.1)}
            className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-8 sm:p-10 overflow-hidden"
          >
            {/* Gradient border glow */}
            <div className="absolute inset-0 rounded-3xl bg-slate-900/40 pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Inputs */}
              <div className="space-y-8">
                {/* Washes per day */}
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6">
                  <label className="block text-sm font-bold text-slate-300 mb-4">كم حجز/خدمة تُنجز يومياً؟</label>
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-5xl font-black text-white min-w-[3rem] text-center">
                      {washesPerDay}
                    </span>
                    <span className="text-slate-500 text-sm">خدمة / يوم</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={washesPerDay}
                    onChange={e => setWashesPerDay(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to left, #3b82f6 ${washesPerDay}%, rgba(255,255,255,0.1) ${washesPerDay}%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-slate-600 mt-2">
                    <span>١٠٠</span>
                    <span>١</span>
                  </div>
                </div>

                {/* Price per wash */}
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6">
                  <label className="block text-sm font-bold text-slate-300 mb-4">متوسط سعر الخدمة (ر.س)؟</label>
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-5xl font-black text-white min-w-[4rem] text-center">
                      {pricePerWash}
                    </span>
                    <span className="text-slate-500 text-sm">ر.س / غسلة</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={500}
                    value={pricePerWash}
                    onChange={e => setPricePerWash(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to left, #10b981 ${((pricePerWash - 10) / 490) * 100}%, rgba(255,255,255,0.1) ${((pricePerWash - 10) / 490) * 100}%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-slate-600 mt-2">
                    <span>٥٠٠</span>
                    <span>١٠</span>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${washesPerDay}-${pricePerWash}`}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    {/* Monthly Revenue */}
                    <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5">
                      <p className="text-xs text-slate-300 font-bold mb-2 tracking-wide">الدخل الشهري المتوقع</p>
                      <p className="text-4xl font-black text-slate-300">
                        {(washesPerDay * pricePerWash * 26).toLocaleString('ar-SA')}
                        <span className="text-lg font-bold text-slate-300 mr-2">ر.س</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">٢٦ يوم عمل × {washesPerDay} غسلة × {pricePerWash} ر.س</p>
                    </div>

                    {/* Annual Revenue */}
                    <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5">
                      <p className="text-xs text-slate-300 font-bold mb-2 tracking-wide">الدخل السنوي</p>
                      <p className="text-3xl font-black text-slate-300">
                        {(washesPerDay * pricePerWash * 26 * 12).toLocaleString('ar-SA')}
                        <span className="text-base font-bold text-slate-300 mr-2">ر.س</span>
                      </p>
                    </div>

                    {/* Time Saved */}
                    <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5">
                      <p className="text-xs text-slate-300 font-bold mb-2 tracking-wide">الوقت الموفّر يومياً</p>
                      <p className="text-3xl font-black text-slate-300">
                        {washesPerDay * 8}
                        <span className="text-base font-bold text-slate-300 mr-2">دقيقة</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">٨ دقائق إدارة موفّرة لكل خدمة</p>
                    </div>

                    {/* Plan Cost */}
                    <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-4">
                      <p className="text-xs text-slate-300 font-bold mb-1">تكلفة Jdawil الملائمة لك</p>
                      <p className="text-2xl font-black text-slate-300">
                        {washesPerDay <= 5 ? '0' : '99'}
                        <span className="text-sm font-bold text-slate-300 mr-2">{washesPerDay <= 5 ? 'مجاني' : 'ر.س / شهر'}</span>
                      </p>
                    </div>

                    {/* Net Profit */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-center">
                      <p className="text-xs text-slate-400 font-bold mb-1">صافي الربح الإضافي</p>
                      <p className="text-sm text-white font-bold leading-relaxed">
                        حجوزات لا تضيع + عملاء يعودون = أرباح أعلى
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* CTA */}
            <motion.div {...fadeUp(0.2)} className="text-center mt-10">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/onboard')}
                className="bg-slate-900/40 text-white px-10 py-[18px] rounded-2xl font-bold text-lg shadow-2xl shadow-black/40 hover:shadow-black/40 transition-all"
              >
                ابدأ تجربتك المجانية وحقق هذه الأرقام
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ TRANSFORMATION STORY ════════════════════════════════════════════ */}
      <section id="transformation" className="relative py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/50 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-5">
              <span className="text-xs text-slate-300 font-bold tracking-wide">قصة التحول</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-6">
              حياتك
              <span className="text-white"> قبل</span>
              {' '}و
              <span className="text-white"> بعد</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            {/* Before — Right column (RTL so it shows on the right) */}
            <motion.div
              {...fadeUp(0.1)}
              className="bg-red-950/20 border border-red-500/20 rounded-3xl p-8 flex flex-col"
            >
              <h3 className="text-2xl font-black text-red-300 mb-6 text-center">😤 قبل Jdawil</h3>
              <ul className="space-y-4">
                {[
                  'تنسيق المواعيد عبر واتساب — فوضى كاملة',
                  'لا تعرف أين موظفيك بالضبط',
                  'العميل يتصل: "وصل الموظف؟"',
                  'لا حساب دقيق لنهاية الشهر',
                  'موظف يأخذ نقوداً وما يسلّم الكل',
                  'عملاء قدامى ينسون يرجعون',
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    {...fadeUp(0.15 + i * 0.06)}
                    className="flex items-start gap-3 bg-red-500/5 border border-red-500/10 rounded-xl p-3"
                  >
                    <span className="text-lg flex-shrink-0 mt-0.5">❌</span>
                    <span className="text-slate-300 text-sm leading-relaxed">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* After — Left column */}
            <motion.div
              {...fadeUp(0.2)}
              className="bg-slate-700/20 border border-white/10 rounded-3xl p-8 flex flex-col"
            >
              <h3 className="text-2xl font-black text-slate-300 mb-6 text-center">بعد Jdawil</h3>
              <ul className="space-y-4">
                {[
                  'حجز تلقائي — العميل يحجز من هاتفه',
                  'خريطة حية — تعرف مكان كل موظف',
                  'العميل يتتبع الموظف مثل أوبر',
                  'تقرير مالي يومي دقيق للريال',
                  'كل دفعة مسجّلة — شفافية كاملة',
                  'واتساب تلقائي يذكّر العميل بموعده',
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    {...fadeUp(0.25 + i * 0.06)}
                    className="flex items-start gap-3 bg-slate-700/5 border border-white/10 rounded-xl p-3"
                  >
                    <span className="text-lg flex-shrink-0 mt-0.5">✅</span>
                    <span className="text-slate-300 text-sm leading-relaxed">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* Centered divider with logo */}
          <motion.div {...fadeUp(0.3)} className="flex items-center justify-center mt-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-px bg-gradient-to-b from-transparent to-orange-500" />
              <div className="flex items-center gap-3 bg-white/[0.05] border border-white/15 rounded-2xl px-6 py-3">
                <span className="text-2xl">💧</span>
                <span className="font-black text-white text-lg tracking-tight">Jdawil</span>
              </div>
              <div className="h-8 w-px bg-gradient-to-t from-transparent to-orange-500" />
            </div>
          </motion.div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ HOW IT WORKS (3 MINUTES) ════════════════════════════════════════ */}
      <section id="how-it-works" className="relative py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-500 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-slate-700/10 border border-white/10 rounded-full px-4 py-1.5 mb-5">
              <span className="text-xs text-slate-400 font-bold tracking-wide">الإعداد فوري</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-6">
              كيف تبدأ في
              <span className="text-white"> ٣ دقائق</span>
            </h2>
            <p className="text-slate-400 text-lg">لا تعقيد، لا تقنية — فقط ٣ خطوات وأنت جاهز</p>
          </motion.div>

          <div className="relative">
            {/* Dashed line between steps */}
            <div className="hidden md:block absolute top-14 right-[calc(16.67%+2.5rem)] left-[calc(16.67%+2.5rem)] h-0 border-t-2 border-dashed border-white/15 z-0" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative z-10">
              {[
                {
                  num: '١',
                  title: 'سجّل متجرك',
                  subtitle: '٣٠ ثانية',
                  desc: 'أدخل الاسم والجوال والمدينة',
                  gradient: 'from-orange-500 to-orange-500',
                  glow: 'shadow-black/40',
                },
                {
                  num: '٢',
                  title: 'أضف خدماتك وأسعارك',
                  subtitle: 'دقيقتان',
                  desc: '٣ نقرات وأسعارك جاهزة',
                  gradient: 'from-orange-500 to-orange-500',
                  glow: 'shadow-black/40',
                },
                {
                  num: '٣',
                  title: 'استقبل أول حجز',
                  subtitle: 'فوري',
                  desc: 'شارك رابطك — وابدأ',
                  gradient: 'from-orange-500 to-orange-500',
                  glow: 'shadow-black/40',
                },
              ].map(({ num, title, subtitle, desc, gradient, glow }, i) => (
                <motion.div key={num} {...fadeUp(i * 0.15)} className="flex flex-col items-center text-center group">
                  {/* Numbered circle */}
                  <div className="relative mb-7">
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${gradient} opacity-25 blur-xl group-hover:opacity-60 transition-opacity duration-300 scale-125`} />
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: -5 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      className={`relative w-24 h-24 rounded-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center shadow-2xl ${glow}`}
                    >
                      <span className="text-4xl font-black text-white leading-none">{num}</span>
                    </motion.div>
                    {/* Subtitle badge */}
                    <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gradient-to-l ${gradient} text-white text-[10px] font-black px-3 py-1 rounded-full whitespace-nowrap shadow-lg`}>
                      {subtitle}
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-white mb-2 mt-2">{title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed max-w-[200px]">{desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div {...fadeUp(0.5)} className="text-center mt-16">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/onboard')}
              className="bg-slate-900/40 text-white px-12 py-[18px] rounded-2xl font-bold text-lg shadow-xl shadow-black/40 hover:shadow-black/40 transition-shadow"
            >
              ابدأ الآن — مجاناً لمدة ١٤ يوم
            </motion.button>
          </motion.div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ LIVE DASHBOARD PREVIEW ══════════════════════════════════════════ */}
      <section className="relative py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-500 via-transparent to-transparent pointer-events-none" />
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-slate-800/40 blur-[120px] pointer-events-none rounded-full" />

        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <span className="inline-block text-xs font-bold tracking-widest text-slate-300 bg-slate-800/40 border border-white/10 rounded-full px-4 py-2 mb-4">
              شاهد بنفسك
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-6">
              داشبورد متجرك
              <span className="text-white"> في ثانية واحدة</span>
            </h2>
            <p className="text-slate-400 text-lg">هذا ما تراه كل صباح عند فتح Jdawil</p>
          </motion.div>

          {/* Mock Dashboard */}
          <motion.div {...fadeUp(0.1)}
            className="rounded-3xl border border-white/10 bg-[#070e1f] overflow-hidden shadow-2xl shadow-black/40">

            {/* Top bar */}
            <div className="flex items-center gap-2 px-5 py-3 bg-white/[0.03] border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-slate-800/40" />
              <div className="w-3 h-3 rounded-full bg-slate-800/40" />
              <div className="mx-auto text-xs text-slate-500 bg-white/5 px-6 py-1 rounded-full">jdawil.sa/vendor</div>
            </div>

            <div className="p-5 md:p-7">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white">صباح الخير، أحمد 👋</h3>
                  <p className="text-xs text-slate-400">الأحد، ٩ أبريل ٢٠٢٥</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-800/40 text-slate-300 text-xs px-3 py-1.5 rounded-full border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                    ٣ موظفين نشطين
                  </div>
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'حجوزات اليوم', value: '١٢', sub: '+٣ من أمس', color: 'from-orange-500 to-orange-500', icon: '📅' },
                  { label: 'إيراد هذا الشهر', value: '١٢,٤٥٠', sub: 'ريال', color: 'from-orange-500 to-orange-500', icon: '💰' },
                  { label: 'متوسط التقييم', value: '٤.٨', sub: 'من ٨٩ تقييم', color: 'from-orange-500 to-orange-500', icon: '★' },
                  { label: 'عملاء جدد', value: '٢٨', sub: 'هذا الشهر', color: 'from-orange-500 to-orange-500', icon: '👥' },
                ].map((card, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.08 }}
                    className="bg-white/5 border border-white/8 rounded-2xl p-4">
                    <div className="text-2xl mb-2">{card.icon}</div>
                    <div className={`text-2xl font-black bg-gradient-to-l ${card.color} bg-clip-text text-transparent`}>
                      {card.value}
                    </div>
                    <div className="text-xs text-white/80 font-medium mt-0.5">{card.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{card.sub}</div>
                  </motion.div>
                ))}
              </div>

              {/* Revenue chart + bookings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Chart */}
                <div className="md:col-span-2 bg-white/5 border border-white/8 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold text-white">الإيراد — آخر ٧ أيام</span>
                    <span className="text-xs text-slate-300 bg-slate-700/10 px-2 py-0.5 rounded-full">↑ ١٨٪</span>
                  </div>
                  <div className="flex items-end gap-2 h-20">
                    {[40, 65, 45, 80, 55, 90, 75].map((h, i) => {
                      const days = ['سبت','أحد','اثن','ثلا','أرب','خمس','جمع'];
                      const isLast = i === 6;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <motion.div
                            initial={{ height: 0 }} whileInView={{ height: `${h}%` }}
                            viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.06, duration: 0.6, type: 'spring' }}
                            className={`w-full rounded-t-lg ${isLast ? 'bg-slate-900/40' : 'bg-slate-900/40'}`}
                            style={{ minHeight: 3 }}
                          />
                          <span className={`text-[9px] ${isLast ? 'text-slate-300' : 'text-slate-600'}`}>{days[i]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Active bookings */}
                <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
                  <span className="text-sm font-bold text-white block mb-3">حجوزات الآن</span>
                  <div className="space-y-2.5">
                    {[
                      { name: 'خالد العمري', service: 'غسيل شامل', status: 'في الطريق', color: 'bg-orange-500' },
                      { name: 'سعد الغامدي', service: 'تلميع خارجي', status: 'جاري', color: 'bg-slate-700' },
                      { name: 'فهد المطيري', service: 'غسيل داخلي', status: 'مؤكد', color: 'bg-slate-700' },
                    ].map((b, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${b.color} flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{b.name}</p>
                          <p className="text-[10px] text-slate-500">{b.service}</p>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${b.color}/20 text-white/70`}>
                          {b.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom bar — quick actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {['إضافة حجز','الكاشير','الطابور','التقارير','الرواتب','VAT'].map((label, i) => (
                  <div key={i} className="text-xs px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 text-slate-300 cursor-default">
                    {label}
                  </div>
                ))}
                <div className="mr-auto text-[10px] text-slate-600">Jdawil v1.0</div>
              </div>
            </div>
          </motion.div>

          {/* Caption */}
          <motion.p {...fadeUp(0.2)} className="text-center text-slate-500 text-sm mt-6">
            هذا داشبورد حقيقي — تراه فوراً بعد تسجيل متجرك
          </motion.p>
        </div>
      </section>

      {/* ══ TESTIMONIALS ════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-slate-900/40 pointer-events-none" />
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-slate-700/10 border border-white/10 rounded-full px-4 py-1.5 mb-5">
              <span className="text-xs text-slate-300 font-bold tracking-wide">آراء العملاء</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black">
              ماذا يقول{' '}
              <span className="text-white">أصحاب المغاسل</span>
            </h2>
          </motion.div>

          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={testimonialIdx}
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                className="bg-white/[0.04] border border-white/10 rounded-3xl p-8 sm:p-10"
              >
                <div className="flex items-start gap-5 mb-6">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${testimonials[testimonialIdx].color} flex items-center justify-center text-xl font-black text-white shadow-lg flex-shrink-0`}>
                    {testimonials[testimonialIdx].avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      {[...Array(testimonials[testimonialIdx].rating)].map((_, i) => (
                        <Star key={i} size={14} className="text-slate-300 fill-amber-400" />
                      ))}
                    </div>
                    <p className="font-bold text-white">{testimonials[testimonialIdx].name}</p>
                    <p className="text-slate-500 text-sm">{testimonials[testimonialIdx].role}</p>
                  </div>
                </div>
                <p className="text-slate-300 text-lg leading-relaxed">"{testimonials[testimonialIdx].text}"</p>
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setTestimonialIdx(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === testimonialIdx ? 'w-7 h-2 bg-orange-500' : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-slate-800/40 border border-white/10 rounded-full px-4 py-1.5 mb-5">
              <span className="text-xs text-slate-300 font-bold tracking-wide">البداية سهلة</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black">
              ابدأ في{' '}
              <span className="text-white">٣ خطوات</span>
            </h2>
          </motion.div>

          <div className="relative">
            <div className="hidden md:block absolute top-11 right-[17%] left-[17%] h-px border-t-2 border-dashed border-white/10 z-0" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative z-10">
              {[
                { Icon: Building2, num: '١', title: 'سجّل متجرك', desc: 'أنشئ حسابك وأضف بيانات متجرك في أقل من دقيقتين' },
                { Icon: Settings, num: '٢', title: 'فعّل مزاياك', desc: 'أضف مفتاح الدفع وخدماتك وموظفيك من لوحة إعداد واحدة' },
                { Icon: CheckCircle, num: '٣', title: 'استقبل وأدر', desc: 'ابدأ في استقبال الحجوزات والمدفوعات فوراً' },
              ].map(({ Icon, num, title, desc }, i) => (
                <motion.div key={title} {...fadeUp(i * 0.15)} className="text-center group">
                  <div className="relative mx-auto w-20 h-20 mb-6">
                    <div className="absolute inset-0 rounded-full bg-slate-900/40 opacity-20 blur-xl group-hover:opacity-50 transition-opacity duration-300" />
                    <div className="relative w-full h-full rounded-full bg-white/[0.05] border border-white/15 flex flex-col items-center justify-center gap-0.5">
                      <Icon size={20} className="text-slate-300" />
                      <span className="text-xs font-black text-slate-400">{num}</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-6">{title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div {...fadeUp(0.4)} className="text-center mt-14">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/onboard')}
              className="bg-slate-900/40 text-white px-10 py-[18px] rounded-2xl font-bold text-lg shadow-xl shadow-black/40 hover:shadow-black/40 transition-shadow"
            >
              سجّل متجرك مجاناً
            </motion.button>
          </motion.div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ CUSTOMER SEARCH ═════════════════════════════════════════════════ */}
      <section className="relative py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div {...fadeUp()}>
            <div className="inline-flex items-center gap-2 bg-slate-700/10 border border-white/10 rounded-full px-4 py-1.5 mb-5">
              <span className="text-xs text-slate-400 font-bold">للعملاء</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-6">
              ابحث عن{' '}
              <span className="text-white">متجر بالقرب منك</span>
            </h2>
            <p className="text-slate-400 text-lg mb-10">اكتشف أفضل مزودي الخدمات في مدينتك واحجز بضغطة واحدة</p>
          </motion.div>
          <motion.form {...fadeUp(0.1)} onSubmit={handleSearch} className="flex gap-3 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث بالمدينة أو اسم المتجر..."
                className="w-full bg-white/[0.05] border border-white/15 text-white placeholder-slate-500 pr-11 pl-4 py-4 rounded-2xl focus:outline-none focus:border-white/10 focus:bg-white/8 transition-all text-sm backdrop-blur-sm"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              type="submit"
              className="bg-slate-900/40 text-white px-7 py-4 rounded-2xl font-bold text-sm shadow-lg shadow-black/40 whitespace-nowrap"
            >
              ابحث
            </motion.button>
          </motion.form>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
            {[
              { Icon: Shield, title: 'موثوق', desc: 'جميع المغاسل معتمدة ومراجعة' },
              { Icon: Zap, title: 'سريع', desc: 'احجز في ثوانٍ وتابع لحظة بلحظة' },
              { Icon: Radio, title: 'متابعة حية', desc: 'تتبع الموظف حتى يصل إليك' },
            ].map(({ Icon, title, desc }, i) => (
              <motion.div key={title} {...fadeUp(i * 0.08)} whileHover={{ y: -5 }} className="bg-white/[0.04] border border-white/10 hover:border-white/20 rounded-2xl p-5 text-center transition-all">
                <div className="w-11 h-11 rounded-xl bg-slate-900/40 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <Icon size={20} className="text-slate-400" />
                </div>
                <h3 className="font-bold text-white mb-1.5">{title}</h3>
                <p className="text-sm text-slate-400">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ FOUNDING MEMBERS BANNER ══════════════════════════════════════════ */}
      {(foundingSeats === null || foundingSeats > 0) && (
        <section className="px-4 pb-6">
          <motion.div
            {...fadeUp(0)}
            className="relative max-w-6xl mx-auto overflow-hidden rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
          >
            {/* Shimmer */}
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
              className="absolute inset-y-0 w-1/3 bg-gradient-to-l from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
            />
            <div className="relative z-10 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
              <div className="flex items-center gap-4">
                <motion.span
                  animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                  className="text-4xl flex-shrink-0"
                >🏅</motion.span>
                <div>
                  <p className="text-white font-black text-lg sm:text-xl leading-tight">
                    أنت من العملاء المؤسسين — سعرك محفوظ للأبد
                  </p>
                  <p className="text-slate-300 text-sm mt-0.5">
                    أول 100 متجر تسجل في Jdawil تحتفظ بسعر اليوم حتى لو رفعنا الأسعار لاحقاً
                  </p>
                  {foundingSeats !== null && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5">
                      <div className="w-24 h-2 rounded-full bg-slate-700/30 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-white"
                          style={{ width: `${Math.min(100, ((100 - foundingSeats) / 100) * 100)}%` }}
                        />
                      </div>
                      <span className="text-slate-300 text-xs font-bold">
                        {foundingSeats} مقعد متبقٍ من 100
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/onboard')}
                className="flex-shrink-0 bg-white text-slate-300 font-black px-6 py-3 rounded-xl shadow-md hover:bg-slate-700 transition-all text-sm whitespace-nowrap"
              >
                احجز مقعدك التأسيسي ←
              </motion.button>
            </div>
          </motion.div>
        </section>
      )}

      {/* ══ PRICING SECTION ═════════════════════════════════════════════════ */}
      <section className="relative py-28 px-4 overflow-hidden" id="pricing">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-500 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-10">
            <span className="inline-block text-xs font-bold tracking-widest text-slate-300 uppercase bg-slate-800/40 border border-white/10 rounded-full px-4 py-2 mb-4">
              الأسعار
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-6">
              باقة تناسب
              <span className="text-white"> كل متجر</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto mb-4">
              بدون رسوم إعداد — بدون عقود — يمكنك الإلغاء في أي وقت
            </p>
            <div className="inline-flex items-center gap-2 bg-slate-700/15 border border-white/10 rounded-full px-5 py-2.5">
              <span className="text-slate-300 text-sm font-black">أول 100 متجر = سعر مثبّت للأبد</span>
            </div>
          </motion.div>

          {/* ── Free Trial Banner ── */}
          <motion.div
            {...fadeUp(0.1)}
            className="relative mb-12 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-sm p-6"
          >
            {/* Glow */}
            <div className="absolute inset-0 bg-slate-900/40 pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-white font-black text-xl sm:text-2xl leading-tight">
                    جرب أي باقة مجاناً لمدة <span className="text-orange-400">14 يوم</span> كاملة
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    بدون بطاقة ائتمان • بدون التزام • إلغاء بضغطة واحدة
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/onboard')}
                className="flex-shrink-0 bg-slate-700 hover:bg-slate-700 text-white font-black px-7 py-3.5 rounded-xl shadow-lg shadow-black/40 transition-all text-sm whitespace-nowrap"
              >
                ابدأ تجربتك المجانية ←
              </motion.button>
            </div>
            {/* Animated shimmer */}
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
              className="absolute inset-y-0 w-1/3 bg-gradient-to-l from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none"
            />
          </motion.div>

          {/* Founding member price lock notice */}
          {(foundingSeats === null || foundingSeats > 0) && (
            <motion.div {...fadeUp(0.05)} className="mb-6 flex items-center justify-center gap-2">
              <span className="bg-slate-700/20 text-slate-300 border border-white/10 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                🔒 المشتركون الآن يحتفظون بهذا السعر للأبد
              </span>
            </motion.div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free */}
            <motion.div {...fadeUp(0.05)}
              className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-7 flex flex-col hover:border-white/10 hover:bg-white/[0.07] transition-all duration-300">
              <h3 className="text-xl font-bold text-white mb-6">مجاني</h3>
              <p className="text-sm text-slate-400 mb-6">ابدأ مشروعك بدون تكلفة</p>
              <div className="mt-auto">
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-5xl font-black text-white">0</span>
                  <span className="text-slate-400 mb-2">ر.س / للأبد</span>
                </div>
                <ul className="space-y-2.5 mb-7 text-sm text-slate-300">
                  {['موقع حجز خاص','حتى 30 حجز/شهر','إشعارات واتساب','تقارير مبسطة','3 ثيمات'].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle size={15} className="text-slate-300 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/onboard')}
                  className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold transition-all">
                  ابدأ مجاناً
                </motion.button>
              </div>
            </motion.div>

            {/* Pro */}
            <motion.div {...fadeUp(0.1)}
              className="relative rounded-3xl border-2 border-white/10 bg-slate-900/40 backdrop-blur-sm p-7 flex flex-col overflow-hidden">
              <div className="absolute top-5 left-5 flex gap-2">
                <span className="bg-slate-900/40 text-white text-xs font-black px-3 py-1 rounded-full">الأكثر طلباً</span>
                <span className="bg-slate-700 text-white text-xs font-black px-3 py-1 rounded-full">14 يوم مجاناً</span>
              </div>
              <h3 className="text-xl font-black text-white mb-1 mt-8">Pro</h3>
              <p className="text-sm text-slate-300 mb-6">كل المميزات بدون حدود</p>

              <div className="flex flex-wrap items-end gap-x-6 gap-y-2 mb-8">
                <div className="flex items-end gap-1">
                  <span className="text-6xl font-black text-white">99</span>
                  <span className="text-slate-300 mb-2 text-lg">ر.س / شهر</span>
                </div>
                <div className="text-sm text-slate-400 mb-2">
                  <span className="text-slate-300 font-bold">أو 999 ر.س/سنة (وفّر 189)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-8">
                {[
                  'حجوزات غير محدودة',
                  'موظفون غير محدودون',
                  'تتبع GPS مباشر',
                  'POS + كاشير + مخزون',
                  'إدارة رواتب',
                  'تقارير VAT + مالية',
                  'CRM + برنامج ولاء',
                  'مستشار ذكي AI',
                ].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-white/80">
                    <CheckCircle size={14} className="text-slate-300 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/onboard')}
                className="w-full py-4 rounded-xl bg-slate-900/40 text-white font-black text-lg shadow-xl shadow-black/40 hover:shadow-black/40 transition-all">
                ابدأ تجربة 14 يوم مجاناً
              </motion.button>
            </motion.div>
          </div>

          {/* Trust note */}
          <motion.div {...fadeUp(0.3)} className="text-center mt-10 space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              {[
                { icon:'', text: 'تجربة مجانية 14 يوم كاملة' },
                { icon: '💳', text: 'بدون بطاقة ائتمان' },
                { icon: '🔓', text: 'إلغاء في أي وقت' },
                { icon: '🧾', text: 'ضريبة القيمة المضافة شاملة' },
              ].map(({ icon, text }) => (
                <span key={text} className="flex items-center gap-1.5 text-slate-400">
                  <span>{icon}</span>
                  <span>{text}</span>
                </span>
              ))}
            </div>
            <p className="text-slate-600 text-xs">بعد انتهاء التجربة يمكنك الاشتراك أو إلغاء الحساب — لا يوجد أي التزام</p>
          </motion.div>
        </div>
      </section>

      {/* ══ COMPARISON TABLE ════════════════════════════════════════════════ */}
      <section className="relative py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <span className="inline-block text-xs font-bold tracking-widest text-slate-300 bg-slate-700/10 border border-white/10 rounded-full px-4 py-2 mb-4">
              قبل وبعد Jdawil
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 leading-tight">
              الفرق واضح
              <span className="text-white"> بالأرقام</span>
            </h2>
            <p className="text-slate-400 text-lg">هذا ما يتغير فعلاً في أسلوب إدارة متجرك</p>
          </motion.div>

          <motion.div {...fadeUp(0.1)} className="rounded-3xl border border-white/10 overflow-hidden bg-white/[0.02] backdrop-blur-sm">
            {/* Table header */}
            <div className="grid grid-cols-3 border-b border-white/10">
              <div className="px-6 py-4 text-sm font-bold text-slate-400">الميزة</div>
              <div className="px-6 py-4 text-sm font-bold text-red-400 bg-red-500/5 border-r border-l border-white/5 text-center">
                ❌ بدون نظام
              </div>
              <div className="px-6 py-4 text-sm font-bold text-slate-300 text-center bg-slate-700/5">
                ✅ مع Jdawil
              </div>
            </div>
            {comparisonRows.map((row, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className={`grid grid-cols-3 border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
              >
                <div className="px-6 py-4 text-sm font-semibold text-white">{row.feature}</div>
                <div className="px-6 py-4 text-sm text-slate-500 bg-red-500/[0.03] border-r border-l border-white/5 text-center">{row.before}</div>
                <div className="px-6 py-4 text-sm text-slate-300 font-medium text-center bg-slate-700/[0.03]">{row.after}</div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div {...fadeUp(0.3)} className="text-center mt-10">
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/onboard')}
              className="bg-slate-900/40 text-white px-10 py-[18px] rounded-2xl font-bold text-lg shadow-xl shadow-black/40"
            >
              أريد هذا التحول — ابدأ مجاناً
            </motion.button>
          </motion.div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ FAQ ══════════════════════════════════════════════════════════════ */}
      <section id="faq" className="relative py-28 px-4 overflow-hidden">
        <div className="max-w-3xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <span className="inline-block text-xs font-bold tracking-widest text-slate-300 bg-slate-800/40 border border-white/10 rounded-full px-4 py-2 mb-4">
              الأسئلة الشائعة
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
              كل ما تريد معرفته
              <span className="text-white"> قبل البدء</span>
            </h2>
            <p className="text-slate-400">لم تجد إجابتك؟ تواصل معنا عبر واتساب وسنرد فوراً</p>
          </motion.div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                {...fadeUp(i * 0.05)}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  openFaq === i
                    ? 'border-white/10 bg-orange-500/[0.06]'
                    : 'border-white/8 bg-white/[0.03] hover:border-white/15'
                }`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-right gap-4"
                  aria-expanded={openFaq === i}
                >
                  <span className="font-bold text-white text-sm sm:text-base leading-snug">{faq.q}</span>
                  <motion.span
                    animate={{ rotate: openFaq === i ? 45 : 0 }}
                    transition={{ duration: 0.25 }}
                    className={`text-2xl leading-none flex-shrink-0 ${openFaq === i ? 'text-slate-300' : 'text-slate-600'}`}
                  >
                    +
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === i && (
                    <motion.div
                      key="answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-6 pb-5 text-slate-400 text-sm leading-relaxed border-t border-white/5 pt-4">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp(0.3)} className="mt-10 p-6 rounded-2xl bg-white/[0.03] border border-white/8 text-center">
            <p className="text-slate-400 mb-3">لا تزال لديك أسئلة؟</p>
            <a
              href="https://wa.me/966500000000?text=أريد معرفة المزيد عن Jdawil"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-500 text-white px-6 py-3 rounded-xl font-bold transition-colors text-sm"
            >
              تحدث معنا على واتساب
            </a>
          </motion.div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ CTA SECTION ═════════════════════════════════════════════════════ */}
      <section className="relative py-32 px-4 border-t border-white/[0.06]">
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div {...fadeUp()}>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-8 leading-[1.2] tracking-tight">
              ابدأ اليوم — وعملاؤك يحجزون منك بكرة
            </h2>
            <p className="text-slate-400 text-lg mb-14 max-w-xl mx-auto leading-relaxed">
              تجربة مجانية ١٤ يوم. بدون بطاقة ائتمان. الإعداد يأخذ ٣ دقائق.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/onboard')}
                className="bg-orange-500 hover:bg-orange-500 text-white px-8 py-4 rounded-xl font-bold text-base transition-colors"
              >
                ابدأ مجاناً
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => window.open('https://wa.me/966500000000', '_blank')}
                className="bg-white/[0.05] border border-white/[0.1] hover:border-white/[0.2] text-slate-300 px-8 py-4 rounded-xl font-bold text-base transition-all"
              >
                تواصل عبر واتساب
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ TRUST BAR (before footer) ════════════════════════════════════════ */}
      <div className="border-t border-white/[0.06] py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { title: 'بيانات آمنة 100%', desc: 'تشفير SSL + عزل كامل بين المتاجر' },
              { title: 'وقت تشغيل 99.9%', desc: 'خوادم موثوقة مع نسخ احتياطي يومي' },
              { title: 'مصنوع للسعودية', desc: 'واجهة عربية + SAR + ضريبة القيمة المضافة' },
              { title: 'دعم بشري فوري', desc: 'واتساب + بريد — ٧ أيام في الأسبوع' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="flex flex-col items-center gap-2"
              >
                <p className="font-bold text-white text-sm">{item.title}</p>
                <p className="text-xs text-slate-500 leading-snug">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <footer className="relative py-14 px-4 border-t border-white/[0.07]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-900/40 flex items-center justify-center shadow-lg shadow-black/40">
                  <Droplets size={20} className="text-white" />
                </div>
                <div className="leading-tight">
                  <p className="font-black text-white text-lg">Jdawil</p>
                  <p className="text-[10px] text-slate-300/70 font-medium tracking-widest">Jdawil Platform</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                منصة سعودية لإدارة الحجوزات والخدمات — لكل المشاريع الخدمية: صالونات، تنظيف، صيانة، تجميل، وغيرها.
              </p>
            </div>

            {/* المنصة */}
            <div>
              <h4 className="text-sm font-bold text-white mb-4">المنصة</h4>
              <ul className="space-y-2.5 text-sm text-slate-500">
                <li><a href="#features" className="hover:text-white transition-colors">المزايا</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">الأسعار</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">الأسئلة الشائعة</a></li>
                <li><Link to="/demo" className="hover:text-white transition-colors">عرض تجريبي</Link></li>
                <li><Link to="/blog" className="hover:text-white transition-colors">المدونة</Link></li>
              </ul>
            </div>

            {/* لأصحاب المتاجر */}
            <div>
              <h4 className="text-sm font-bold text-white mb-4">لأصحاب المتاجر</h4>
              <ul className="space-y-2.5 text-sm text-slate-500">
                <li><Link to="/onboard" className="hover:text-white transition-colors">انضم بمتجرك</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">تسجيل الدخول</Link></li>
                <li><Link to="/onboard" className="hover:text-white transition-colors">تجربة مجانية ١٤ يوم</Link></li>
              </ul>
            </div>

            {/* قانوني */}
            <div>
              <h4 className="text-sm font-bold text-white mb-4">قانوني</h4>
              <ul className="space-y-2.5 text-sm text-slate-500">
                <li><Link to="/privacy" className="hover:text-white transition-colors">سياسة الخصوصية</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">شروط الاستخدام</Link></li>
              </ul>
            </div>

            {/* تواصل */}
            <div>
              <h4 className="text-sm font-bold text-white mb-4">تواصل معنا</h4>
              <ul className="space-y-2.5 text-sm text-slate-500">
                <li>
                  <a
                    href="https://wa.me/966500000000"
                    target="_blank" rel="noopener noreferrer"
                    className="hover:text-slate-300 transition-colors flex items-center gap-2"
                  >
                    واتساب — دعم فوري
                  </a>
                </li>
                <li className="text-slate-600">الرياض، المملكة العربية السعودية</li>
              </ul>

              {/* Schema keywords (hidden for SEO) */}
              <div className="sr-only" aria-hidden="true">
                برنامج إدارة مغسلة سيارات | نظام مغسلة متنقلة | تطبيق مغسلة سيارات السعودية |
                حجوزات مغسلة | رواتب موظفين مغسلة | فواتير ضريبة مغسلة | GPS مغسلة متنقلة
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">© {new Date().getFullYear()} منصة Jdawil — جميع الحقوق محفوظة</p>
            <div className="flex gap-5 text-xs text-slate-600">
              <span className="hover:text-slate-400 cursor-pointer transition-colors">سياسة الخصوصية</span>
              <span className="hover:text-slate-400 cursor-pointer transition-colors">شروط الاستخدام</span>
              <span className="hover:text-slate-400 cursor-pointer transition-colors">اتفاقية SLA</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Social Proof Ticker — shows recent platform activity */}
      <SocialProofTicker />
    </div>
  );
}
