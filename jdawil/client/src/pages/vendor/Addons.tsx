/**
 * Vendor Add-ons page — buy / activate paid extensions on top of Pro.
 *
 * Each add-on card shows: name, price, features, current status, and a
 * single CTA. Toggle is the simplest possible activation; payment flow
 * gets bolted on top later via Moyasar.
 *
 * Route: /vendor/addons
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet, Bot, MapPin, CheckCircle2, Loader2, ArrowLeft,
  Sparkles, X, ShoppingBag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

type AddonId = 'financials' | 'ai_bot' | 'gps_basic' | 'gps_pro';

interface Addon {
  id: AddonId;
  nameAr: string;
  descriptionAr: string;
  priceSar: number;
  features: string[];
  category: 'finance' | 'automation' | 'tracking';
  active: boolean;
  overflow?: { unit: string; pricePerUnit: number; included: number };
}

interface AddonsResponse {
  active: string[];
  catalog: Addon[];
}

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  finance:    { label: 'مالية ومحاسبة',  icon: Wallet,  color: 'emerald' },
  automation: { label: 'أتمتة وذكاء',     icon: Bot,     color: 'orange' },
  tracking:   { label: 'تتبع GPS',          icon: MapPin,  color: 'sky' },
};

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', iconBg: 'bg-emerald-500/15' },
  orange:  { bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  text: 'text-orange-300',  iconBg: 'bg-orange-500/15'  },
  sky:     { bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     text: 'text-sky-300',     iconBg: 'bg-sky-500/15'     },
};

export default function Addons() {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<Addon | null>(null);

  const { data, isLoading } = useQuery<AddonsResponse>({
    queryKey: ['addons-me'],
    queryFn: () => api.get('/addons/me').then((r) => r.data),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enable }: { id: AddonId; enable: boolean }) =>
      api.post(`/addons/me/${id}/toggle`, { enable }),
    onSuccess: (_d, vars) => {
      toast.success(vars.enable ? 'تم تفعيل الإضافة' : 'تم إلغاء الإضافة');
      qc.invalidateQueries({ queryKey: ['addons-me'] });
      qc.invalidateQueries({ queryKey: ['vendor-profile'] });
      setConfirming(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل التحديث'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-400" />
      </div>
    );
  }

  const total = (data?.catalog ?? [])
    .filter((a) => a.active)
    .reduce((sum, a) => sum + a.priceSar, 0);

  // Group by category
  const byCategory = (data?.catalog ?? []).reduce<Record<string, Addon[]>>((acc, a) => {
    (acc[a.category] = acc[a.category] ?? []).push(a);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 lg:p-8 text-white" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black flex items-center gap-2.5">
            <ShoppingBag size={22} className="text-orange-400" />
            الإضافات
          </h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            ميزات إضافية اختيارية فوق باقتك. كل إضافة منفصلة بسعرها — فعّل ما تحتاجه فقط، وألغِ في أي وقت.
          </p>
          {total > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-1.5">
              <span className="text-xs text-orange-300">إجمالي الإضافات الشهرية:</span>
              <span className="text-sm font-black text-orange-400">{total} ر.س / شهر</span>
            </div>
          )}
        </div>

        {Object.entries(byCategory).map(([cat, addons]) => {
          const meta = CATEGORY_META[cat];
          if (!meta) return null;
          return (
            <div key={cat} className="mb-8">
              <h2 className="flex items-center gap-2 text-xs font-black text-white/60 mb-3 uppercase tracking-wider">
                <meta.icon size={14} />
                {meta.label}
              </h2>
              <div className="grid gap-3">
                {addons.map((addon) => (
                  <AddonCard
                    key={addon.id}
                    addon={addon}
                    onActivate={() => setConfirming(addon)}
                    onCancel={() => toggle.mutate({ id: addon.id, enable: false })}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <div className="mt-10 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <h3 className="text-sm font-black text-white mb-2">كيف تعمل الإضافات؟</h3>
          <ul className="text-xs text-slate-400 space-y-2">
            <li>• الإضافة تنشّط ميزتها فوراً، تشوفها في لوحة التحكم خلال ثوانٍ.</li>
            <li>• الفاتورة تُحسب نسبياً عن باقي الشهر عند التفعيل.</li>
            <li>• تقدر تلغي أي إضافة وقت ما تبي — تستمر حتى نهاية الشهر المدفوع.</li>
            <li>• GPS الاحترافي يشمل كل ميزات الأساسي (لا تحتاج الاثنين).</li>
          </ul>
        </div>
      </div>

      {/* Confirm activation modal */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={() => setConfirming(null)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-white">تأكيد التفعيل</h3>
                <button onClick={() => setConfirming(null)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                ستفعّل إضافة <span className="font-black text-orange-400">{confirming.nameAr}</span> بسعر{' '}
                <span className="font-black text-white">{confirming.priceSar} ر.س</span> شهرياً.
              </p>
              {confirming.overflow && (
                <p className="text-[11px] text-slate-400 mb-4">
                  بعد {confirming.overflow.included} {confirming.overflow.unit}: {confirming.overflow.pricePerUnit} ر.س لكل {confirming.overflow.unit} إضافية.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirming(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => toggle.mutate({ id: confirming.id, enable: true })}
                  disabled={toggle.isPending}
                  className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {toggle.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  فعّل الآن
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddonCard({
  addon, onActivate, onCancel,
}: {
  addon: Addon;
  onActivate: () => void;
  onCancel: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[addon.category];
  const c = COLOR_CLASSES[meta?.color ?? 'orange'];

  return (
    <div className={`rounded-2xl border ${addon.active ? c.border : 'border-white/8'} ${addon.active ? c.bg : 'bg-white/[0.02]'} overflow-hidden`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`w-11 h-11 rounded-xl ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
              <meta.icon size={20} className={c.text} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-sm font-black text-white">{addon.nameAr}</h3>
                {addon.active && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={10} /> مفعّل
                  </span>
                )}
              </div>
              <p className="text-[12px] text-slate-400 leading-relaxed">{addon.descriptionAr}</p>
            </div>
          </div>
          <div className="text-left flex-shrink-0">
            <div className="text-2xl font-black text-white leading-none">{addon.priceSar}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">ر.س / شهر</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-slate-400 hover:text-white mt-4 flex items-center gap-1 transition-colors"
        >
          {expanded ? 'إخفاء التفاصيل' : 'عرض كل المميزات'}
          <ArrowLeft size={10} className={`transition-transform ${expanded ? 'rotate-90' : '-rotate-90'}`} />
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
                {addon.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 size={12} className={`${c.text} flex-shrink-0 mt-0.5`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {addon.overflow && (
                <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                  ⓘ بعد {addon.overflow.included} {addon.overflow.unit}: {addon.overflow.pricePerUnit} ر.س لكل {addon.overflow.unit}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-white/5 px-5 py-3">
        {addon.active ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-bold text-slate-400 hover:text-red-300 transition-colors"
          >
            إلغاء التفعيل
          </button>
        ) : (
          <button
            type="button"
            onClick={onActivate}
            className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-xs font-black transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles size={12} />
            فعّل بـ {addon.priceSar} ر.س / شهر
          </button>
        )}
      </div>
    </div>
  );
}
