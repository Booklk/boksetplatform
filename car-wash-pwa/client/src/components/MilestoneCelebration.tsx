/**
 * MilestoneCelebration — fires a confetti toast when the vendor crosses
 * key revenue or booking milestones. Stored in localStorage to show only once.
 */
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface Props {
  monthIncome?: number;
  totalBookings?: number;
}

const INCOME_MILESTONES = [
  { threshold: 1000,   label: 'أول ألف ريال 🎉',          sub: 'بداية رائعة! واصل الزخم' },
  { threshold: 5000,   label: '5,000 ريال هذا الشهر 🔥',  sub: 'مغسلتك تنمو بقوة!' },
  { threshold: 10000,  label: '10,000 ريال 🚀',            sub: 'وصلت لعشرة آلاف — أنت محترف' },
  { threshold: 25000,  label: '25,000 ريال 💎',            sub: 'ربع مليون في المتناول!' },
  { threshold: 50000,  label: '50,000 ريال 👑',            sub: 'نصف مليون سنوياً — ملك الغسيل' },
];

const BOOKING_MILESTONES = [
  { threshold: 1,   label: 'أول حجز في المنصة! 🎊',   sub: 'رحلة ألف ميل تبدأ بخطوة' },
  { threshold: 10,  label: '10 حجوزات مكتملة 🌟',     sub: 'الزبون العاشر دائماً يعود' },
  { threshold: 50,  label: '50 حجز 💪',               sub: 'نصف المئة — لا تتوقف الآن' },
  { threshold: 100, label: '100 حجز 🏆',              sub: 'الأول مئة — باقي الإنجازات أسهل' },
  { threshold: 500, label: '500 حجز 🎖️',             sub: 'خمسمئة — أنت في مستوى آخر' },
];

function celebrate() {
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 }, colors: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'] });
  setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.3 }, colors: ['#ec4899', '#3b82f6', '#22c55e'] }), 300);
}

export default function MilestoneCelebration({ monthIncome = 0, totalBookings = 0 }: Props) {
  useEffect(() => {
    if (monthIncome <= 0 && totalBookings <= 0) return;

    const reached: string[] = JSON.parse(localStorage.getItem('milestones-reached') ?? '[]');

    // Check income milestones
    for (const m of INCOME_MILESTONES) {
      const key = `income-${m.threshold}`;
      if (monthIncome >= m.threshold && !reached.includes(key)) {
        reached.push(key);
        localStorage.setItem('milestones-reached', JSON.stringify(reached));
        celebrate();
        toast(
          (t) => (
            <div className="flex items-start gap-3 font-arabic" dir="rtl">
              <span className="text-2xl">{m.label.split(' ').pop()}</span>
              <div>
                <p className="font-black text-white text-sm">{m.label.replace(/[🎉🔥🚀💎👑]/u, '').trim()}</p>
                <p className="text-slate-400 text-xs">{m.sub}</p>
              </div>
              <button onClick={() => toast.dismiss(t.id)} className="text-slate-600 hover:text-white text-sm shrink-0">✕</button>
            </div>
          ),
          {
            duration: 7000,
            style: { background: '#0f172a', border: '1px solid #8b5cf650', color: '#fff', borderRadius: '16px', maxWidth: '360px' },
          }
        );
        break; // only one at a time
      }
    }

    // Check booking milestones
    for (const m of BOOKING_MILESTONES) {
      const key = `bookings-${m.threshold}`;
      if (totalBookings >= m.threshold && !reached.includes(key)) {
        reached.push(key);
        localStorage.setItem('milestones-reached', JSON.stringify(reached));
        celebrate();
        toast(
          (t) => (
            <div className="flex items-start gap-3 font-arabic" dir="rtl">
              <span className="text-2xl">{m.label.split(' ').pop()}</span>
              <div>
                <p className="font-black text-white text-sm">{m.label.replace(/[🎊🌟💪🏆🎖️]/u, '').trim()}</p>
                <p className="text-slate-400 text-xs">{m.sub}</p>
              </div>
              <button onClick={() => toast.dismiss(t.id)} className="text-slate-600 hover:text-white text-sm shrink-0">✕</button>
            </div>
          ),
          {
            duration: 7000,
            style: { background: '#0f172a', border: '1px solid #10b98150', color: '#fff', borderRadius: '16px', maxWidth: '360px' },
          }
        );
        break;
      }
    }
  }, [monthIncome, totalBookings]);

  return null;
}
