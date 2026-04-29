/**
 * Marketing Campaigns — goal-driven wizard.
 *
 * The vendor picks WHY they're running a campaign (more bookings, win
 * back inactive customers, fill quiet days, launch new service) and the
 * page pre-fills audience + message + suggested promo automatically.
 *
 * One click "إطلاق الحملة" creates the promo code AND sends the WhatsApp
 * blast in the same call. No setting up segments or copy from scratch.
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Eye, Plus, MessageSquare, Target, Heart, Calendar,
  Sparkles, ChevronLeft, Check, Tag, Loader2, Copy, Share2, X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

// ─── Goal definitions ─────────────────────────────────────────────────────────

interface Goal {
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  segment: string;
  suggestedPromo: { code: string; type: 'percent' | 'fixed'; value: string; descriptionAr: string };
  messageTemplate: (vars: { vendor: string; bookingLink: string; code: string; discount: string }) => string;
}

const GOALS: Goal[] = [
  {
    id: 'more_bookings',
    title: 'حجوزات أكثر',
    desc: 'عرض جذاب لكل عملائك يدفعهم للحجز خلال أيام',
    icon: Target,
    segment: 'all',
    suggestedPromo: { code: 'BOOK15', type: 'percent', value: '15', descriptionAr: 'خصم 15% — حملة حجوزات أكثر' },
    messageTemplate: ({ vendor, bookingLink, code, discount }) =>
      `عرض خاص من ${vendor}\n\nاحصل على خصم ${discount}% على حجزك القادم باستخدام الكود: ${code}\n\nصالح هذا الأسبوع فقط.\n\nاحجز الآن: ${bookingLink}`,
  },
  {
    id: 'win_back',
    title: 'استرجاع العملاء الغائبين',
    desc: 'لعملاء ما حجزوا منذ أكثر من 21 يوم — تذكير + عرض مغري',
    icon: Heart,
    segment: 'inactive_21',
    suggestedPromo: { code: 'COMEBACK20', type: 'percent', value: '20', descriptionAr: 'خصم 20% — استرجاع العملاء الغائبين' },
    messageTemplate: ({ vendor, bookingLink, code, discount }) =>
      `وحشتنا في ${vendor}\n\nبما أنك ما زرتنا فترة، خصصنا لك خصم ${discount}%.\n\nالكود: ${code}\nاحجز: ${bookingLink}`,
  },
  {
    id: 'slow_day',
    title: 'ملء الأيام الهادئة',
    desc: 'لتشغيل أيام/أوقات قليلة الحجوزات بسعر مخفض',
    icon: Calendar,
    segment: 'top_customers',
    suggestedPromo: { code: 'QUIET25', type: 'percent', value: '25', descriptionAr: 'خصم 25% — ساعات الذروة المعكوسة' },
    messageTemplate: ({ vendor, bookingLink, code, discount }) =>
      `للأعضاء المميزين في ${vendor}\n\nاحجز يوم الأحد أو الاثنين واحصل على خصم ${discount}% — أوقاتنا الأهدأ، خدمتنا الأسرع.\n\nالكود: ${code}\nاحجز: ${bookingLink}`,
  },
  {
    id: 'new_service',
    title: 'إطلاق خدمة جديدة',
    desc: 'إخبار كل عملائك بخدمة جديدة + عرض افتتاحي',
    icon: Sparkles,
    segment: 'all',
    suggestedPromo: { code: 'NEW10', type: 'percent', value: '10', descriptionAr: 'افتتاحي — خدمة جديدة' },
    messageTemplate: ({ vendor, bookingLink, code, discount }) =>
      `جديد في ${vendor}\n\nأطلقنا خدمة جديدة وعرض افتتاحي خصم ${discount}% لأول 50 حجز.\n\nالكود: ${code}\nاحجز الآن: ${bookingLink}`,
  },
];

const SEGMENTS_META: Record<string, { label: string; desc: string }> = {
  all:            { label: 'كل العملاء',           desc: 'كل من حجز معك ولو مرة' },
  inactive_21:    { label: 'غائبون ٢١+ يوم',       desc: 'لم يحجزوا منذ أكثر من 21 يوماً' },
  inactive_14:    { label: 'غائبون ١٤+ يوم',       desc: 'لم يحجزوا منذ أكثر من 14 يوماً' },
  top_customers:  { label: 'أفضل ٥٠ عميل',         desc: 'الأكثر حجزاً عندك' },
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'text-slate-400', sending: 'text-amber-400', sent: 'text-emerald-400', failed: 'text-red-400',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة', sending: 'جاري الإرسال', sent: 'تم الإرسال', failed: 'فشل',
};

// ─── Wizard component ───────────────────────────────────────────────────────

function CampaignWizard({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [stage, setStage] = useState<'goal' | 'review'>('goal');
  const [goal, setGoal] = useState<Goal | null>(null);
  const [draft, setDraft] = useState<{ name: string; message: string; promo: Goal['suggestedPromo'] } | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const vendorName = user?.vendor?.nameAr ?? 'متجرك';
  const bookingLink = useMemo(() => {
    const slug = user?.vendor?.slug;
    return slug ? `${window.location.origin}/store/${slug}` : `${window.location.origin}`;
  }, [user]);

  const pickGoal = async (g: Goal) => {
    setGoal(g);
    const promo = { ...g.suggestedPromo };
    const message = g.messageTemplate({
      vendor: vendorName, bookingLink, code: promo.code, discount: promo.value,
    });
    setDraft({ name: g.title, message, promo });
    setStage('review');

    // Fetch audience size
    try {
      const r = await api.get(`/campaigns/preview/${g.segment}`);
      setPreviewCount(r.data.count ?? 0);
    } catch {
      setPreviewCount(null);
    }
  };

  const launch = useMutation({
    mutationFn: async () => {
      if (!goal || !draft) throw new Error('no draft');
      // 1. Create promo code (best-effort — campaign still goes out if dup code)
      try {
        await api.post('/promos', {
          code: draft.promo.code,
          discountType: draft.promo.type,
          discountValue: draft.promo.value,
          descriptionAr: draft.promo.descriptionAr,
          isActive: true,
        });
      } catch (e: any) {
        // duplicate code or validation error — keep going, vendor can adjust
        console.warn('[campaign] promo create failed:', e?.response?.data);
      }
      // 2. Send WhatsApp campaign
      return api.post('/campaigns', {
        name: draft.name,
        segment: goal.segment,
        message: draft.message,
      });
    },
    onSuccess: () => {
      toast.success('تم إطلاق الحملة + إنشاء كود الخصم');
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['promos'] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل إطلاق الحملة'),
  });

  const copyToClipboard = () => {
    if (!draft) return;
    navigator.clipboard.writeText(draft.message).catch(() => {});
    toast.success('نُسخت الرسالة');
  };

  const shareViaWhatsApp = () => {
    if (!draft) return;
    const url = `https://wa.me/?text=${encodeURIComponent(draft.message)}`;
    window.open(url, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
        className="bg-slate-900 border border-white/10 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <div className="flex items-center gap-2">
            {stage === 'review' && (
              <button onClick={() => setStage('goal')} className="text-slate-400 hover:text-white">
                <ChevronLeft size={18} className="rotate-180" />
              </button>
            )}
            <h2 className="text-base font-black text-white">
              {stage === 'goal' ? 'ايش هدفك من الحملة؟' : 'مراجعة وإطلاق'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {stage === 'goal' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 mb-3">اختر الهدف وسنجهّز لك الجمهور والرسالة وكود الخصم تلقائياً.</p>
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => pickGoal(g)}
                  className="w-full text-right p-4 rounded-xl bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/40 transition-all flex items-start gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                    <g.icon size={18} className="text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white">{g.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{g.desc}</p>
                  </div>
                  <ChevronLeft size={14} className="text-slate-500 mt-2 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {stage === 'review' && goal && draft && (
            <div className="space-y-5">
              {/* Audience */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400">الجمهور المستهدف</span>
                  {previewCount !== null && (
                    <span className="text-xs font-bold text-orange-400 flex items-center gap-1">
                      <Eye size={11} /> {previewCount} مستلم
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-white">{SEGMENTS_META[goal.segment]?.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{SEGMENTS_META[goal.segment]?.desc}</p>
              </div>

              {/* Promo */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400">كود الخصم</span>
                  <Tag size={12} className="text-orange-400" />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={draft.promo.code}
                    onChange={(e) => setDraft({ ...draft, promo: { ...draft.promo, code: e.target.value.toUpperCase() } })}
                    className="flex-1 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-orange-300 font-mono text-sm font-bold outline-none"
                  />
                  <span className="text-slate-500 text-xs">=</span>
                  <input
                    type="number"
                    value={draft.promo.value}
                    onChange={(e) => setDraft({ ...draft, promo: { ...draft.promo, value: e.target.value } })}
                    className="w-16 bg-slate-800/60 border border-white/10 rounded-lg px-2 py-2 text-white font-bold text-sm outline-none text-center"
                  />
                  <span className="text-slate-400 text-xs">{draft.promo.type === 'percent' ? '%' : 'ر.س'}</span>
                </div>
              </div>

              {/* Message */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400">الرسالة ({draft.message.length}/1000)</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={copyToClipboard} className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1">
                      <Copy size={10} /> نسخ
                    </button>
                    <button type="button" onClick={shareViaWhatsApp} className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1">
                      <Share2 size={10} /> مشاركة
                    </button>
                  </div>
                </div>
                <textarea
                  value={draft.message}
                  onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                  rows={7}
                  maxLength={1000}
                  className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-3 text-white text-sm leading-relaxed outline-none resize-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">قابل للتعديل قبل الإطلاق.</p>
              </div>

              {/* Launch */}
              <button
                type="button"
                onClick={() => launch.mutate()}
                disabled={launch.isPending || !draft.name || !draft.message || !draft.promo.code}
                className="w-full py-3.5 rounded-xl font-black text-white bg-orange-500 hover:bg-orange-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {launch.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {launch.isPending ? 'جاري الإطلاق...' : 'أطلق الحملة الآن'}
              </button>
              <p className="text-[11px] text-slate-500 text-center">
                نُنشئ كود الخصم في نظامك ونُرسل الرسالة لكل المستهدفين عبر واتساب.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Campaigns() {
  const [showWizard, setShowWizard] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery<Array<{
    id: number; name: string; segment: string; message: string; status: string;
    recipientCount?: number; sentCount?: number; failedCount?: number; createdAt: string;
  }>>({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then(r => r.data),
  });

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 lg:p-8 text-white" dir="rtl">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-black flex items-center gap-2.5">
              <MessageSquare className="w-6 h-6 text-orange-400" />
              الحملات التسويقية
            </h1>
            <p className="text-slate-400 text-sm mt-1.5">حملة جاهزة في أقل من دقيقة — اختر هدفك ونحن نجهّز الباقي</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-4 py-2.5 rounded-xl text-sm"
          >
            <Plus size={14} /> حملة جديدة
          </motion.button>
        </div>

        {/* Goal cards (always visible — entry points) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {GOALS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setShowWizard(true)}
              className="text-right p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/8 hover:border-orange-500/30 transition-all flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                <g.icon size={18} className="text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white">{g.title}</p>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{g.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Campaigns list */}
        <div className="border-t border-white/8 pt-6">
          <h2 className="text-sm font-black text-white mb-4">الحملات السابقة</h2>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد حملات بعد — أطلق حملتك الأولى من الأعلى</p>
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => (
                <div key={c.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-bold text-sm truncate">{c.name}</span>
                      <span className={`text-[10px] font-bold flex-shrink-0 ${STATUS_COLOR[c.status] ?? 'text-slate-400'}`}>
                        · {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs line-clamp-1">{c.message}</p>
                    <p className="text-slate-600 text-[10px] mt-1">
                      {SEGMENTS_META[c.segment]?.label} · {new Date(c.createdAt).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs flex-shrink-0">
                    <div className="text-center">
                      <p className="text-white font-bold">{c.recipientCount ?? 0}</p>
                      <p className="text-slate-500 text-[10px]">مستلم</p>
                    </div>
                    <div className="text-center">
                      <p className="text-emerald-400 font-bold">{c.sentCount ?? 0}</p>
                      <p className="text-slate-500 text-[10px]">تم</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showWizard && <CampaignWizard onClose={() => setShowWizard(false)} />}
      </AnimatePresence>
    </div>
  );
}
