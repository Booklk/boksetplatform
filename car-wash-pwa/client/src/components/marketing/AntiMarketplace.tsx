import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Crown, Coins, Lock, ChevronDown } from 'lucide-react';

/**
 * "Be your own marketplace" pitch — positions Jdawil against the
 * commission marketplaces (Findio, Mrsool-style apps, etc.) that
 * own the customer and skim the merchant's revenue.
 *
 * Includes a live calculator: vendor enters their bookings/avg ticket
 * + commission % and sees how much marketplace fees cost vs Jdawil's
 * flat 99 SAR.
 */
export function AntiMarketplace() {
  // Calculator state
  const [bookingsPerMonth, setBookingsPerMonth] = useState(80);
  const [avgTicketSar, setAvgTicketSar] = useState(120);
  const [commissionPct, setCommissionPct] = useState(20);
  const [showMethodology, setShowMethodology] = useState(false);

  const calc = useMemo(() => {
    const monthlyRevenue = bookingsPerMonth * avgTicketSar;
    const marketplaceCutMonthly = (monthlyRevenue * commissionPct) / 100;
    const jdawilMonthly = 99;
    const monthlyDelta = marketplaceCutMonthly - jdawilMonthly;
    const annualDelta = monthlyDelta * 12;
    return {
      monthlyRevenue,
      marketplaceCutMonthly,
      jdawilMonthly,
      monthlyDelta,
      annualDelta,
    };
  }, [bookingsPerMonth, avgTicketSar, commissionPct]);

  return (
    <section dir="rtl" className="bg-[#0b1220] py-20 px-4 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <span className="inline-block text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-full px-3 py-1 mb-4">
            تموقع جداول
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            تكون <span className="text-amber-300">صاحب علامتك</span>،
            <br />
            مش <span className="text-rose-400">عامل عند منصة</span>.
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto mt-4 leading-relaxed">
            تطبيقات مثل Findio و Mrsool تأخذ عميلك وتقتطع 20-25٪ من كل عملية.
            في Jdawil تدفع اشتراك ثابت 99 ر.س/شهر — وكل ريال إيراد يصلك كاملاً.
          </p>
        </motion.div>

        {/* 4 messages grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-14">
          {[
            {
              icon: Lock,
              title: 'احفظ عملاءك — هم يخصّونك أنت',
              body: 'في Findio عميلك ليس عميلك — هو عميل المنصة. يبدّل بضغطة. في Jdawil قاعدة عملائك ملكك تنزّلها Excel متى ما تشاء.',
              color: 'from-blue-500/20 to-blue-500/0 border-blue-500/30',
            },
            {
              icon: Coins,
              title: 'كسر سقف الأسعار',
              body: 'Findio يحدد لك السعر ويأخذ 20٪. في Jdawil أنت تحدد سعرك، تبيع باقات، تطلق عروض. الإيراد الإضافي كله لك.',
              color: 'from-amber-500/20 to-amber-500/0 border-amber-500/30',
            },
            {
              icon: Crown,
              title: 'علامتك التجارية مستقلة',
              body: 'يوم تشتهر، عميلك يبحث عنك بالاسم — في Findio يلقى منافسيك بجنبك. في Jdawil يفتح موقعك أو تطبيقك أنت فقط.',
              color: 'from-purple-500/20 to-purple-500/0 border-purple-500/30',
            },
            {
              icon: ChevronDown,
              title: 'أنت تنمو، اشتراكك ثابت',
              body: 'Findio يأخذ عمولة من كل ريال زائد. في Jdawil 99 ر.س ثابتة — سواء 10 حجز أو 1,000 حجز. النمو مالك.',
              color: 'from-emerald-500/20 to-emerald-500/0 border-emerald-500/30',
            },
          ].map((msg, i) => {
            const Icon = msg.icon;
            return (
              <motion.div
                key={msg.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className={`rounded-2xl border bg-gradient-to-bl ${msg.color} p-5`}
              >
                <Icon className="w-6 h-6 text-white mb-3" />
                <h3 className="text-white font-black text-base sm:text-lg mb-2">{msg.title}</h3>
                <p className="text-slate-300 text-sm leading-relaxed">{msg.body}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl border border-white/10 bg-gradient-to-bl from-amber-500/[0.06] via-transparent to-transparent p-6 sm:p-8"
        >
          <h3 className="text-white font-black text-xl sm:text-2xl mb-1 text-center">
            احسب: كم تكلّفك المنصات سنوياً مقابل Jdawil؟
          </h3>
          <p className="text-slate-400 text-sm text-center mb-6">
            مرّر الأرقام حسب نشاطك واطلع كم توفّر فعلاً.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Slider
              label="حجوزاتك شهرياً"
              value={bookingsPerMonth}
              onChange={setBookingsPerMonth}
              min={10}
              max={500}
              step={5}
              suffix="حجز"
            />
            <Slider
              label="متوسط قيمة الحجز"
              value={avgTicketSar}
              onChange={setAvgTicketSar}
              min={20}
              max={1000}
              step={10}
              suffix="ر.س"
            />
            <Slider
              label="عمولة المنصة المنافسة"
              value={commissionPct}
              onChange={setCommissionPct}
              min={5}
              max={35}
              step={1}
              suffix="٪"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 text-center">
              <p className="text-rose-300 text-xs font-bold mb-1">منصة عمولة (Findio مثلاً)</p>
              <p className="text-3xl font-black text-rose-200">
                {Math.round(calc.marketplaceCutMonthly).toLocaleString('ar-SA')} ر.س
              </p>
              <p className="text-xs text-slate-400 mt-1">شهرياً تخسر</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
              <p className="text-emerald-300 text-xs font-bold mb-1">Jdawil</p>
              <p className="text-3xl font-black text-emerald-200">
                {calc.jdawilMonthly} ر.س
              </p>
              <p className="text-xs text-slate-400 mt-1">شهرياً ثابتة</p>
            </div>
          </div>

          {calc.annualDelta > 0 && (
            <div className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-center">
              <p className="text-amber-200 text-sm font-bold">
                توفيرك السنوي مع Jdawil
              </p>
              <p className="text-4xl sm:text-5xl font-black text-amber-300 mt-2 leading-none">
                {Math.round(calc.annualDelta).toLocaleString('ar-SA')} ر.س
              </p>
              <p className="text-xs text-slate-400 mt-2">
                = راتب موظف إضافي، أو حملة تسويقية كاملة، أو معدات جديدة.
              </p>
            </div>
          )}

          <button
            onClick={() => setShowMethodology((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-300 mt-5 mx-auto block"
          >
            {showMethodology ? 'إخفاء' : 'كيف نحسب؟'}
          </button>
          {showMethodology && (
            <div className="mt-3 text-xs text-slate-400 leading-relaxed text-right max-w-2xl mx-auto">
              المعادلة: (حجوزاتك الشهرية × متوسط الحجز × عمولة المنصة) − 99 ر.س اشتراك Jdawil = توفيرك الشهري. الافتراض المحايد:
              منصات العمولة في السعودية تتراوح بين 15-25٪ حسب القطاع. غيّر النسبة حسب منافسك الفعلي.
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-slate-400 font-bold">{label}</label>
        <span className="text-sm text-white font-black">
          {value.toLocaleString('ar-SA')} {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-400"
      />
    </div>
  );
}
