import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Plus, Send, Eye, CheckCircle2, XCircle, Copy, ExternalLink } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

type Status = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
interface Quote {
  id: number;
  quoteNumber: string;
  recipientName: string;
  recipientPhone: string | null;
  title: string;
  totalSar: string;
  status: Status;
  publicShareToken: string;
  validUntil: string | null;
  createdAt: string;
  acceptedAt: string | null;
}

const STATUS_LABEL: Record<Status, string> = {
  draft: 'مسودة', sent: 'مُرسل', viewed: 'مُشاهد', accepted: 'مقبول', rejected: 'مرفوض', expired: 'منتهي',
};
const STATUS_COLOR: Record<Status, string> = {
  draft: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  sent: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  viewed: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  accepted: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  expired: 'border-slate-500/30 bg-slate-500/5 text-slate-500',
};

export default function VendorQuotations() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data: quotes = [] } = useQuery<Quote[]>({
    queryKey: ['vendor-quotations'],
    queryFn: async () => (await api.get('/quotations')).data,
  });

  const sendQuote = useMutation({
    mutationFn: async (id: number) => (await api.post(`/quotations/${id}/send`)).data,
    onSuccess: (resp) => {
      toast.success('تم الإرسال — تم تحديث الحالة');
      if (resp?.publicUrl) navigator.clipboard?.writeText(resp.publicUrl).catch(() => {});
      qc.invalidateQueries({ queryKey: ['vendor-quotations'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر الإرسال'),
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/quote/${token}`;
    navigator.clipboard?.writeText(url).then(() => toast.success('تم نسخ الرابط')).catch(() => {});
  };

  return (
    <div dir="rtl" className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-400" />
            عروض الأسعار
          </h1>
          <p className="text-slate-400 text-sm mt-1">أرسل عرض سعر احترافي + توقيع رقمي للعميل</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold px-4 py-2 rounded-xl"
        >
          <Plus className="w-4 h-4" /> عرض جديد
        </button>
      </div>

      {quotes.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-bold text-slate-300">لم تُنشئ عروض بعد</p>
          <p className="text-xs mt-1">عرض السعر الأول يأخذ دقيقتين — وتقدر ترسله واتساب مباشرة.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.map((q) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${STATUS_COLOR[q.status]}`}>
                      {STATUS_LABEL[q.status]}
                    </span>
                    <span className="text-slate-500 text-[11px]">#{q.quoteNumber}</span>
                  </div>
                  <h3 className="text-white font-bold text-sm">{q.title}</h3>
                  <p className="text-slate-400 text-xs mt-1">
                    {q.recipientName}
                    {q.recipientPhone && <span dir="ltr" className="text-slate-500"> • {q.recipientPhone}</span>}
                  </p>
                  <p className="text-emerald-300 font-bold text-sm mt-1">{q.totalSar} ر.س</p>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {(q.status === 'draft' || q.status === 'sent') && (
                    <button
                      onClick={() => sendQuote.mutate(q.id)}
                      className="flex items-center gap-1 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-bold px-2.5 py-1.5 rounded-lg"
                    >
                      <Send className="w-3 h-3" />
                      {q.status === 'draft' ? 'إرسال' : 'إعادة إرسال'}
                    </button>
                  )}
                  <button
                    onClick={() => copyLink(q.publicShareToken)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                  >
                    <Copy className="w-3 h-3" /> نسخ الرابط
                  </button>
                  <a
                    href={`/quote/${q.publicShareToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="w-3 h-3" /> فتح كعميل
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {showNew && <NewQuoteModal onClose={() => setShowNew(false)} onCreated={() => qc.invalidateQueries({ queryKey: ['vendor-quotations'] })} />}
    </div>
  );
}

interface Item { description: string; quantity: number; unitPriceSar: number; totalSar: number; }
function NewQuoteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState('');
  const [items, setItems] = useState<Item[]>([{ description: '', quantity: 1, unitPriceSar: 0, totalSar: 0 }]);
  const [validUntil, setValidUntil] = useState('');

  const updateItem = (i: number, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, ...patch };
      next.totalSar = (next.quantity || 0) * (next.unitPriceSar || 0);
      return next;
    }));
  };

  const subtotal = items.reduce((s, i) => s + i.totalSar, 0);
  const vat = +(subtotal * 0.15).toFixed(2);
  const total = +(subtotal + vat).toFixed(2);

  const submit = useMutation({
    mutationFn: async () =>
      (await api.post('/quotations', {
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim() || undefined,
        title: title.trim(),
        scope: scope.trim(),
        items: items.filter((i) => i.description.trim()),
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
      })).data,
    onSuccess: () => {
      toast.success('تم إنشاء العرض كمسودة');
      onCreated();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر الإنشاء'),
  });

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#0d1929] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-lg">عرض سعر جديد</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10 text-slate-400">
            <XCircle className="w-4 h-4 mx-auto" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="اسم العميل" className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm" />
          <input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="جوال العميل (اختياري)" dir="ltr" className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm" />
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان العرض (مثلاً: تمديد فيلا - الدور الأرضي)" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm mb-3" />
        <textarea value={scope} onChange={(e) => setScope(e.target.value)} placeholder="نطاق العمل المفصّل" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm h-24 mb-3 resize-none" />

        <p className="text-xs text-slate-400 mb-1.5">البنود</p>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-1.5 mb-1.5 items-center">
            <input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="الخدمة" className="col-span-6 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs" />
            <input type="number" min="0" value={it.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} placeholder="كمية" className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs" />
            <input type="number" min="0" step="0.01" value={it.unitPriceSar} onChange={(e) => updateItem(i, { unitPriceSar: Number(e.target.value) })} placeholder="سعر" className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs" />
            <span className="col-span-2 text-emerald-300 text-xs font-bold text-center">{it.totalSar.toFixed(2)}</span>
          </div>
        ))}
        <button onClick={() => setItems([...items, { description: '', quantity: 1, unitPriceSar: 0, totalSar: 0 }])} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold mb-3">+ بند جديد</button>

        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 mb-3 text-sm">
          <div className="flex justify-between text-slate-300"><span>المجموع قبل الضريبة</span><span className="font-bold">{subtotal.toFixed(2)} ر.س</span></div>
          <div className="flex justify-between text-slate-300"><span>ضريبة القيمة المضافة (15٪)</span><span className="font-bold">{vat.toFixed(2)} ر.س</span></div>
          <div className="flex justify-between text-emerald-300 font-black text-base mt-1 pt-2 border-t border-white/10"><span>الإجمالي</span><span>{total.toFixed(2)} ر.س</span></div>
        </div>

        <label className="block text-xs text-slate-400 mb-1.5">صالح حتى (اختياري)</label>
        <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm mb-4" />

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm hover:bg-white/5">إلغاء</button>
          <button
            onClick={() => recipientName && title && scope && submit.mutate()}
            disabled={!recipientName || !title || !scope || submit.isPending}
            className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold disabled:opacity-50"
          >
            {submit.isPending ? '...' : 'حفظ كمسودة'}
          </button>
        </div>
      </div>
    </div>
  );
}
