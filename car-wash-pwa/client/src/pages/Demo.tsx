import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Users, Package, Navigation, Megaphone, Wallet,
  BarChart3, ChevronDown, MapPin, Star, ExternalLink,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

/* ---- mock data ---- */
const stats = [
  { label: 'حجوزات اليوم', value: '12', color: 'from-blue-500 to-cyan-400' },
  { label: 'إيراد اليوم', value: '1,850 ر.س', color: 'from-emerald-500 to-teal-400' },
  { label: 'عملاء جدد هالأسبوع', value: '8', color: 'from-purple-500 to-pink-400' },
  { label: 'تقييم المغسلة', value: '4.8', color: 'from-amber-400 to-orange-400' },
];

const revenueData = [
  { day: 'السبت', rev: 1200 }, { day: 'الأحد', rev: 1450 },
  { day: 'الإثنين', rev: 1100 }, { day: 'الثلاثاء', rev: 1600 },
  { day: 'الأربعاء', rev: 1750 }, { day: 'الخميس', rev: 1900 },
  { day: 'الجمعة', rev: 2100 },
];

const bookings = [
  { id: '#4021', client: 'عبدالله المطيري', service: 'غسيل خارجي + داخلي', time: '09:30 ص', status: 'مكتمل', amount: '150 ر.س' },
  { id: '#4022', client: 'فهد العتيبي', service: 'بوليش كامل', time: '10:15 ص', status: 'في الطريق', amount: '350 ر.س' },
  { id: '#4023', client: 'سارة القحطاني', service: 'غسيل خارجي', time: '11:00 ص', status: 'مؤكد', amount: '80 ر.س' },
  { id: '#4024', client: 'محمد الدوسري', service: 'تلميع + حماية سيراميك', time: '12:30 م', status: 'مكتمل', amount: '600 ر.س' },
  { id: '#4025', client: 'نورة الشمري', service: 'غسيل داخلي', time: '01:45 م', status: 'مؤكد', amount: '100 ر.س' },
];

const statusColor: Record<string, string> = {
  'مكتمل': 'bg-emerald-500/20 text-emerald-400',
  'في الطريق': 'bg-amber-500/20 text-amber-400',
  'مؤكد': 'bg-blue-500/20 text-blue-400',
};

