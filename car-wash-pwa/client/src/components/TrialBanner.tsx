/**
 * TrialBanner — shows days remaining in free trial with urgency + value framing.
 * Appears at top of vendor dashboard. Dismissed after subscription upgrade.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

interface VendorData {
  subscriptionStatus: string;
  trialEndsAt?: string;
}

const TRIAL_TIPS: Record<number, { emoji: string; tip: string }> = {
  14: { emoji: '🎉', tip: 'مرحباً! استكشف لوحة التحكم وأضف أول خدمة لك' },
  13: { emoji: '📋', tip: 'جرّب إضافة أول حجز يدوياً من قسم "إضافة حجز"' },
  12: { emoji: '👥', tip: 'أضف موظفيك حتى يبدؤوا استقبال الحجوزات' },
  11: { emoji: '🔔', tip: 'فعّل واتساب لإرسال تذكيرات تلقائية للعملاء' },
  10: { emoji: '📊', tip: 'شاهد تقاريرك في قسم التحليلات' },
  9:  { emoji: '💳', tip: 'أضف بوابة الدفع حتى يدفع العملاء إلكترونياً' },
  8:  { emoji: '🎁', tip: 'جرّب برنامج الولاء — يزيد تكرار الحجوزات 20%' },
  7:  { emoji: '⭐', tip: 'الآن لديك أسبوع — تقييمات العملاء تُبنى من اليوم' },
  6:  { emoji: '🏷️', tip: 'أضف عرضاً خاصاً لأيام الأسبوع الهادئة' },
  5:  { emoji: '📱', tip: 'أرسل رابط مغسلتك لأصدقائك لتجربة التجربة الكاملة' },
  4:  { emoji: '🚀', tip: '4 أيام متبقية — المغاسل التي تستمر توفر 35 ساعة/شهر' },
  3:  { emoji: '⏰', tip: 'ثلاثة أيام فقط — قرر الآن وابقَ مع مغسلتك المنظمة' },
  2:  { emoji: '🔥', tip: 'يومان — من اشترك وفّر أكثر مما دفع في الشهر الأول' },
  1:  { emoji: '❗', tip: 'آخر يوم من تجربتك المجانية — احتفظ بكل بياناتك' },
};

export default function TrialBanner() {
  const { user } = useAuth();

  const { data: vendor } = useQuery<VendorData>({
    queryKey: ['my-vendor-trial'],
    queryFn: () => api.get('/vendors/me').then(r => r.data),
    enabled: !!user?.vendorId,
    staleTime: 60 * 60 * 1000,
  });

  if (!vendor || vendor.subscriptionStatus !== 'trial') return null;

  const trialEndsAt = vendor.trialEndsAt ? new Date(vendor.trialEndsAt) : null;
  if (!trialEndsAt || isNaN(trialEndsAt.getTime())) return null;

  const daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  if (daysLeft === 0) return null;

  const tipData = TRIAL_TIPS[daysLeft] ?? TRIAL_TIPS[7];

  const urgency = daysLeft <= 3;
  const gradFrom = urgency ? 'from-red-900/50' : daysLeft <= 7 ? 'from-amber-900/50' : 'from-violet-900/50';
  const gradTo   = urgency ? 'to-rose-950/40' : daysLeft <= 7 ? 'to-yellow-950/40' : 'to-indigo-950/40';
  const border   = urgency ? 'border-red-500/30' : daysLeft <= 7 ? 'border-amber-500/30' : 'border-violet-500/30';
  const pillBg   = urgency ? 'bg-red-500/20 text-red-300' : daysLeft <= 7 ? 'bg-amber-500/20 text-amber-300' : 'bg-violet-500/20 text-violet-300';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`mb-5 rounded-2xl border ${border} bg-gradient-to-l ${gradFrom} ${gradTo} backdrop-blur-sm p-4`}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0">{tipData.emoji}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${pillBg}`}>
                  {daysLeft} {daysLeft === 1 ? 'يوم' : 'أيام'} متبقية من التجربة المجانية
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-1 leading-snug">{tipData.tip}</p>
            </div>
          </div>

          <Link
            to="/vendor/platform-sub"
            className={`shrink-0 text-xs font-black px-4 py-2 rounded-xl transition-all ${
              urgency
                ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/30'
                : daysLeft <= 7
                ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/30'
                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/30'
            }`}
          >
            {urgency ? 'اشترك الآن — لا تخسر بياناتك' : 'استمر بعد التجربة'}
          </Link>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(((14 - daysLeft) / 14) * 100)}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full rounded-full ${urgency ? 'bg-red-500' : daysLeft <= 7 ? 'bg-amber-400' : 'bg-violet-500'}`}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-slate-600">البداية</span>
          <span className="text-[10px] text-slate-500">{14 - daysLeft} من 14 يوم مكتملة</span>
          <span className="text-[10px] text-slate-600">النهاية</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
