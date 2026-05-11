import { motion } from 'framer-motion';
import { Calendar, MapPin, Phone, Star, MessageCircle, Sparkles } from 'lucide-react';

interface LivePreviewProps {
  nameAr: string;
  industry: string | null;
  primaryColor: string;
  logoUrl?: string;
  city?: string;
}

const INDUSTRY_HERO: Record<string, { tagline: string; cta: string; showcase: string[] }> = {
  car_wash: {
    tagline: 'مغسلتك المتنقلة بضغطة',
    cta: 'احجز موعد غسيل',
    showcase: ['غسيل خارجي', 'غسيل كامل VIP', 'بوليش وتلميع'],
  },
  salon: {
    tagline: 'احجز موعدك بدون انتظار',
    cta: 'احجزي موعدك',
    showcase: ['قص شعر', 'صبغة احترافية', 'باقة عروس'],
  },
  clinic: {
    tagline: 'مواعيد دقيقة، رعاية متكاملة',
    cta: 'احجز موعد طبي',
    showcase: ['كشف عام', 'متابعة', 'استشارة'],
  },
  spa: {
    tagline: 'استرخاء يستحقّه يومك',
    cta: 'احجزي جلستك',
    showcase: ['مساج استرخائي', 'حمام مغربي', 'باقة يوم كامل'],
  },
  beauty_home: {
    tagline: 'تجميل بيدي خبيرة — في بيتك',
    cta: 'احجزي الآن',
    showcase: ['مكياج عروس', 'هيدرافيشل', 'مانيكير + بديكير'],
  },
  home_cleaning: {
    tagline: 'بيتك نظيف خلال ساعات',
    cta: 'احجز خدمة تنظيف',
    showcase: ['تنظيف شقة', 'تنظيف فيلا', 'تنظيف عميق'],
  },
  appliance_repair: {
    tagline: 'فني صيانة عند بابك',
    cta: 'اطلب فني',
    showcase: ['غسالة', 'ثلاجة', 'فرن + شاشات'],
  },
  ac_maintenance: {
    tagline: 'مكيفك بارد على طول',
    cta: 'احجز صيانة',
    showcase: ['تنظيف سبليت', 'شحن فريون', 'عقد صيانة سنوي'],
  },
  plumbing: {
    tagline: 'سباك جاهز — حتى الطوارئ',
    cta: 'اطلب فني',
    showcase: ['تسليك مجاري', 'كشف تسرب', 'صيانة عامة'],
  },
  electrical: {
    tagline: 'كهربائي معتمد — جاهز للمشاريع',
    cta: 'اطلب فني كهرباء',
    showcase: ['تركيب لوحة', 'كاميرات مراقبة', 'تمديد فيلا'],
  },
  professional_services: {
    tagline: 'استشارة احترافية بسرّية تامة',
    cta: 'احجز جلسة',
    showcase: ['استشارة قانونية', 'استشارة أعمال', 'مراجعة عقود'],
  },
  freelancer: {
    tagline: 'احجز جلستك مباشرة معي',
    cta: 'احجز الآن',
    showcase: ['جلسة عادية', 'جلسة مطوّلة', 'حزمة شهرية'],
  },
  other: {
    tagline: 'احجز خدمتك بسهولة',
    cta: 'احجز الآن',
    showcase: ['الخدمة الأولى', 'الخدمة الثانية', 'باقة شاملة'],
  },
};

/**
 * Live storefront preview that updates in real time as the vendor types
 * their info during onboarding. Uses iPhone-frame styling so the value
 * — "you'll have THIS" — is felt immediately.
 */
export function LivePreview({ nameAr, industry, primaryColor, logoUrl, city }: LivePreviewProps) {
  const hero = (industry && INDUSTRY_HERO[industry]) || INDUSTRY_HERO.other;
  const display = nameAr.trim() || 'متجرك';
  const initial = display.charAt(0);
  const accent = primaryColor || '#6366f1';

  return (
    <div className="relative" dir="rtl">
      {/* Sticky header label */}
      <div className="text-center mb-3">
        <p className="text-[11px] text-slate-500 uppercase tracking-wider">معاينة حية</p>
        <p className="text-xs text-slate-300">يتحدّث مع كل تعديل</p>
      </div>

      {/* Phone frame */}
      <div className="mx-auto w-[280px]">
        <div className="rounded-[2.5rem] border-[10px] border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
          {/* Notch */}
          <div className="bg-black h-6 flex items-center justify-center relative">
            <div className="w-20 h-4 bg-black rounded-full border border-slate-800" />
          </div>

          <div className="bg-slate-950 max-h-[560px] overflow-hidden">
            {/* Hero gradient header */}
            <motion.div
              key={accent}
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 1 }}
              className="relative px-4 pt-5 pb-6"
              style={{
                background: `linear-gradient(140deg, ${accent} 0%, ${accent}cc 50%, ${accent}77 100%)`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="w-9 h-9 rounded-lg object-cover bg-white/20" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center font-black text-white text-base">
                    {initial}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <motion.p
                    key={display}
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-white font-black text-sm leading-tight truncate"
                  >
                    {display}
                  </motion.p>
                  <div className="flex items-center gap-1 text-[9px] text-white/70">
                    <Star className="w-2 h-2 fill-yellow-300 text-yellow-300" />
                    <span>4.9</span>
                    <span className="opacity-60">(127)</span>
                  </div>
                </div>
              </div>

              <p className="text-white text-base font-bold leading-tight mb-1">
                {hero.tagline}
              </p>
              {city && (
                <p className="text-white/70 text-[10px] flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" /> {city}
                </p>
              )}

              <button
                disabled
                className="mt-3 w-full bg-white text-slate-900 text-xs font-black py-2 rounded-xl flex items-center justify-center gap-1"
                style={{ color: accent }}
              >
                <Calendar className="w-3 h-3" />
                {hero.cta}
              </button>
            </motion.div>

            {/* Services preview */}
            <div className="bg-slate-950 px-4 py-3">
              <p className="text-white text-xs font-bold mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> خدماتنا
              </p>
              <div className="space-y-1.5">
                {hero.showcase.map((s, i) => (
                  <motion.div
                    key={s}
                    initial={{ opacity: 0, x: 4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5"
                  >
                    <span className="text-white text-[11px]">{s}</span>
                    <span className="text-[9px] font-bold" style={{ color: accent }}>
                      احجز
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Quick contact bar */}
            <div className="bg-slate-900 px-4 py-2.5 border-t border-slate-800 flex items-center justify-around text-[10px] text-slate-400">
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> اتصال
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" /> واتساب
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> الموقع
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Caption under phone */}
      <p className="text-center text-[11px] text-slate-500 mt-4 max-w-[280px] mx-auto leading-relaxed">
        كل تعديل يصلك مباشرة على متجرك بدون إعادة تحميل.
      </p>
    </div>
  );
}
