import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp } from 'lucide-react';
import api from '../../lib/api';

interface CountResponse {
  total: number;
  remaining: number;
}

/**
 * Live social proof: "1,234 منشأة سعودية تستخدم Jdawil • انضم لهم".
 * Pulled from /api/vendors/count/registered which is already public.
 * Quietly hides if the count fetch fails — never blocks the page.
 */
export function SocialProof({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<CountResponse | null>(null);

  useEffect(() => {
    api.get<CountResponse>('/vendors/count/registered')
      .then((r) => setData(r.data))
      .catch(() => {});
  }, []);

  if (!data || data.total < 5) return null;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 text-xs text-slate-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>
          <span className="text-white font-bold">+{data.total.toLocaleString('ar-SA')}</span> منشأة سعودية تستخدم Jdawil
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="inline-flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-full px-4 py-2"
    >
      <div className="flex -space-x-2 rtl:space-x-reverse">
        {['🚗', '💈', '🩺', '🔧'].map((emoji, i) => (
          <div
            key={i}
            className="w-7 h-7 rounded-full bg-indigo-500/20 border-2 border-[#0b1220] flex items-center justify-center text-xs"
          >
            {emoji}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs sm:text-sm">
        <Users className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-white font-bold">+{data.total.toLocaleString('ar-SA')}</span>
        <span className="text-slate-400">منشأة انضمت — انضم لهم</span>
      </div>
    </motion.div>
  );
}

/**
 * Industry-aware welcome message for the onboarding step 0.
 * Visitor selects industry → message updates to validate their choice.
 */
export function WelcomeProof({ industry }: { industry: string | null }) {
  const messages: Record<string, { tagline: string; benefit: string }> = {
    car_wash: { tagline: 'منصة #1 لمغاسل السيارات السعودية', benefit: 'متوسط زيادة الحجوزات: 40٪ في 90 يوم' },
    salon: { tagline: 'صالونك بأسلوب Booksy، لكن بدون عمولة', benefit: 'متوسط تخفيض الـ no-show: 75٪ بعد العربون' },
    clinic: { tagline: 'عيادات صغيرة سعودية تثق بنا', benefit: 'مواعيد بدون فوضى + ملف مريض رقمي' },
    spa: { tagline: 'مراكز سبا تحب راحة عميلاتها', benefit: 'باقات يوم كامل + اشتراك شهري = LTV ×3' },
    beauty_home: { tagline: 'متخصصات تجميل منزلي في كل المدن', benefit: 'عربون مدا/Apple Pay = حماية جدول كامل' },
    home_cleaning: { tagline: 'شركات تنظيف بنت سمعتها هنا', benefit: 'عقود B2B شهرية = إيراد ثابت' },
    appliance_repair: { tagline: 'فنيي صيانة الأجهزة', benefit: 'عقود سنوية = إيراد متراكم' },
    ac_maintenance: { tagline: 'موسم الحر = ذروة المكيفات', benefit: 'استجابة سريعة + GPS تتبّع = ثقة' },
    plumbing: { tagline: 'سباكون بسمعة عالية', benefit: 'رسم زيارة + كشف تسرّبات = هامش أعلى' },
    electrical: { tagline: 'كهربائيين B2B', benefit: 'عروض مشاريع + شهادات سلامة' },
    professional_services: { tagline: 'محامون ومستشارون يوفرون وقتهم', benefit: 'باقات شهرية + سرّية تامة' },
    freelancer: { tagline: 'فري لانسر يحجز عملاءه بنفسه', benefit: 'موقع باسمك + عربون + باقات' },
    other: { tagline: 'أي خدمة تحتاج حجوزات', benefit: 'خصّص خدماتك + احجز خلال دقائق' },
  };

  const msg = industry && messages[industry];
  if (!msg) return null;

  return (
    <motion.div
      key={industry}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 mb-4"
    >
      <div className="flex items-start gap-2">
        <TrendingUp className="w-4 h-4 text-emerald-300 mt-0.5 shrink-0" />
        <div>
          <p className="text-emerald-200 font-bold text-xs">{msg.tagline}</p>
          <p className="text-emerald-100/70 text-xs mt-0.5">{msg.benefit}</p>
        </div>
      </div>
    </motion.div>
  );
}