const features = [
  { icon: BarChart3, title: 'التحليلات والتقارير', emoji: '📊', desc: 'تقارير يومية وأسبوعية وشهرية عن الإيرادات والحجوزات وأداء الموظفين. تصدير Excel + مخططات تفاعلية.' },
  { icon: Users, title: 'إدارة الموظفين والرواتب', emoji: '👥', desc: 'تتبّع دوام الموظفين، حساب الرواتب تلقائي، مكافآت وخصومات، وكشف رواتب جاهز للطباعة.' },
  { icon: Package, title: 'المخزون والموردين', emoji: '📦', desc: 'تتبّع المواد والكميات، تنبيهات نفاذ المخزون، وطلبات شراء تلقائية من الموردين.' },
  { icon: Navigation, title: 'الأسطول وGPS', emoji: '🚗', desc: 'تتبّع سيارات الغسيل المتنقل على الخريطة لحظياً، توزيع المهام، وتقارير المسافات.' },
  { icon: Megaphone, title: 'التسويق التلقائي', emoji: '📣', desc: 'حملات واتساب وSMS تلقائية، كوبونات خصم، وبرنامج ولاء يرجّع العميل مرة ثانية.' },
  { icon: Wallet, title: 'القوائم المالية', emoji: '💰', desc: 'قائمة دخل ومصاريف وميزانية. حساب ضريبة القيمة المضافة تلقائي + تقارير ZATCA جاهزة.' },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.55, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

/* ---- component ---- */
export default function Demo() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div dir="rtl" className="min-h-screen bg-[#040812] text-white font-sans">
      {/* ── Demo banner ── */}
      <div className="sticky top-0 z-50 bg-gradient-to-l from-blue-600 to-cyan-500 text-center py-2.5 px-4 text-sm font-medium flex flex-wrap items-center justify-center gap-2">
        <span>هذا عرض تجريبي — البيانات وهمية</span>
        <Link to="/onboard" className="underline underline-offset-2 font-bold hover:text-white/80 transition">
          أعجبك؟ سجّل الآن مجاناً <ExternalLink className="inline w-3.5 h-3.5 mb-0.5" />
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* ── Vendor header ── */}
        <motion.div {...fadeUp()} className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-2xl font-bold shrink-0">
            ن
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">مغسلة النخبة</h1>
            <p className="text-white/50 text-sm flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> الرياض — حي النرجس
            </p>
          </div>
        </motion.div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              {...fadeUp(i * 0.08)}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur p-4 sm:p-5"
            >
              <p className="text-white/45 text-xs sm:text-sm mb-1">{s.label}</p>
              <p className={`text-2xl sm:text-3xl font-extrabold bg-gradient-to-l ${s.color} bg-clip-text text-transparent`}>
                {s.value}
              </p>
            </motion.div>
          ))}
        </div>

        {/* ── Revenue chart ── */}
        <motion.div {...fadeUp(0.1)} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur p-5">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" /> إيرادات الأسبوع
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueData}>
              <XAxis dataKey="day" stroke="#ffffff30" tick={{ fill: '#ffffff70', fontSize: 12 }} />
              <YAxis stroke="#ffffff15" tick={{ fill: '#ffffff50', fontSize: 11 }} width={45} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #ffffff15', borderRadius: 12, direction: 'rtl', fontSize: 13 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: number) => [`${v.toLocaleString()} ر.س`, 'الإيراد']}
              />
              <Line type="monotone" dataKey="rev" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 4, fill: '#22d3ee' }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* ── Bookings table ── */}
        <motion.div {...fadeUp(0.1)} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur overflow-hidden">
          <h2 className="font-bold text-lg px-5 pt-5 pb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400" /> آخر الحجوزات
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-white/40 border-b border-white/[0.06]">
                  {['رقم الحجز', 'العميل', 'الخدمة', 'الوقت', 'الحالة', 'المبلغ'].map((h) => (
                    <th key={h} className="text-right font-medium px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map((b, i) => (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition"
                  >
                    <td className="px-5 py-3 font-mono text-white/60">{b.id}</td>
                    <td className="px-5 py-3">{b.client}</td>
                    <td className="px-5 py-3 text-white/70">{b.service}</td>
                    <td className="px-5 py-3 text-white/60">{b.time}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[b.status]}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold">{b.amount}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ── Feature cards ── */}
        <motion.div {...fadeUp(0.05)}>
          <h2 className="font-bold text-lg mb-4">وش بعد تقدر تسوي؟</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map((f, i) => {
              const open = expanded === i;
              return (
                <motion.button
                  key={f.title}
                  {...fadeUp(i * 0.06)}
                  onClick={() => setExpanded(open ? null : i)}
                  className="text-right w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 hover:bg-white/[0.05] transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{f.emoji}</span>
                      <span className="font-semibold text-sm">{f.title}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </div>
                  <AnimatePresence>
                    {open && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="text-white/55 text-sm leading-relaxed mt-3 overflow-hidden"
                      >
                        {f.desc}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Bottom CTA ── */}
        <motion.section
          {...fadeUp(0.1)}
          className="text-center rounded-3xl bg-gradient-to-br from-blue-600/20 to-cyan-500/10 border border-blue-500/20 p-8 sm:p-12"
        >
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">جاهز تبدأ؟</h2>
          <p className="text-white/60 mb-6 max-w-md mx-auto">
            سجّل الآن وجرّب 14 يوم مجاناً — بدون بطاقة ائتمانية
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/onboard"
              className="px-8 py-3.5 rounded-xl bg-gradient-to-l from-blue-500 to-cyan-400 font-bold text-base hover:opacity-90 transition"
            >
              ابدأ مجاناً
            </Link>
            <a
              href="https://wa.me/966500000000"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 rounded-xl border border-white/10 text-white/70 hover:text-white hover:border-white/25 transition text-sm"
            >
              أو تواصل معنا
            </a>
          </div>
          <p className="text-white/35 text-xs mt-5">بدون بطاقة ائتمانية | إلغاء في أي وقت</p>
        </motion.section>
      </div>
    </div>
  );
}
