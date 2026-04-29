import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Plus, Copy, Check, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../lib/api';

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  partially_used: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  redeemed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  expired: 'bg-red-500/20 text-red-400 border-red-500/30',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'نشطة', partially_used: 'مستخدمة جزئياً', redeemed: 'مستنفدة', expired: 'منتهية',
};

export default function GiftCards() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: 100, issuedTo: '', issuedToPhone: '', expiresInDays: 365 });
  const [search, setSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['gift-cards'],
    queryFn: () => api.get('/gift-cards').then(r => r.data),
  });

  const create = useMutation({
    mutationFn: (d: typeof form) => api.post('/gift-cards', d).then(r => r.data),
    onSuccess: (card) => {
      toast.success(`تم إنشاء البطاقة: ${card.code} ✓`);
      qc.invalidateQueries({ queryKey: ['gift-cards'] });
      setShowForm(false);
      setForm({ amount: 100, issuedTo: '', issuedToPhone: '', expiresInDays: 365 });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'خطأ'),
  });

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  const filtered = cards.filter((c: any) =>
    c.code.includes(search.toUpperCase()) ||
    c.issuedTo?.includes(search) ||
    c.issuedToPhone?.includes(search)
  );

  const totalValue = cards.filter((c: any) => c.status === 'active' || c.status === 'partially_used')
    .reduce((s: number, c: any) => s + Number(c.currentBalance), 0);

  return (
    <div className="min-h-screen bg-[#0a0f1e] p-4 sm:p-6 lg:p-8 text-white" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-3">
              <Gift className="w-7 h-7 text-amber-400" />
              بطاقات الهدايا
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {cards.length} بطاقة · رصيد نشط: <span className="text-amber-400 font-bold">{totalValue.toFixed(0)} ر.س</span>
            </p>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-amber-500/20"
          >
            <Plus size={16} /> بطاقة جديدة
          </motion.button>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 space-y-4"
            >
              <h2 className="text-lg font-bold">إنشاء بطاقة هدية</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase mb-1.5 block">قيمة البطاقة (ر.س)</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                    min={10} max={10000} step={10}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase mb-1.5 block">الصلاحية (أيام)</label>
                  <select value={form.expiresInDays} onChange={e => setForm(f => ({ ...f, expiresInDays: Number(e.target.value) }))}
                    className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none text-sm">
                    {[30, 60, 90, 180, 365].map(d => <option key={d} value={d}>{d} يوم</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase mb-1.5 block">اسم المستلم (اختياري)</label>
                  <input value={form.issuedTo} onChange={e => setForm(f => ({ ...f, issuedTo: e.target.value }))}
                    placeholder="مثال: أحمد محمد"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase mb-1.5 block">جوال المستلم (اختياري)</label>
                  <input value={form.issuedToPhone} onChange={e => setForm(f => ({ ...f, issuedToPhone: e.target.value }))}
                    placeholder="05xxxxxxxx" dir="ltr"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 text-sm" />
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gradient-to-l from-amber-950/50 to-orange-950/40 border border-amber-500/20 rounded-xl p-4 text-center">
                <p className="text-amber-400 text-xs font-bold mb-1">معاينة البطاقة</p>
                <p className="text-white text-2xl font-black">{form.amount} ريال</p>
                <p className="text-slate-400 text-xs mt-1">صالحة {form.expiresInDays} يوم من تاريخ الإصدار</p>
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl bg-white/10 text-slate-300 text-sm font-bold">إلغاء</button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => create.mutate(form)} disabled={create.isPending}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm"
                >
                  <Gift size={15} />
                  {create.isPending ? 'جاري الإنشاء...' : 'إنشاء البطاقة'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ابحث بالكود أو الاسم..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pr-11 pl-4 py-3 text-white placeholder-slate-500 focus:outline-none text-sm" />
        </div>

        {/* Cards list */}
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Gift size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد بطاقات هدايا</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c: any) => (
              <div key={c.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <Gift size={20} className="text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white font-mono font-bold text-sm">{c.code}</span>
                    <button onClick={() => copyCode(c.code)} className="text-slate-500 hover:text-white transition-colors">
                      {copiedCode === c.code ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                    <span className={`text-xs font-bold border px-2 py-0.5 rounded-full ${STATUS_STYLE[c.status] ?? ''}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    {c.issuedTo ? `${c.issuedTo}${c.issuedToPhone ? ` · ${c.issuedToPhone}` : ''}` : 'غير محدد'}
                  </p>
                </div>
                <div className="text-left flex-shrink-0">
                  <p className="text-white font-black">{Number(c.currentBalance).toFixed(0)} ر.س</p>
                  <p className="text-slate-500 text-xs">من {Number(c.originalAmount).toFixed(0)} ر.س</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
