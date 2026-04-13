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
    gradient: 'from-blue-500 to-cyan-400',
    glow: 'shadow-blue-500/25',
    border: 'border-blue-500/20',
    title: 'جلب العملاء تلقائي',
    desc: 'بدل ما تدور عملاء، هم يجونك عبر المنصة. مغسلتك تظهر في الماركت‌بليس ويحجزون مباشرة.',
  },
  {
    Icon: CalendarCheck,
    gradient: 'from-purple-500 to-pink-500',
    glow: 'shadow-purple-500/25',
    border: 'border-purple-500/20',
    title: 'حجوزات بدون اتصال',
    desc: 'العميل يحجز من جواله بثواني — تقويم تفاعلي + إشعارات واتساب فورية. خلاص ما فيه فوضى.',
  },
  {
    Icon: BarChart3,
    gradient: 'from-emerald-500 to-teal-400',
    glow: 'shadow-emerald-500/25',
    border: 'border-emerald-500/20',
    title: 'تتبع كل ريال',
    desc: 'قوائم مالية وتقارير ضريبية جاهزة. دخل ومصاريف وأرباح بمخططات + تصدير Excel + VAT تلقائي.',
  },
  {
    Icon: Users,
    gradient: 'from-orange-500 to-amber-400',
    glow: 'shadow-orange-500/25',
    border: 'border-orange-500/20',
    title: 'موظفينك تحت السيطرة',
    desc: 'جدولة، رواتب، أداء، GPS — تعرف وين كل موظف وكم أنجز وكم يستحق. شفافية كاملة.',
  },
  {
    Icon: Camera,
    gradient: 'from-rose-500 to-red-400',
    glow: 'shadow-rose-500/25',
    border: 'border-rose-500/20',
    title: 'مخزون ما ينقص',
    desc: 'تنبيه تلقائي قبل ما يخلص أي منتج + طلب من الموردين بضغطة. ما تتعطل أبداً.',
  },
  {
    Icon: MessageSquare,
    gradient: 'from-green-500 to-emerald-400',
    glow: 'shadow-green-500/25',
    border: 'border-green-500/20',
    title: 'تسويق ذكي',
    desc: 'حملات واتساب تلقائية + تصنيف عملاء (VIP، جديد، خامل) + عروض مخصصة ترجّعهم لك.',
  },
  {
    Icon: MapPin,
    gradient: 'from-indigo-500 to-blue-500',
    glow: 'shadow-indigo-500/25',
    border: 'border-indigo-500/20',
    title: 'تتبع GPS مباشر',
    desc: 'خريطة حية لموظفيك وسياراتهم — العميل يرى الموظف يقترب بالثواني مثل أوبر.',
  },
  {
    Icon: CreditCard,
    gradient: 'from-cyan-500 to-sky-500',
    glow: 'shadow-cyan-500/25',
    border: 'border-cyan-500/20',
    title: 'مدفوعات فورية',
    desc: 'STC Pay · مدى · Apple Pay بمفتاحك الخاص — المال يدخل حسابك مباشرة بدون وسيط.',
  },
  {
    Icon: Gift,
    gradient: 'from-violet-500 to-purple-500',
    glow: 'shadow-violet-500/25',
    border: 'border-violet-500/20',
    title: 'برامج ولاء تخليهم يرجعون',
    desc: 'نقاط أو بطاقة مخرَّمة بألوان مغسلتك — العميل يرجع لأنه يجمع مكافآت.',
  },
];

const stats = [
  { to: 120, suffix: '+', label: 'مغسلة مسجلة', color: 'from-blue-400 to-cyan-400' },
  { to: 15000, suffix: '+', label: 'حجز مكتمل', color: 'from-purple-400 to-pink-400' },
  { to: 4.9, suffix: '', label: 'تقييم', color: 'from-amber-400 to-orange-400', isDecimal: true },
  { to: 2, suffix: '+ مليون ر.س', label: 'إيرادات عملائنا', color: 'from-emerald-400 to-teal-400' },
];

const testimonials = [
  {
    name: 'أحمد الشمري',
    role: 'صاحب مغسلة الفخامة — الرياض',
    text: 'قبل Bokset كنت أدير كل شيء على واتساب! الآن الحجوزات تنظم نفسها والإيرادات زادت ٤٠٪ في أول شهرين.',
    rating: 5,
    avatar: 'أ',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'محمد العتيبي',
    role: 'صاحب مغسلة الكريستال — جدة',
    text: 'الميزة اللي أحبها هي تتبع الموظفين. العميل يشوف الموظف وين هو. الثقة اللي بنيناها مع عملائنا لا تقدر بثمن.',
    rating: 5,
    avatar: 'م',
    color: 'from-purple-500 to-pink-500',
  },
  {
    name: 'خالد الدوسري',
    role: 'مدير مغسلة النجمة — الدمام',
    text: 'إعداد بسيط جداً — حطيت مفتاح API للدفع وبدأنا نستقبل مدفوعات STC Pay في نفس اليوم. مافي كود ولا تعقيد.',
    rating: 5,
    avatar: 'خ',
    color: 'from-emerald-500 to-teal-500',
  },
];


const marqueeText = 'حجوزات ذكية ✦ GPS مباشر ✦ برامج الولاء ✦ فواتير PDF ✦ واتساب مدمج ✦ طابور الانتظار ✦ نقطة البيع ✦ أسطول المركبات ✦ تتبع لحظي ✦ White-label ✦ ';

const faqs = [
  {
    q: 'ما هو Bokset؟',
    a: 'Bokset هو برنامج SaaS متكامل لإدارة مغاسل السيارات في المملكة العربية السعودية. يوفر حجوزات ذكية، تتبع GPS مباشر للموظفين والسيارات، مدفوعات STC Pay ومدى، إدارة رواتب، وفواتير PDF — كل شيء في مكان واحد بدون تعقيد.',
  },
  {
    q: 'هل يناسب المغاسل المتنقلة والثابتة معاً؟',
    a: 'نعم. Bokset مُصمَّم من اليوم الأول لكلا النوعين. المغسلة المتنقلة تستفيد من تتبع GPS، حساب وقت الوصول، وتوزيع الحجوزات على السيارات المتاحة. المغسلة الثابتة تستفيد من نظام الطابور والكاشير وإدارة العملاء.',
  },
  {
    q: 'كم سعر الاشتراك وهل توجد رسوم إضافية؟',
    a: 'تبدأ الخطط من 29 ريال/شهر (مغسلة بايكات) وتصل إلى 299 ريال/شهر (أسطول كامل). لا توجد رسوم إعداد ولا عمولات على الحجوزات. السعر ثابت وشامل لجميع الميزات في الخطة.',
  },
  {
    q: 'هل أحتاج تثبيت تطبيق أو شراء أجهزة؟',
    a: 'لا. Bokset يعمل كـ PWA من المتصفح على أي جهاز. يمكن تثبيته على الشاشة الرئيسية بدون متجر تطبيقات. لا يحتاج أجهزة خاصة — جوالك كافٍ.',
  },
  {
    q: 'كيف تعمل المدفوعات الإلكترونية؟',
    a: 'تربط حساب ميسر أو Checkout.com الخاص بك بمفتاح API. المال يذهب مباشرة لحسابك البنكي — Bokset لا يلمس أموالك. يدعم STC Pay، مدى، Apple Pay، وNFC.',
  },
  {
    q: 'ماذا يحدث بعد انتهاء التجربة المجانية؟',
    a: 'تختار خطة وتشترك بأي طريقة دفع. إذا اخترت عدم الاستمرار، تُصدَّر بياناتك كاملةً بصيغة Excel وتُحذف بياناتك من الخوادم خلال 30 يوماً. لا يوجد أي التزام.',
  },
  {
    q: 'هل البيانات آمنة؟',
    a: 'نعم. كل مغسلة معزولة تماماً عن الأخرى (Multi-tenant isolation). البيانات مشفرة أثناء النقل وعند التخزين. يتم نسخ احتياطي يومي تلقائي.',
  },
  {
    q: 'هل أستطيع إدارة أكثر من مغسلة؟',
    a: 'نعم. تتوفر خطط للفروع المتعددة (2-3 فروع، 4-10 فروع) بلوحة تحكم موحدة تتيح مقارنة أداء كل فرع وإدارة الموظفين والمخزون من مكان واحد.',
  },
];

