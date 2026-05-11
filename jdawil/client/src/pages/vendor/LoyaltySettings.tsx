import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Gift, Coins, Award, Power, ChevronDown } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

type ProgramType = 'disabled' | 'points' | 'punch_card';

interface LoyaltyProgram {
  id?: number;
  vendorId?: number;
  programType: ProgramType;
  pointsPerSAR: string;
  pointsValueInSAR: string;
  minRedeemPoints: number;
  washesRequired: number;
  freeWashPackageId?: number | null;
  freeWashDescription: string;
  isActive: boolean;
}

const DEFAULT: LoyaltyProgram = {
  programType: 'points',
  pointsPerSAR: '1',
  pointsValueInSAR: '0.05',
  minRedeemPoints: 100,
  washesRequired: 6,
  freeWashDescription: 'الزيارة السابعة مجانية',
  isActive: false,
};

interface Package {
  id: number;
  name: string;
  price: string;
}

export default function VendorLoyaltySettings() {
  const qc = useQueryClient();
  const [form, setForm] = useState<LoyaltyProgram>(DEFAULT);

  const { data, isLoading } = useQuery<LoyaltyProgram | null>({
    queryKey: ['loyalty-program-config'],
    queryFn: async () => {
      const r = await api.get('/loyalty/program');
      return r.data || null;
    },
  });

  const { data: packages = [] } = useQuery<Package[]>({
    queryKey: ['vendor-packages-flat'],
    queryFn: async () => {
      const services = (await api.get('/services')).data;
      return services.flatMap((s: any) => (s.packages ?? []).map((p: any) => ({
        id: p.id,
        name: `${s.name} — ${p.name}`,
        price: p.price,
      })));
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        programType: (data.programType ?? 'points') as ProgramType,
        pointsPerSAR: String(data.pointsPerSAR ?? '1'),
        pointsValueInSAR: String(data.pointsValueInSAR ?? '0.05'),
        minRedeemPoints: Number(data.minRedeemPoints ?? 100),
        washesRequired: Number(data.washesRequired ?? 6),
        freeWashPackageId: data.freeWashPackageId ?? null,
        freeWashDescription: data.freeWashDescription ?? 'الزيارة السابعة مجانية',
        isActive: Boolean(data.isActive),
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () =>
      (await api.put('/loyalty/program', {
        programType: form.programType,
        pointsPerSAR: form.pointsPerSAR,
        pointsValueInSAR: form.pointsValueInSAR,
        minRedeemPoints: form.minRedeemPoints,
        washesRequired: form.washesRequired,
        freeWashPackageId: form.freeWashPackageId ?? null,
        freeWashDescription: form.freeWashDescription,
        isActive: form.isActive,
      })).data,
    onSuccess: () => {
      toast.success('تم حفظ إعدادات الولاء');
      qc.invalidateQueries({ queryKey: ['loyalty-program-config'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر الحفظ'),
  });

  // Live example calculation
  const exampleSpend = 200;
  const ptsEarned = Math.round(exampleSpend * Number(form.pointsPerSAR || 0));
  const ptsValue = Number(form.pointsValueInSAR || 0);
  const redeemValue = ptsEarned * ptsValue;

  if (isLoading) {
    return <div className="p-6 text-center text-slate-400" dir="rtl">جاري التحميل…</div>;
  }

  return (
    <div dir="rtl" className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
          <Gift className="w-6 h-6 text-purple-400" />
          إعدادات برنامج الولاء
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          فعّل برنامج ولاء يناسب مشروعك — نقاط تتراكم أو "اطبع زيارات للزيارة المجانية".
        </p>
      </div>

      {/* Active toggle */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-5 mb-5 transition-colors ${
          form.isActive ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-white/[0.03]'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${form.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-500'}`}>
              <Power className="w-5 h-5" />
            </div>
            <div>
              <p className="text-white font-bold">{form.isActive ? 'البرنامج مفعّل' : 'البرنامج موقوف'}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {form.isActive ? 'العملاء يكسبون مكافآت من كل حجز' : 'لن يحصل العملاء على نقاط أو طوابع'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
            className={`relative w-14 h-8 rounded-full transition-colors ${form.isActive ? 'bg-emerald-500' : 'bg-white/10'}`}
            aria-label="تبديل التفعيل"
          >
            <span
              className={`absolute top-0.5 w-7 h-7 rounded-full bg-white shadow transition-all ${
                form.isActive ? 'right-0.5' : 'right-[26px]'
              }`}
            />
          </button>
        </div>
      </motion.section>

      {/* Program type */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-5"
      >
        <h2 className="text-white font-bold text-base mb-4">نوع البرنامج</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { key: 'points', icon: Coins, label: 'نقاط', desc: 'العميل يكسب نقاط مع كل حجز يستبدلها لاحقًا' },
            { key: 'punch_card', icon: Award, label: 'بطاقة زيارات', desc: 'بعد X زيارة، الزيارة التالية مجانًا' },
            { key: 'disabled', icon: Power, label: 'موقوف', desc: 'بدون مكافآت' },
          ] as const).map(({ key, icon: Icon, label, desc }) => (
            <button
              key={key}
              onClick={() => setForm((f) => ({ ...f, programType: key as ProgramType }))}
              className={`p-4 rounded-xl border-2 text-right transition-colors ${
                form.programType === key
                  ? 'border-purple-500 bg-purple-500/10 text-white'
                  : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20'
              }`}
            >
              <Icon className="w-5 h-5 mb-2 text-purple-300" />
              <p className="font-bold text-sm">{label}</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</p>
            </button>
          ))}
        </div>
      </motion.section>

      {/* Points config */}
      {form.programType === 'points' && (
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-5"
        >
          <h2 className="text-white font-bold text-base mb-4 flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            إعدادات النقاط
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">النقاط لكل ريال</label>
              <input
                type="number"
                step="0.5"
                min="0.1"
                value={form.pointsPerSAR}
                onChange={(e) => setForm((f) => ({ ...f, pointsPerSAR: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">العميل يكسب X نقطة لكل ريال يدفعه</p>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">قيمة النقطة بالريال</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.pointsValueInSAR}
                onChange={(e) => setForm((f) => ({ ...f, pointsValueInSAR: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">كم تساوي النقطة الواحدة من ريال</p>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">الحد الأدنى للاستبدال</label>
              <input
                type="number"
                min="10"
                value={form.minRedeemPoints}
                onChange={(e) => setForm((f) => ({ ...f, minRedeemPoints: Number(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">عدد النقاط المطلوبة لبدء الاستبدال</p>
            </div>
          </div>

          {/* Live example */}
          <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <p className="text-amber-200 text-xs font-bold mb-2">مثال على الإعدادات الحالية:</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              عميل دفع <span className="font-bold text-white">200 ر.س</span> يكسب{' '}
              <span className="font-bold text-amber-300">{ptsEarned} نقطة</span>.
              عند تجميع <span className="font-bold text-white">{form.minRedeemPoints} نقطة</span> يقدر يستبدلها بقيمة{' '}
              <span className="font-bold text-emerald-300">{(form.minRedeemPoints * ptsValue).toFixed(2)} ر.س</span>.
              <br />
              <span className="text-slate-400 text-xs">
                = نسبة استرداد {ptsValue && form.pointsPerSAR ? ((Number(form.pointsPerSAR) * ptsValue) * 100).toFixed(1) : '0'}٪ على المبلغ المدفوع.
              </span>
            </p>
          </div>
        </motion.section>
      )}

      {/* Punch card config */}
      {form.programType === 'punch_card' && (
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-5"
        >
          <h2 className="text-white font-bold text-base mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-400" />
            إعدادات بطاقة الزيارات
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">عدد الزيارات المطلوبة</label>
              <input
                type="number"
                min="2"
                max="20"
                value={form.washesRequired}
                onChange={(e) => setForm((f) => ({ ...f, washesRequired: Number(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">الزيارة التي تليها مجانية</p>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">الباقة المجانية</label>
              <select
                value={form.freeWashPackageId ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, freeWashPackageId: e.target.value ? Number(e.target.value) : null }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
              >
                <option value="">— اختر باقة —</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.price} ر.س)</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">رسالة العرض للعميل</label>
            <input
              type="text"
              value={form.freeWashDescription}
              onChange={(e) => setForm((f) => ({ ...f, freeWashDescription: e.target.value }))}
              maxLength={120}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
            />
          </div>

          <div className="mt-5 rounded-xl border border-purple-500/25 bg-purple-500/5 p-4">
            <p className="text-purple-200 text-xs font-bold mb-1">يظهر للعميل كذا:</p>
            <p className="text-slate-200 text-sm">
              {form.freeWashDescription} — اجمع <span className="font-bold text-purple-300">{form.washesRequired}</span> زيارة
              {form.freeWashPackageId
                ? ` لتحصل على ${packages.find((p) => p.id === form.freeWashPackageId)?.name ?? 'الباقة المختارة'} مجانًا!`
                : '.'}
            </p>
          </div>
        </motion.section>
      )}

      {/* Save */}
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-black text-sm px-6 py-3 rounded-xl disabled:opacity-50 transition-colors"
      >
        {save.isPending ? 'جاري الحفظ…' : 'حفظ الإعدادات'}
      </button>
    </div>
  );
}
