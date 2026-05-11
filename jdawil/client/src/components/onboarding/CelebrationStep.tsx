import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, ExternalLink, Copy, CreditCard, Globe, ArrowLeft, Sparkles, Share2, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface CelebrationStepProps {
  vendorName: string;
  slug: string;
  industryLabel: string;
  servicesCount: number;
  packagesCount: number;
}

/**
 * The "you built a complete store" moment.
 *
 * We literally walk the vendor through every component we configured
 * for them automatically — so they FEEL the value before paying.
 * Then we surface the only two actions left: connect a payment gateway
 * or buy a domain. Both are enhancements, not setup work.
 */
export function CelebrationStep({ vendorName, slug, industryLabel, servicesCount, packagesCount }: CelebrationStepProps) {
  const storeUrl = `${window.location.origin}/store/${slug}`;

  useEffect(() => {
    // Light haptic celebration if available
    try { (navigator as any).vibrate?.([60, 40, 60]); } catch { /* ignore */ }
  }, []);

  const copyLink = () => {
    navigator.clipboard?.writeText(storeUrl).then(
      () => toast.success('تم نسخ رابط المتجر'),
      () => {},
    );
  };

  const shareWhatsApp = () => {
    const text = `🎉 افتتحنا متجرنا الإلكتروني!\n\n${vendorName}\nاحجز موعدك مباشرة:\n${storeUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Everything auto-configured during signup. The vendor sees this as a
  // checklist of "value already delivered" — no setup work remains.
  const READY_ITEMS = [
    { label: `موقع حجوزات احترافي بـ ${industryLabel}`, sub: 'تصميم خاص لقطاعك' },
    { label: `${servicesCount} خدمة جاهزة + ${packagesCount} باقة بأسعار مرجعية`, sub: 'عدّلها متى ما تبي' },
    { label: 'قوالب رسائل واتساب لكل حالة', sub: 'تأكيد + تذكير + استرجاع عميل غائب' },
    { label: 'نظام طابور رقمي للزبائن', sub: 'أو حجز بمواعيد دقيقة — حسب نشاطك' },
    { label: 'لوحة تحكم كاملة', sub: 'CRM + تقارير + موظفين + رواتب + ولاء' },
    { label: 'تطبيق على الجوال (PWA)', sub: 'إشعارات فورية لكل حجز جديد' },
    { label: 'فاتورة زاتكا الإلكترونية', sub: 'بـ QR موحّد جاهز للاستخدام' },
    { label: 'بنود قانونية مخصصة لقطاعك', sub: 'متوافقة مع PDPL ZATCA' },
    { label: 'برنامج ولاء قابل للتفعيل', sub: 'نقاط أو بطاقة زيارات' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-10"
      dir="rtl"
    >
      {/* Hero */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="text-center mb-8"
      >
        <div className="inline-flex w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 items-center justify-center shadow-xl shadow-emerald-500/30 mb-5">
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white mb-3">
          متجرك جاهز للعمل! 🎉
        </h1>
        <p className="text-slate-300 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
          أنشأنا لك <span className="text-emerald-300 font-bold">متجراً متكاملاً</span> خلال دقائق.
          <br />
          لا يحتاج إعداد إضافي — فقط شارك الرابط وابدأ تستقبل حجوزات.
        </p>
      </motion.div>

      {/* Live store URL — the MOMENT */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-bl from-emerald-500/10 to-transparent p-5 mb-6"
      >
        <p className="text-emerald-300 text-xs font-bold mb-1 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          متجرك مباشر على الإنترنت
        </p>
        <p className="text-white font-black text-base sm:text-xl truncate" dir="ltr">
          {storeUrl}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <a
            href={storeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 bg-white text-slate-900 text-sm font-bold px-3.5 py-2 rounded-lg hover:bg-slate-100"
          >
            <ExternalLink className="w-3.5 h-3.5" /> افتح الآن
          </a>
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-sm font-bold px-3.5 py-2 rounded-lg"
          >
            <Copy className="w-3.5 h-3.5" /> نسخ
          </button>
          <button
            onClick={shareWhatsApp}
            className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold px-3.5 py-2 rounded-lg"
          >
            <MessageCircle className="w-3.5 h-3.5" /> شارك واتساب
          </button>
        </div>
      </motion.div>

      {/* What's ready — the value */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-6"
      >
        <h2 className="text-white font-bold text-base mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          ما حصلت عليه (كله جاهز، بدون إعداد)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {READY_ITEMS.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.04 }}
              className="flex items-start gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-3"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-white text-xs font-bold leading-tight">{item.label}</p>
                <p className="text-slate-500 text-[11px] mt-0.5 leading-tight">{item.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Optional next steps */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <h2 className="text-white font-bold text-base mb-1">خطوتان اختياريتان لتفعيل متجرك بالكامل</h2>
        <p className="text-slate-400 text-xs mb-4">ليست ضرورية — تستطيع البدء فوراً واستلام حجوزات بدفع نقدي عند الخدمة.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Payment gateway */}
          <Link
            to="/vendor/payment-gateway"
            className="group rounded-2xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-colors p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300">
                <CreditCard className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold bg-blue-500/20 text-blue-200 border border-blue-500/30 rounded-full px-2 py-0.5">
                موصى به
              </span>
            </div>
            <p className="text-white font-bold text-sm mb-1.5">اربط بوابة دفع لقبول الدفع أونلاين</p>
            <p className="text-slate-400 text-xs leading-relaxed mb-3">
              مدا، Apple Pay، STC Pay — يدخل المال مباشرة لحسابك.
              <span className="text-blue-300 font-bold"> Jdawil لا يلمس فلوسك.</span>
            </p>
            <span className="inline-flex items-center gap-1 text-blue-300 text-xs font-bold group-hover:gap-2 transition-all">
              اربط بوابة الدفع <ArrowLeft className="w-3 h-3 rotate-180" />
            </span>
          </Link>

          {/* Custom domain */}
          <Link
            to="/vendor/branding"
            className="group rounded-2xl border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 transition-colors p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300">
                <Globe className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold bg-purple-500/20 text-purple-200 border border-purple-500/30 rounded-full px-2 py-0.5">
                لمسة احترافية
              </span>
            </div>
            <p className="text-white font-bold text-sm mb-1.5">دومين خاص بك (yourbrand.sa)</p>
            <p className="text-slate-400 text-xs leading-relaxed mb-3">
              اشترِ دومين من أي مزوّد (GoDaddy / Namecheap / saudinic) واربطه بمتجرك خلال 5 دقائق.
              نوفّر لك دليل بالخطوات.
            </p>
            <span className="inline-flex items-center gap-1 text-purple-300 text-xs font-bold group-hover:gap-2 transition-all">
              ربط دومين <ArrowLeft className="w-3 h-3 rotate-180" />
            </span>
          </Link>
        </div>
      </motion.div>

      {/* Primary CTA */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between"
      >
        <p className="text-slate-400 text-xs">يمكنك تخطّي كل ما سبق وإدارة متجرك الآن.</p>
        <Link
          to="/vendor"
          className="inline-flex items-center justify-center gap-2 bg-white text-slate-900 font-black py-3 px-5 rounded-xl hover:bg-slate-100"
        >
          <Share2 className="w-4 h-4" /> ادخل لوحة التحكم
        </Link>
      </motion.div>
    </motion.div>
  );
}