const competitorRows = [
  { feature: 'أقل سعر', competitor: '2,999 ريال/سنة', bokset: '29 ريال/شهر فقط' },
  { feature: 'نوع الدفع', competitor: 'سنوي مقدماً — بدون مرونة', bokset: 'شهري — ألغِ وقتما تشاء' },
  { feature: 'التخصص', competitor: 'عام (مطاعم، فنادق، مخابز...)', bokset: 'مغاسل السيارات فقط ✓' },
  { feature: 'تجربة مجانية', competitor: '❌ لا توجد', bokset: '✅ 14 يوماً بدون بطاقة' },
  { feature: 'ضمان السعر', competitor: '❌ لا يوجد', bokset: '✅ للمؤسسين للأبد' },
  { feature: 'GPS الموظفين', competitor: '⚠️ محدود', bokset: '✅ خريطة حية + مشاركة العميل' },
  { feature: 'واتساب مدمج', competitor: '⚠️ إضافي بتكلفة', bokset: '✅ مجاناً في كل الخطط' },
];

const comparisonRows = [
  { feature: 'استقبال الحجوزات', before: 'واتساب وهاتف يدوياً', after: 'تلقائي ٢٤/٧ بدون تدخل' },
  { feature: 'تتبع الموظفين', before: 'لا تعرف وين هم', after: 'GPS حي على الخريطة' },
  { feature: 'تذكير العملاء', before: 'تتصل يدوياً أو ينسون', after: 'واتساب تلقائي قبل ساعة' },
  { feature: 'استلام المدفوعات', before: 'كاش فقط', after: 'STC Pay، مدى، Apple Pay' },
  { feature: 'التقارير المالية', before: 'حسابات يدوية في Excel', after: 'مخططات فورية لحظية' },
  { feature: 'فواتير الضريبة', before: 'تعمل فاتورة لكل واحد', after: 'PDF تلقائي مع VAT 15%' },
  { feature: 'الرواتب', before: 'تحسب في نهاية الشهر', after: 'تحسب تلقائياً مع البونص' },
  { feature: 'نقص المخزون', before: 'تكتشفه وقت العمل', after: 'تنبيه فوري + طلب مورد تلقائي' },
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
    <div dir="rtl" className="min-h-screen bg-[#030711] text-white overflow-x-hidden">

      {/* ── Global keyframes for water drops & marquee ── */}
      <style>{`
        @keyframes rise {
          0%   { transform: translateY(0)   scale(1);   opacity: 0; }
          10%  { opacity: 0.7; }
          80%  { opacity: 0.4; }
          100% { transform: translateY(-110vh) scale(0.3); opacity: 0; }
        }
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .drop { animation: rise linear infinite; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; }
        .marquee-track { animation: marquee 28s linear infinite; }
      `}</style>

      {/* ── Background gradient mesh ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
        <motion.div
          animate={{ scale: [1, 1.15, 1], x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-48 -right-48 w-[800px] h-[800px] rounded-full bg-blue-600/12 blur-[140px]"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], x: [0, -40, 0], y: [0, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute top-[40%] -left-40 w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], x: [0, 20, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
          className="absolute bottom-[-20%] right-[20%] w-[500px] h-[500px] rounded-full bg-cyan-500/8 blur-[110px]"
        />
        <motion.div
          animate={{ scale: [1, 1.25, 1], y: [0, -30, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          className="absolute top-[65%] left-[30%] w-[400px] h-[400px] rounded-full bg-pink-600/7 blur-[100px]"
        />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.018]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.7) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.7) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* ══ NAVBAR ══════════════════════════════════════════════════════════ */}
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`fixed top-0 inset-x-0 z-50 border-b transition-all duration-300 ${
          scrolled ? 'bg-[#030711]/90 border-white/8 backdrop-blur-2xl shadow-xl shadow-black/30' : 'bg-transparent border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <motion.div
              whileHover={{ scale: 1.12, rotate: -8 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/40"
            >
              <Droplets size={17} className="text-white" />
            </motion.div>
            <div className="leading-tight">
              <p className="font-black text-white text-[15px] tracking-tight">Bokset</p>
              <p className="text-[10px] text-blue-400/70 font-medium tracking-widest">Car Wash SaaS</p>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {[{ label: 'المزايا', href: '#features' }, { label: 'الأسعار', href: '#pricing' }, { label: 'الأسئلة الشائعة', href: '#faq' }, { label: 'المدونة', href: '/blog', isLink: true }].map(item => (
              item.isLink
                ? <Link key={item.label} to={item.href!} className="relative text-slate-400 hover:text-white text-sm font-medium transition-colors group">
                    {item.label}
                    <span className="absolute -bottom-0.5 right-0 w-0 h-px bg-blue-400 group-hover:w-full transition-all duration-300" />
                  </Link>
                : <a key={item.label} href={item.href} className="relative text-slate-400 hover:text-white text-sm font-medium transition-colors group">
                    {item.label}
                    <span className="absolute -bottom-0.5 right-0 w-0 h-px bg-blue-400 group-hover:w-full transition-all duration-300" />
                  </a>
            ))}
            {user ? (
              <Link to={dashboardHref(user.role)} className="bg-gradient-to-l from-blue-600 to-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-blue-500/30 transition-all hover:scale-105">
                لوحتي
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/onboard" className="border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
                  انضم بمغسلتك
                </Link>
                <Link to="/login" className="bg-gradient-to-l from-blue-600 to-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-blue-500/30 transition-all hover:scale-105">
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
              className="md:hidden border-t border-white/5 bg-[#030711]/97 backdrop-blur-2xl overflow-hidden"
            >
              <div className="px-5 py-5 space-y-3">
                {/* Marketplace hidden until 200+ vendors */}
                {user ? (
                  <Link to={dashboardHref(user.role)} onClick={() => setMenuOpen(false)} className="block bg-gradient-to-l from-blue-600 to-blue-500 text-white px-4 py-3 rounded-xl text-sm font-bold text-center">لوحتي</Link>
                ) : (
                  <>
                    <Link to="/onboard" onClick={() => setMenuOpen(false)} className="block border border-blue-500/40 text-blue-400 px-4 py-3 rounded-xl text-sm font-medium text-center">انضم بمغسلتك</Link>
                    <Link to="/login" onClick={() => setMenuOpen(false)} className="block bg-gradient-to-l from-blue-600 to-blue-500 text-white px-4 py-3 rounded-xl text-sm font-bold text-center">ادخل</Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center pt-16 px-4 overflow-hidden">
        {/* Water drops */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          {DROPS.map(d => (
            <div
              key={d.id}
              className="drop absolute bottom-0 bg-gradient-to-t from-blue-500/80 to-cyan-400/60"
              style={{
                left: d.left,
                width: d.size,
                height: d.size * 1.3,
                animationDuration: `${d.duration}s`,
                animationDelay: `${d.delay}s`,
              }}
            />
          ))}
        </div>

        <motion.div style={{ opacity: heroOpacity, y: heroY, scale: heroScale }} className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/10 backdrop-blur-sm rounded-full px-5 py-2 mb-10"
          >
            <motion.span animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }} className="text-yellow-400">✨</motion.span>
            <span className="text-sm text-slate-300 font-medium">منصة #1 لمغاسل السيارات في السعودية</span>
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
          </motion.div>

          {/* H1 */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-5xl sm:text-6xl lg:text-[84px] font-black leading-[1.08] tracking-tight mb-7"
          >
            <span className="text-white">أدر مغسلتك من جوالك</span>
            <br />
            <span className="bg-gradient-to-l from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent bg-[length:200%] animate-gradient">
              واجلب عملاء جدد كل يوم
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed"
          >
            منصة متكاملة لإدارة الحجوزات والموظفين والمخزون والتسويق. جربها 14 يوم مجاناً.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-6"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/onboard')}
              className="relative group bg-gradient-to-l from-blue-600 to-cyan-500 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-2xl shadow-blue-500/40 overflow-hidden animate-pulse-slow"
              style={{ boxShadow: '0 0 40px rgba(59,130,246,0.4), 0 0 80px rgba(59,130,246,0.2)' }}
            >
              <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-2xl" />
              <span className="relative flex items-center gap-2 justify-center">
                ابدأ مجاناً
                <ChevronLeft size={22} />
              </span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                const el = document.getElementById('how-it-works');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-white/[0.06] border-2 border-white/20 hover:bg-white/10 hover:border-white/30 text-white px-9 py-5 rounded-2xl font-bold text-xl backdrop-blur-sm transition-all"
            >
              شوف كيف تشتغل
            </motion.button>
          </motion.div>

          {/* Trust line */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400 mb-20"
          >
            <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> بدون بطاقة ائتمانية</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> 14 يوم مجاناً</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> +120 مغسلة مسجلة</span>
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
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/25 to-purple-500/25 blur-3xl rounded-full scale-75" />
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="relative rounded-[3rem] border border-white/15 bg-gradient-to-b from-white/10 to-white/[0.03] backdrop-blur-xl shadow-2xl overflow-hidden"
              style={{ aspectRatio: '9/19' }}
            >
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-4 bg-black/70 rounded-full z-10" />
              <div className="absolute inset-0 pt-10 px-3 pb-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-2/5 rounded-full bg-white/15" />
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/60 to-cyan-400/60" />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    'from-purple-500/50 to-indigo-600/50',
                    'from-amber-500/50 to-orange-500/50',
                    'from-emerald-500/50 to-teal-500/50',
                    'from-blue-500/50 to-cyan-500/50',
                  ].map((g, i) => (
                    <div key={i} className={`h-14 rounded-2xl bg-gradient-to-br ${g} border border-white/10 p-2`}>
                      <div className="h-2 w-3/4 rounded-full bg-white/30 mb-1.5" />
                      <div className="h-1.5 w-1/2 rounded-full bg-white/20" />
                    </div>
                  ))}
                </div>
                <div className="h-24 rounded-2xl bg-gradient-to-br from-blue-600/40 to-purple-600/40 border border-white/10 p-3">
                  <div className="h-2.5 w-3/4 rounded-full bg-white/30 mb-2" />
                  <div className="h-2 w-1/2 rounded-full bg-white/20 mb-3" />
                  <div className="flex gap-1.5">
                    {[...Array(5)].map((_, i) => <div key={i} className="w-4 h-4 rounded-full bg-amber-400/70 flex items-center justify-center text-[7px] text-amber-900">★</div>)}
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

      {/* ══ MARQUEE ════════════════════════════════════════════════════════ */}
      <div className="relative py-5 bg-white/[0.025] border-y border-white/8 overflow-hidden">
        <div className="marquee-track flex whitespace-nowrap">
          {[marqueeText, marqueeText].map((t, i) => (
            <span key={i} className="text-slate-400 text-sm font-medium tracking-wide flex-shrink-0 px-4">{t}</span>
          ))}
        </div>
      </div>

      {/* ══ FEATURES ════════════════════════════════════════════════════════ */}
      <section id="features" className="relative py-28 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-20">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-5">
              <span className="text-xs text-blue-400 font-bold tracking-wide">لأصحاب المغاسل</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 leading-tight">
              مشاكلك لها حلول
              <br />
              <span className="bg-gradient-to-l from-blue-400 to-cyan-400 bg-clip-text text-transparent">وكلها في مكان واحد</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">كل ميزة صُممت لحل مشكلة حقيقية يعاني منها أصحاب المغاسل كل يوم</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ Icon, gradient, glow, border, title, desc }, i) => (
              <motion.div
                key={title}
                {...fadeUp(i * 0.06)}
                whileHover={{ y: -8, scale: 1.02 }}
                className={`group relative bg-white/[0.04] border ${border} hover:border-white/20 rounded-2xl p-6 transition-all duration-300 cursor-default overflow-hidden`}
              >
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${gradient} opacity-[0.05] rounded-2xl`} />
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-5 shadow-xl ${glow}`}>
                  <Icon size={21} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ PAIN POINTS ═════════════════════════════════════════════════════ */}
      <section className="relative py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <span className="inline-block text-xs font-bold tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-2 mb-4">
              هل تعاني من هذا؟
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
              المشاكل اليومية لكل
              <span className="bg-gradient-to-l from-red-400 to-orange-400 bg-clip-text text-transparent"> مغسلة بدون نظام</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
            {[
              { emoji: '😤', title: 'فوضى الحجوزات', desc: 'تستقبل طلبات على واتساب، إنستقرام، هاتف — تنسى وتخلط وتتأخر. العميل يزعل ويمشي.' },
              { emoji: '🤷', title: 'وين موظفي الآن؟', desc: 'ترسل موظف ولا تعرف وصل ولا لا. العميل يتصل يسأل وأنت ما عندك جواب.' },
              { emoji: '📉', title: 'لا تعرف كم ربحت', desc: 'في نهاية الشهر تحسب على الأوراق والكاشير وتتمنى ما أخطأت. مافي تقارير واضحة.' },
              { emoji: '😴', title: 'عملاء ينسون مواعيدهم', desc: 'حجز ثم لا أحد يأتي. الوقت يضيع والموظف يقعد فاضي. خسارة بدون سبب.' },
              { emoji: '💸', title: 'الدفع نقداً فقط', desc: 'تخسر عملاء ما معهم كاش. STC Pay ومدى وApple Pay مطلوبة — لكن الإعداد معقد.' },
              { emoji: '📦', title: 'مخزون ينتهي فجأة', desc: 'شامبو خلص في عز العمل. ما فيه تنبيهات ولا متابعة. تتعطل الشغل بدون سبب.' },
            ].map((p, i) => (
              <motion.div key={i} {...fadeUp(i * 0.07)}
                className="flex gap-4 bg-white/[0.03] border border-red-500/10 hover:border-red-500/25 rounded-2xl p-5 transition-all group">
                <span className="text-4xl flex-shrink-0 group-hover:scale-110 transition-transform">{p.emoji}</span>
                <div>
                  <h3 className="font-bold text-white mb-1">{p.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Transition arrow */}
          <motion.div {...fadeUp(0.3)} className="text-center">
            <div className="inline-flex flex-col items-center gap-3">
              <p className="text-slate-400 text-lg">كل هذا يختفي مع</p>
              <div className="flex items-center gap-3">
                <div className="h-px w-16 bg-gradient-to-l from-blue-500 to-transparent" />
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Droplets size={22} className="text-white" />
                </div>
                <div className="h-px w-16 bg-gradient-to-r from-blue-500 to-transparent" />
              </div>
              <p className="text-2xl font-black text-white">Bokset</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ ROI CALCULATOR ══════════════════════════════════════════════════ */}
      <section id="roi-calculator" className="relative py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/15 via-transparent to-transparent pointer-events-none" />
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-cyan-600/8 blur-[140px] pointer-events-none rounded-full" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-5">
              <span className="text-xs text-emerald-400 font-bold tracking-wide">حاسبة الأرباح</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4">
              احسب دخلك مع
              <span className="bg-gradient-to-l from-blue-400 to-cyan-400 bg-clip-text text-transparent"> Bokset</span>
            </h2>
            <p className="text-slate-400 text-lg">حرّك الشريط — وشاهد الأرقام تتغير</p>
          </motion.div>

          <motion.div
            {...fadeUp(0.1)}
            className="relative rounded-3xl border border-blue-500/20 bg-white/[0.03] backdrop-blur-sm p-8 sm:p-10 overflow-hidden"
          >
            {/* Gradient border glow */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/10 via-cyan-400/5 to-blue-500/10 pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Inputs */}
              <div className="space-y-8">
                {/* Washes per day */}
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6">
                  <label className="block text-sm font-bold text-slate-300 mb-4">كم غسلة تُنجز يومياً؟</label>
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-5xl font-black bg-gradient-to-l from-blue-400 to-cyan-400 bg-clip-text text-transparent min-w-[3rem] text-center">
                      {washesPerDay}
                    </span>
                    <span className="text-slate-500 text-sm">غسلة / يوم</span>
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
                  <label className="block text-sm font-bold text-slate-300 mb-4">متوسط سعر الغسلة (ر.س)؟</label>
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-5xl font-black bg-gradient-to-l from-emerald-400 to-teal-400 bg-clip-text text-transparent min-w-[4rem] text-center">
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
                    <div className="bg-gradient-to-br from-emerald-950/60 to-teal-950/40 border border-emerald-500/25 rounded-2xl p-5">
                      <p className="text-xs text-emerald-400 font-bold mb-2 tracking-wide">الدخل الشهري المتوقع</p>
                      <p className="text-4xl font-black text-emerald-300">
                        {(washesPerDay * pricePerWash * 26).toLocaleString('ar-SA')}
                        <span className="text-lg font-bold text-emerald-500 mr-2">ر.س</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">٢٦ يوم عمل × {washesPerDay} غسلة × {pricePerWash} ر.س</p>
                    </div>

                    {/* Annual Revenue */}
                    <div className="bg-gradient-to-br from-blue-950/60 to-cyan-950/40 border border-blue-500/25 rounded-2xl p-5">
                      <p className="text-xs text-blue-400 font-bold mb-2 tracking-wide">الدخل السنوي</p>
                      <p className="text-3xl font-black text-blue-300">
                        {(washesPerDay * pricePerWash * 26 * 12).toLocaleString('ar-SA')}
                        <span className="text-base font-bold text-blue-500 mr-2">ر.س</span>
                      </p>
                    </div>

                    {/* Time Saved */}
                    <div className="bg-gradient-to-br from-purple-950/60 to-pink-950/40 border border-purple-500/25 rounded-2xl p-5">
                      <p className="text-xs text-purple-400 font-bold mb-2 tracking-wide">الوقت الموفّر يومياً</p>
                      <p className="text-3xl font-black text-purple-300">
                        {washesPerDay * 8}
                        <span className="text-base font-bold text-purple-500 mr-2">دقيقة</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">٨ دقائق إدارة موفّرة لكل غسلة</p>
                    </div>

                    {/* Plan Cost */}
                    <div className="bg-gradient-to-br from-amber-950/40 to-orange-950/30 border border-amber-500/20 rounded-2xl p-4">
                      <p className="text-xs text-amber-400 font-bold mb-1">تكلفة Bokset الملائمة لك</p>
                      <p className="text-2xl font-black text-amber-300">
                        {washesPerDay <= 5 ? '29' : washesPerDay <= 20 ? '119' : '199'}
                        <span className="text-sm font-bold text-amber-500 mr-2">ر.س / شهر</span>
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
                className="bg-gradient-to-l from-blue-600 to-cyan-500 text-white px-10 py-[18px] rounded-2xl font-bold text-lg shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all"
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
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4">
              حياتك
              <span className="bg-gradient-to-l from-red-400 to-orange-400 bg-clip-text text-transparent"> قبل</span>
              {' '}و
              <span className="bg-gradient-to-l from-emerald-400 to-teal-400 bg-clip-text text-transparent"> بعد</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            {/* Before — Right column (RTL so it shows on the right) */}
            <motion.div
              {...fadeUp(0.1)}
              className="bg-red-950/20 border border-red-500/20 rounded-3xl p-8 flex flex-col"
            >
              <h3 className="text-2xl font-black text-red-300 mb-6 text-center">😤 قبل Bokset</h3>
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
              className="bg-emerald-950/20 border border-emerald-500/20 rounded-3xl p-8 flex flex-col"
            >
              <h3 className="text-2xl font-black text-emerald-300 mb-6 text-center">✨ بعد Bokset</h3>
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
                    className="flex items-start gap-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3"
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
              <div className="h-8 w-px bg-gradient-to-b from-transparent to-blue-500/50" />
              <div className="flex items-center gap-3 bg-white/[0.05] border border-white/15 rounded-2xl px-6 py-3">
                <span className="text-2xl">💧</span>
                <span className="font-black text-white text-lg tracking-tight">Bokset</span>
              </div>
              <div className="h-8 w-px bg-gradient-to-t from-transparent to-blue-500/50" />
            </div>
          </motion.div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ HOW IT WORKS (3 MINUTES) ════════════════════════════════════════ */}
      <section id="how-it-works" className="relative py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1.5 mb-5">
              <span className="text-xs text-cyan-400 font-bold tracking-wide">الإعداد فوري</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4">
              كيف تبدأ في
              <span className="bg-gradient-to-l from-cyan-400 to-blue-400 bg-clip-text text-transparent"> ٣ دقائق</span>
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
                  title: 'سجّل مغسلتك',
                  subtitle: '٣٠ ثانية',
                  desc: 'أدخل الاسم والجوال والمدينة',
                  gradient: 'from-blue-600 to-cyan-500',
                  glow: 'shadow-blue-500/40',
                },
                {
                  num: '٢',
                  title: 'أضف خدماتك وأسعارك',
                  subtitle: 'دقيقتان',
                  desc: '٣ نقرات وأسعارك جاهزة',
                  gradient: 'from-cyan-600 to-teal-500',
                  glow: 'shadow-cyan-500/40',
                },
                {
                  num: '٣',
                  title: 'استقبل أول حجز',
                  subtitle: 'فوري',
                  desc: 'شارك رابطك — وابدأ',
                  gradient: 'from-emerald-600 to-teal-500',
                  glow: 'shadow-emerald-500/40',
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
              className="bg-gradient-to-l from-cyan-600 to-blue-600 text-white px-12 py-[18px] rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-shadow"
            >
              ابدأ الآن — مجاناً لمدة ١٤ يوم
            </motion.button>
          </motion.div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ LIVE DASHBOARD PREVIEW ══════════════════════════════════════════ */}
      <section className="relative py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 via-transparent to-transparent pointer-events-none" />
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[120px] pointer-events-none rounded-full" />

        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <span className="inline-block text-xs font-bold tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-4">
              شاهد بنفسك
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
              داشبورد مغسلتك
              <span className="bg-gradient-to-l from-blue-400 to-cyan-300 bg-clip-text text-transparent"> في ثانية واحدة</span>
            </h2>
            <p className="text-slate-400 text-lg">هذا ما تراه كل صباح عند فتح Bokset</p>
          </motion.div>

          {/* Mock Dashboard */}
          <motion.div {...fadeUp(0.1)}
            className="rounded-3xl border border-white/10 bg-[#070e1f] overflow-hidden shadow-2xl shadow-blue-500/10">

            {/* Top bar */}
            <div className="flex items-center gap-2 px-5 py-3 bg-white/[0.03] border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <div className="mx-auto text-xs text-slate-500 bg-white/5 px-6 py-1 rounded-full">bokset.sa/vendor</div>
            </div>

            <div className="p-5 md:p-7">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white">صباح الخير، أحمد 👋</h3>
                  <p className="text-xs text-slate-400">الأحد، ٩ أبريل ٢٠٢٥</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-green-500/20 text-green-400 text-xs px-3 py-1.5 rounded-full border border-green-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    ٣ موظفين نشطين
                  </div>
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'حجوزات اليوم', value: '١٢', sub: '+٣ من أمس', color: 'from-blue-500 to-cyan-500', icon: '📅' },
                  { label: 'إيراد هذا الشهر', value: '١٢,٤٥٠', sub: 'ريال', color: 'from-emerald-500 to-teal-500', icon: '💰' },
                  { label: 'متوسط التقييم', value: '٤.٨', sub: 'من ٨٩ تقييم', color: 'from-amber-500 to-orange-500', icon: '⭐' },
                  { label: 'عملاء جدد', value: '٢٨', sub: 'هذا الشهر', color: 'from-purple-500 to-pink-500', icon: '👥' },
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
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">↑ ١٨٪</span>
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
                            className={`w-full rounded-t-lg ${isLast ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-gradient-to-t from-blue-600/50 to-blue-400/50'}`}
                            style={{ minHeight: 3 }}
                          />
                          <span className={`text-[9px] ${isLast ? 'text-emerald-400' : 'text-slate-600'}`}>{days[i]}</span>
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
                      { name: 'خالد العمري', service: 'غسيل شامل', status: 'في الطريق', color: 'bg-blue-500' },
                      { name: 'سعد الغامدي', service: 'تلميع خارجي', status: 'جاري', color: 'bg-emerald-500' },
                      { name: 'فهد المطيري', service: 'غسيل داخلي', status: 'مؤكد', color: 'bg-amber-500' },
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
                <div className="mr-auto text-[10px] text-slate-600">Bokset v1.0</div>
              </div>
            </div>
          </motion.div>

          {/* Caption */}
          <motion.p {...fadeUp(0.2)} className="text-center text-slate-500 text-sm mt-6">
            هذا داشبورد حقيقي — تراه فوراً بعد تسجيل مغسلتك
          </motion.p>
        </div>
      </section>

      {/* ══ TESTIMONIALS ════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/5 to-purple-900/5 pointer-events-none" />
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-5">
              <span className="text-xs text-amber-400 font-bold tracking-wide">آراء العملاء</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black">
              ماذا يقول{' '}
              <span className="bg-gradient-to-l from-amber-400 to-orange-400 bg-clip-text text-transparent">أصحاب المغاسل</span>
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
                        <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
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
                    i === testimonialIdx ? 'w-7 h-2 bg-blue-400' : 'w-2 h-2 bg-white/20 hover:bg-white/40'
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
            <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-5">
              <span className="text-xs text-purple-400 font-bold tracking-wide">البداية سهلة</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black">
              ابدأ في{' '}
              <span className="bg-gradient-to-l from-purple-400 to-pink-400 bg-clip-text text-transparent">٣ خطوات</span>
            </h2>
          </motion.div>

          <div className="relative">
            <div className="hidden md:block absolute top-11 right-[17%] left-[17%] h-px border-t-2 border-dashed border-white/10 z-0" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative z-10">
              {[
                { Icon: Building2, num: '١', title: 'سجّل مغسلتك', desc: 'أنشئ حسابك وأضف بيانات مغسلتك في أقل من دقيقتين' },
                { Icon: Settings, num: '٢', title: 'فعّل مزاياك', desc: 'أضف مفتاح الدفع وخدماتك وموظفيك من لوحة إعداد واحدة' },
                { Icon: CheckCircle, num: '٣', title: 'استقبل وأدر', desc: 'ابدأ في استقبال الحجوزات والمدفوعات فوراً' },
              ].map(({ Icon, num, title, desc }, i) => (
                <motion.div key={title} {...fadeUp(i * 0.15)} className="text-center group">
                  <div className="relative mx-auto w-20 h-20 mb-6">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 opacity-20 blur-xl group-hover:opacity-50 transition-opacity duration-300" />
                    <div className="relative w-full h-full rounded-full bg-white/[0.05] border border-white/15 flex flex-col items-center justify-center gap-0.5">
                      <Icon size={20} className="text-blue-400" />
                      <span className="text-xs font-black text-slate-400">{num}</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
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
              className="bg-gradient-to-l from-purple-600 to-blue-600 text-white px-10 py-[18px] rounded-2xl font-bold text-lg shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 transition-shadow"
            >
              سجّل مغسلتك مجاناً
            </motion.button>
          </motion.div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ CUSTOMER SEARCH ═════════════════════════════════════════════════ */}
      <section className="relative py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div {...fadeUp()}>
            <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1.5 mb-5">
              <span className="text-xs text-cyan-400 font-bold">للعملاء</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              ابحث عن{' '}
              <span className="bg-gradient-to-l from-cyan-400 to-blue-400 bg-clip-text text-transparent">مغسلة بالقرب منك</span>
            </h2>
            <p className="text-slate-400 text-lg mb-10">اكتشف أفضل مغاسل السيارات في مدينتك واحجز بضغطة واحدة</p>
          </motion.div>
          <motion.form {...fadeUp(0.1)} onSubmit={handleSearch} className="flex gap-3 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث بالمدينة أو اسم المغسلة..."
                className="w-full bg-white/[0.05] border border-white/15 text-white placeholder-slate-500 pr-11 pl-4 py-4 rounded-2xl focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all text-sm backdrop-blur-sm"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              type="submit"
              className="bg-gradient-to-l from-cyan-600 to-blue-600 text-white px-7 py-4 rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/20 whitespace-nowrap"
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
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <Icon size={20} className="text-cyan-400" />
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
                  <p className="text-amber-100 text-sm mt-0.5">
                    أول 100 مغسلة تسجل في Bokset تحتفظ بسعر اليوم حتى لو رفعنا الأسعار لاحقاً
                  </p>
                  {foundingSeats !== null && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5">
                      <div className="w-24 h-2 rounded-full bg-amber-900/30 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-white"
                          style={{ width: `${Math.min(100, ((100 - foundingSeats) / 100) * 100)}%` }}
                        />
                      </div>
                      <span className="text-amber-100 text-xs font-bold">
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
                className="flex-shrink-0 bg-white text-amber-700 font-black px-6 py-3 rounded-xl shadow-md hover:bg-amber-50 transition-all text-sm whitespace-nowrap"
              >
                احجز مقعدك التأسيسي ←
              </motion.button>
            </div>
          </motion.div>
        </section>
      )}

      {/* ══ PRICING SECTION ═════════════════════════════════════════════════ */}
      <section className="relative py-28 px-4 overflow-hidden" id="pricing">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/20 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-10">
            <span className="inline-block text-xs font-bold tracking-widest text-blue-400 uppercase bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-4">
              الأسعار
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
              باقة تناسب
              <span className="bg-gradient-to-l from-blue-400 to-cyan-300 bg-clip-text text-transparent"> كل مغسلة</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto mb-4">
              بدون رسوم إعداد — بدون عقود — يمكنك الإلغاء في أي وقت
            </p>
            <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 rounded-full px-5 py-2.5">
              <span className="text-amber-400 text-lg">🔥</span>
              <span className="text-amber-300 text-sm font-black">أول 100 مغسلة = سعر مثبّت للأبد</span>
            </div>
          </motion.div>

          {/* ── Free Trial Banner ── */}
          <motion.div
            {...fadeUp(0.1)}
            className="relative mb-12 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-l from-emerald-950/60 via-teal-950/50 to-emerald-950/60 backdrop-blur-sm p-6"
          >
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-l from-emerald-500/5 via-teal-400/10 to-emerald-500/5 pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
              <div className="flex items-center gap-4">
                <motion.div
                  animate={{ rotate: [0, -15, 15, 0], scale: [1, 1.15, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
                  className="text-4xl flex-shrink-0"
                >🎁</motion.div>
                <div>
                  <p className="text-white font-black text-xl sm:text-2xl leading-tight">
                    جرب أي باقة مجاناً لمدة <span className="text-emerald-300">14 يوم</span> كاملة
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
                className="flex-shrink-0 bg-emerald-500 hover:bg-emerald-400 text-white font-black px-7 py-3.5 rounded-xl shadow-lg shadow-emerald-500/30 transition-all text-sm whitespace-nowrap"
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
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                🔒 المشتركون الآن يحتفظون بهذا السعر للأبد
              </span>
            </motion.div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Bike Solo */}
            <motion.div {...fadeUp(0.05)}
              className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-7 flex flex-col hover:border-blue-500/40 hover:bg-white/[0.07] transition-all duration-300 group">
              <div className="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md shadow-emerald-500/30">14 يوم مجاناً</div>
              <div className="text-4xl mb-4">🏍️</div>
              <h3 className="text-lg font-bold text-white mb-1">بايك واحد</h3>
              <p className="text-sm text-slate-400 mb-6">للمغاسل المتنقلة بدراجة نارية</p>
              <div className="mt-auto">
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-5xl font-black text-white">29</span>
                  <span className="text-slate-400 mb-2">ر.س / شهر</span>
                </div>
                <ul className="space-y-2.5 mb-7 text-sm text-slate-300">
                  {['حجوزات غير محدودة','إشعارات واتساب','تتبع GPS','تقارير مبسطة','دعم فني'].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle size={15} className="text-blue-400 flex-shrink-0" />
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

            {/* Bikes Pack */}
            <motion.div {...fadeUp(0.1)}
              className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-7 flex flex-col hover:border-cyan-500/40 hover:bg-white/[0.07] transition-all duration-300">
              <div className="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md shadow-emerald-500/30">14 يوم مجاناً</div>
              <div className="text-4xl mb-4">🏍️🏍️</div>
              <h3 className="text-lg font-bold text-white mb-1">5 بايكات</h3>
              <p className="text-sm text-slate-400 mb-6">لأسطول دراجات متنقل</p>
              <div className="mt-auto">
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-5xl font-black text-white">129</span>
                  <span className="text-slate-400 mb-2">ر.س / شهر</span>
                </div>
                <ul className="space-y-2.5 mb-7 text-sm text-slate-300">
                  {['حتى 5 بايكات','إدارة مركزية','لوحة موظفين','جدول المناوبات','تقارير متقدمة','دعم فني مميز'].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle size={15} className="text-cyan-400 flex-shrink-0" />
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

            {/* Car Solo */}
            <motion.div {...fadeUp(0.15)}
              className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-7 flex flex-col hover:border-purple-500/40 hover:bg-white/[0.07] transition-all duration-300">
              <div className="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md shadow-emerald-500/30">14 يوم مجاناً</div>
              <div className="text-4xl mb-4">🚗</div>
              <h3 className="text-lg font-bold text-white mb-1">سيارة واحدة</h3>
              <p className="text-sm text-slate-400 mb-6">للمغاسل المتنقلة بسيارة</p>
              <div className="mt-auto">
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-5xl font-black text-white">119</span>
                  <span className="text-slate-400 mb-2">ر.س / شهر</span>
                </div>
                <ul className="space-y-2.5 mb-7 text-sm text-slate-300">
                  {['حجوزات غير محدودة','إشعارات واتساب','تتبع GPS للسيارة','POS كاشير','إدارة مخزون','دعم فني'].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle size={15} className="text-purple-400 flex-shrink-0" />
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

            {/* Fixed Wash */}
            <motion.div {...fadeUp(0.2)}
              className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-7 flex flex-col hover:border-amber-500/40 hover:bg-white/[0.07] transition-all duration-300">
              <div className="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md shadow-emerald-500/30">14 يوم مجاناً</div>
              <div className="text-4xl mb-4">🏪</div>
              <h3 className="text-lg font-bold text-white mb-1">مغسلة ثابتة</h3>
              <p className="text-sm text-slate-400 mb-6">للمغاسل بموقع ثابت</p>
              <div className="mt-auto">
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-5xl font-black text-white">199</span>
                  <span className="text-slate-400 mb-2">ر.س / شهر</span>
                </div>
                <ul className="space-y-2.5 mb-7 text-sm text-slate-300">
                  {['طابور انتظار ذكي','شاشة عرض للعملاء','كاشير POS متكامل','إدارة مخزون','تقارير VAT','برنامج ولاء','دعم فني مميز'].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle size={15} className="text-amber-400 flex-shrink-0" />
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

            {/* Fleet — MOST POPULAR, spans 2 cols on lg */}
            <motion.div {...fadeUp(0.1)}
              className="relative lg:col-span-2 rounded-3xl border-2 border-blue-500/60 bg-gradient-to-br from-blue-900/40 to-purple-900/30 backdrop-blur-sm p-7 flex flex-col overflow-hidden">
              {/* Popular badge */}
              <div className="absolute top-5 left-5 flex gap-2">
                <span className="bg-gradient-to-l from-blue-500 to-cyan-400 text-white text-xs font-black px-3 py-1 rounded-full">
                  ⭐ الأكثر طلباً
                </span>
                <span className="bg-emerald-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-md shadow-emerald-500/30">
                  14 يوم مجاناً
                </span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />

              <div className="text-4xl mb-4 mt-8">🚗🏍️</div>
              <h3 className="text-xl font-black text-white mb-1">أسطول كامل</h3>
              <p className="text-sm text-slate-300 mb-6">5 سيارات + 5 بايكات — للأسطول الكبير</p>

              <div className="flex flex-wrap items-end gap-x-6 gap-y-2 mb-8">
                <div className="flex items-end gap-1">
                  <span className="text-6xl font-black text-white">299</span>
                  <span className="text-slate-300 mb-2 text-lg">ر.س / شهر</span>
                </div>
                <div className="text-sm text-slate-400 mb-2">
                  <span className="line-through text-slate-600">600 ر.س</span>
                  <span className="text-green-400 font-bold mr-2">وفّر 50%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-8">
                {[
                  'حتى 5 سيارات + 5 بايكات',
                  'موظفون غير محدودون',
                  'تتبع GPS لكل الأسطول',
                  'إدارة رواتب متكاملة',
                  'تقارير VAT + ZATCA',
                  'POS + كاشير + مخزون',
                  'برنامج ولاء العملاء',
                  'دعم فني أولوية 24/7',
                ].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-white/80">
                    <CheckCircle size={14} className="text-blue-400 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/onboard')}
                className="w-full py-4 rounded-xl bg-gradient-to-l from-blue-600 to-cyan-500 text-white font-black text-lg shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all">
                ابدأ تجربة 14 يوم مجاناً
              </motion.button>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-5">
            {/* Unlimited Bikes Fleet */}
            <motion.div {...fadeUp(0.25)}
              className="relative rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-900/20 to-teal-900/20 backdrop-blur-sm p-7 flex flex-col hover:border-emerald-500/70 transition-all duration-300">
              <div className="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md shadow-emerald-500/30">14 يوم مجاناً</div>
              <div className="text-4xl mb-4">🏍️∞</div>
              <h3 className="text-xl font-black text-white mb-1">أسطول بايكات مفتوح</h3>
              <p className="text-sm text-slate-300 mb-6">عدد غير محدود من البايكات</p>
              <div className="mt-auto">
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-5xl font-black text-white">469</span>
                  <span className="text-slate-400 mb-2">ر.س / شهر</span>
                </div>
                <ul className="space-y-2.5 mb-7 text-sm text-slate-300">
                  {['بايكات غير محدودة','إدارة مركزية كاملة','رواتب وعمولات تلقائية','تقارير متقدمة','أولوية قصوى في الدعم','API للتكامل مع أنظمتك'].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/onboard')}
                  className="w-full py-3 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-500 text-white font-bold transition-all shadow-lg shadow-emerald-500/20">
                  ابدأ مجاناً
                </motion.button>
              </div>
            </motion.div>

            {/* Multi-branch 2-3 */}
            <motion.div {...fadeUp(0.28)}
              className="relative rounded-3xl border border-violet-500/40 bg-gradient-to-br from-violet-900/20 to-purple-900/20 backdrop-blur-sm p-7 flex flex-col hover:border-violet-500/70 transition-all duration-300">
              <div className="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md shadow-emerald-500/30">14 يوم مجاناً</div>
              <div className="text-4xl mb-4">🏪🏪</div>
              <h3 className="text-xl font-black text-white mb-1">فروع مغاسل (2-3)</h3>
              <p className="text-sm text-slate-300 mb-6">إدارة 2 إلى 3 فروع من مكان واحد</p>
              <div className="mt-auto">
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-5xl font-black text-white">349</span>
                  <span className="text-slate-400 mb-2">ر.س / شهر</span>
                </div>
                <ul className="space-y-2.5 mb-7 text-sm text-slate-300">
                  {['إدارة 2-3 فروع','لوحة تحكم موحدة','موظفون غير محدودون','تقارير لكل فرع','إدارة مخزون لكل فرع','دعم فني مميز'].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle size={15} className="text-violet-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/onboard')}
                  className="w-full py-3 rounded-xl bg-gradient-to-l from-violet-600 to-purple-500 text-white font-bold transition-all shadow-lg shadow-violet-500/20">
                  ابدأ مجاناً
                </motion.button>
              </div>
            </motion.div>

            {/* Multi-branch 4-10 */}
            <motion.div {...fadeUp(0.3)}
              className="relative rounded-3xl border-2 border-amber-500/60 bg-gradient-to-br from-amber-900/30 to-yellow-900/20 backdrop-blur-sm p-7 flex flex-col overflow-hidden">
              <div className="absolute top-5 left-5 flex gap-2">
                <span className="bg-gradient-to-l from-amber-500 to-yellow-400 text-black text-xs font-black px-3 py-1 rounded-full">
                  🏆 للشركات
                </span>
                <span className="bg-emerald-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-md shadow-emerald-500/30">
                  14 يوم مجاناً
                </span>
              </div>
              <div className="text-4xl mb-4 mt-8">🏪×10</div>
              <h3 className="text-xl font-black text-white mb-1">فروع مغاسل (4-10)</h3>
              <p className="text-sm text-slate-300 mb-6">سلسلة فروع احترافية</p>
              <div className="mt-auto">
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-5xl font-black text-white">799</span>
                  <span className="text-slate-400 mb-2">ر.س / شهر</span>
                </div>
                <ul className="space-y-2.5 mb-7 text-sm text-slate-300">
                  {['إدارة 4-10 فروع','لوحة تحكم مركزية','تقارير مقارنة بين الفروع','رواتب لجميع الموظفين','VAT + ZATCA لكل فرع','مدير حساب مخصص','API للتكامل'].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle size={15} className="text-amber-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/onboard')}
                  className="w-full py-3 rounded-xl bg-gradient-to-l from-amber-500 to-yellow-400 text-black font-black transition-all shadow-lg shadow-amber-500/30">
                  تواصل معنا
                </motion.button>
              </div>
            </motion.div>

            {/* Unlimited Cars Fleet */}
            <motion.div {...fadeUp(0.3)}
              className="relative rounded-3xl border border-rose-500/40 bg-gradient-to-br from-rose-900/20 to-orange-900/20 backdrop-blur-sm p-7 flex flex-col hover:border-rose-500/70 transition-all duration-300">
              <div className="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md shadow-emerald-500/30">14 يوم مجاناً</div>
              <div className="text-4xl mb-4">🚗∞</div>
              <h3 className="text-xl font-black text-white mb-1">أسطول سيارات مفتوح</h3>
              <p className="text-sm text-slate-300 mb-6">عدد غير محدود من السيارات</p>
              <div className="mt-auto">
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-5xl font-black text-white">699</span>
                  <span className="text-slate-400 mb-2">ر.س / شهر</span>
                </div>
                <ul className="space-y-2.5 mb-7 text-sm text-slate-300">
                  {['سيارات غير محدودة','تتبع GPS لكل الأسطول','رواتب وعمولات تلقائية','تقارير VAT + ZATCA','مدير حساب مخصص','API للتكامل مع أنظمتك'].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle size={15} className="text-rose-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/onboard')}
                  className="w-full py-3 rounded-xl bg-gradient-to-l from-rose-600 to-orange-500 text-white font-bold transition-all shadow-lg shadow-rose-500/20">
                  ابدأ مجاناً
                </motion.button>
              </div>
            </motion.div>
          </div>

          {/* Trust note */}
          <motion.div {...fadeUp(0.3)} className="text-center mt-10 space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              {[
                { icon: '🎁', text: 'تجربة مجانية 14 يوم كاملة' },
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
            <span className="inline-block text-xs font-bold tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2 mb-4">
              قبل وبعد Bokset
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 leading-tight">
              الفرق واضح
              <span className="bg-gradient-to-l from-emerald-400 to-teal-400 bg-clip-text text-transparent"> بالأرقام</span>
            </h2>
            <p className="text-slate-400 text-lg">هذا ما يتغير فعلاً في أسلوب إدارة مغسلتك</p>
          </motion.div>

          <motion.div {...fadeUp(0.1)} className="rounded-3xl border border-white/10 overflow-hidden bg-white/[0.02] backdrop-blur-sm">
            {/* Table header */}
            <div className="grid grid-cols-3 border-b border-white/10">
              <div className="px-6 py-4 text-sm font-bold text-slate-400">الميزة</div>
              <div className="px-6 py-4 text-sm font-bold text-red-400 bg-red-500/5 border-r border-l border-white/5 text-center">
                ❌ بدون نظام
              </div>
              <div className="px-6 py-4 text-sm font-bold text-emerald-400 text-center bg-emerald-500/5">
                ✅ مع Bokset
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
                <div className="px-6 py-4 text-sm text-emerald-300 font-medium text-center bg-emerald-500/[0.03]">{row.after}</div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div {...fadeUp(0.3)} className="text-center mt-10">
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/onboard')}
              className="bg-gradient-to-l from-emerald-600 to-teal-500 text-white px-10 py-[18px] rounded-2xl font-bold text-lg shadow-xl shadow-emerald-500/25"
            >
              أريد هذا التحول — ابدأ مجاناً
            </motion.button>
          </motion.div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ COMPETITOR COMPARISON ════════════════════════════════════════════ */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-1.5 mb-5">
              <span className="text-xs text-red-400 font-bold tracking-wide">مقارنة شفافة</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-3">
              لماذا Bokset وليس
              <span className="bg-gradient-to-l from-red-400 to-orange-400 bg-clip-text text-transparent"> البدائل الأخرى؟</span>
            </h2>
            <p className="text-slate-400 text-lg">مقارنة صادقة مع أشهر المنافسين في السوق السعودي</p>
          </motion.div>

          <motion.div {...fadeUp(0.1)} className="rounded-3xl border border-white/10 overflow-hidden bg-white/[0.02] backdrop-blur-sm">
            <div className="grid grid-cols-3 border-b border-white/10">
              <div className="px-5 py-4 text-sm font-bold text-slate-400">الميزة</div>
              <div className="px-5 py-4 text-sm font-bold text-red-400 bg-red-500/5 border-r border-l border-white/5 text-center">
                ⚔️ المنافسون
                <div className="text-xs text-slate-600 font-normal">مثل ركاز وغيره</div>
              </div>
              <div className="px-5 py-4 text-sm font-bold text-blue-400 text-center bg-blue-500/5">
                💧 Bokset
              </div>
            </div>
            {competitorRows.map((row, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className={`grid grid-cols-3 border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
              >
                <div className="px-5 py-4 text-sm font-semibold text-white">{row.feature}</div>
                <div className="px-5 py-4 text-sm text-red-300/80 bg-red-500/[0.03] border-r border-l border-white/5 text-center">{row.competitor}</div>
                <div className="px-5 py-4 text-sm text-emerald-300 font-bold text-center bg-emerald-500/[0.03]">{row.bokset}</div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div {...fadeUp(0.2)} className="text-center mt-8">
            <p className="text-slate-500 text-sm mb-6">* الأسعار والمميزات حسب ما هو معلن على مواقع المنافسين</p>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/onboard')}
              className="bg-gradient-to-l from-blue-600 to-cyan-500 text-white px-10 py-[18px] rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/25"
            >
              ابدأ بـ 29 ريال/شهر — بدون إلزام
            </motion.button>
          </motion.div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ FAQ ══════════════════════════════════════════════════════════════ */}
      <section id="faq" className="relative py-28 px-4 overflow-hidden">
        <div className="max-w-3xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <span className="inline-block text-xs font-bold tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-4">
              الأسئلة الشائعة
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              كل ما تريد معرفته
              <span className="bg-gradient-to-l from-blue-400 to-cyan-400 bg-clip-text text-transparent"> قبل البدء</span>
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
                    ? 'border-blue-500/40 bg-blue-500/[0.06]'
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
                    className={`text-2xl leading-none flex-shrink-0 ${openFaq === i ? 'text-blue-400' : 'text-slate-600'}`}
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
              href="https://wa.me/966500000000?text=أريد معرفة المزيد عن Bokset"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold transition-colors text-sm"
            >
              <span>💬</span>
              تحدث معنا على واتساب
            </a>
          </motion.div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ══ CTA SECTION ═════════════════════════════════════════════════════ */}
      <section className="relative py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-blue-900/40" />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none"
        />
        <div className="absolute inset-0 border-y border-white/10" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div {...fadeUp()}>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
              className="text-5xl mb-6 inline-block"
            >
              🚗
            </motion.div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6 leading-tight">
              سيارة عميلك تستاهل
              <br />
              <span className="bg-gradient-to-l from-blue-400 via-cyan-300 to-purple-400 bg-clip-text text-transparent">ومغسلتك تستاهل Bokset</span>
            </h2>
            <p className="text-slate-300 text-xl mb-12">١٤ يوم مجاناً — بدون بطاقة ائتمان — الإعداد يأخذ ٣ دقائق</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/onboard')}
                className="group relative bg-white text-blue-700 px-12 py-5 rounded-2xl font-black text-xl shadow-2xl shadow-black/30 overflow-hidden"
                style={{ boxShadow: '0 0 40px rgba(255,255,255,0.15), 0 25px 50px rgba(0,0,0,0.3)' }}
              >
                <span className="absolute inset-0 bg-gradient-to-l from-blue-50 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <span className="relative flex items-center gap-2 justify-center">ابدأ الآن مجاناً <ChevronLeft size={22} /></span>
              </motion.button>
            </div>
            <a
              href="https://wa.me/966500000000?text=أبي أعرف أكثر عن Bokset"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors text-lg font-bold"
            >
              <span>💬</span>
              أو تواصل معنا على واتساب
            </a>
          </motion.div>
        </div>
      </section>

      {/* ══ TRUST BAR (before footer) ════════════════════════════════════════ */}
      <div className="border-t border-white/[0.06] py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { icon: '🔒', title: 'بيانات آمنة 100%', desc: 'تشفير SSL + عزل كامل بين المغاسل' },
              { icon: '⚡', title: 'وقت تشغيل 99.9%', desc: 'خوادم موثوقة مع نسخ احتياطي يومي' },
              { icon: '🇸🇦', title: 'مصنوع للسعودية', desc: 'واجهة عربية كاملة + دعم SAR + VAT' },
              { icon: '🎧', title: 'دعم بشري فوري', desc: 'واتساب + بريد — ٧ أيام في الأسبوع' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-3xl">{item.icon}</span>
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
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Droplets size={20} className="text-white" />
                </div>
                <div className="leading-tight">
                  <p className="font-black text-white text-lg">Bokset</p>
                  <p className="text-[10px] text-blue-400/70 font-medium tracking-widest">Bokset Platform</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                المنصة الأولى في السعودية لإدارة مغاسل السيارات المتنقلة والثابتة.
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

            {/* لأصحاب المغاسل */}
            <div>
              <h4 className="text-sm font-bold text-white mb-4">لأصحاب المغاسل</h4>
              <ul className="space-y-2.5 text-sm text-slate-500">
                <li><Link to="/onboard" className="hover:text-white transition-colors">انضم بمغسلتك</Link></li>
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
                    className="hover:text-green-400 transition-colors flex items-center gap-2"
                  >
                    <span>💬</span> واتساب — دعم فوري
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
            <p className="text-xs text-slate-600">© {new Date().getFullYear()} منصة Bokset — جميع الحقوق محفوظة</p>
            <div className="flex gap-5 text-xs text-slate-600">
              <span className="hover:text-slate-400 cursor-pointer transition-colors">سياسة الخصوصية</span>
              <span className="hover:text-slate-400 cursor-pointer transition-colors">شروط الاستخدام</span>
              <span className="hover:text-slate-400 cursor-pointer transition-colors">اتفاقية SLA</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
