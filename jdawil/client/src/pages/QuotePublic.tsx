import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, ShieldCheck, Printer } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

interface QuoteItem { description: string; quantity: number; unitPriceSar: number; totalSar: number; }
interface PublicQuote {
  id: number;
  quoteNumber: string;
  title: string;
  scope: string;
  items: QuoteItem[];
  subtotalSar: string;
  vatSar: string;
  totalSar: string;
  validUntil: string | null;
  termsText: string | null;
  notesToCustomer: string | null;
  status: string;
  recipientName: string;
  acceptedSignatureName: string | null;
  acceptedAt: string | null;
  vendorNameAr: string | null;
  vendorPhone: string | null;
  vendorLogoUrl: string | null;
}

export default function QuotePublic() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const [signature, setSignature] = useState('');
  const [showAccept, setShowAccept] = useState(false);

  const { data: q, isLoading } = useQuery<PublicQuote>({
    queryKey: ['quote-public', token],
    queryFn: async () => (await api.get(`/quotations/public/${token}`)).data,
    enabled: !!token,
  });

  const accept = useMutation({
    mutationFn: async () =>
      (await api.post(`/quotations/public/${token}/accept`, { signatureName: signature.trim() })).data,
    onSuccess: () => {
      toast.success('تم قبول العرض. سيتواصل معك المتجر قريباً.');
      qc.invalidateQueries({ queryKey: ['quote-public', token] });
      setShowAccept(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر القبول'),
  });

  const reject = useMutation({
    mutationFn: async () =>
      (await api.post(`/quotations/public/${token}/reject`)).data,
    onSuccess: () => {
      toast.success('تم رفض العرض');
      qc.invalidateQueries({ queryKey: ['quote-public', token] });
    },
  });

  if (isLoading || !q) {
    return <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white flex items-center justify-center">جاري التحميل…</div>;
  }

  const isAccepted = q.status === 'accepted';
  const isFinal = ['accepted', 'rejected', 'expired'].includes(q.status);

  return (
    <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white">
      <Helmet>
        <title>عرض سعر #{q.quoteNumber} — {q.vendorNameAr ?? 'Jdawil'}</title>
      </Helmet>

      <div className="max-w-3xl mx-auto p-4 sm:p-8 print:p-0">
        {/* Header card — bottom of the print page */}
        <div className="bg-white text-slate-900 rounded-3xl shadow-2xl p-6 sm:p-10 print:shadow-none print:rounded-none">
          {/* Vendor + meta */}
          <div className="flex items-start justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              {q.vendorLogoUrl && (
                <img src={q.vendorLogoUrl} alt="" className="w-14 h-14 rounded-xl object-cover" />
              )}
              <div>
                <h2 className="text-xl font-black text-slate-900">{q.vendorNameAr ?? 'مقدّم الخدمة'}</h2>
                {q.vendorPhone && <p className="text-xs text-slate-500" dir="ltr">{q.vendorPhone}</p>}
              </div>
            </div>
            <div className="text-left">
              <p className="text-xs text-slate-500">عرض سعر</p>
              <p className="font-black text-slate-900">#{q.quoteNumber}</p>
              <p className="text-xs text-slate-500 mt-1">إلى: {q.recipientName}</p>
            </div>
          </div>

          {/* Status badge */}
          {isFinal && (
            <div className={`mb-6 rounded-xl p-3 text-center font-bold ${
              isAccepted ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
              q.status === 'rejected' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
              'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {isAccepted ? '✅ تم قبول العرض' : q.status === 'rejected' ? '❌ تم رفض العرض' : '⏰ انتهت صلاحية العرض'}
              {isAccepted && q.acceptedSignatureName && (
                <div className="text-xs font-normal mt-1">
                  بتوقيع: {q.acceptedSignatureName} — {q.acceptedAt && new Date(q.acceptedAt).toLocaleString('ar-SA')}
                </div>
              )}
            </div>
          )}

          {/* Title + scope */}
          <h1 className="text-2xl font-black text-slate-900 mb-3">{q.title}</h1>
          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap mb-8">{q.scope}</p>

          {/* Items table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="text-right p-3 font-bold">الخدمة</th>
                  <th className="text-center p-3 font-bold w-16">كمية</th>
                  <th className="text-center p-3 font-bold w-24">السعر</th>
                  <th className="text-left p-3 font-bold w-24">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((it, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="p-3 text-slate-800">{it.description}</td>
                    <td className="p-3 text-center text-slate-600">{it.quantity}</td>
                    <td className="p-3 text-center text-slate-600">{it.unitPriceSar.toFixed(2)} ر.س</td>
                    <td className="p-3 text-left text-slate-800 font-bold">{it.totalSar.toFixed(2)} ر.س</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-6">
            <div className="flex justify-between text-slate-700 text-sm mb-1">
              <span>المجموع قبل الضريبة</span><span>{q.subtotalSar} ر.س</span>
            </div>
            <div className="flex justify-between text-slate-700 text-sm mb-2">
              <span>ضريبة القيمة المضافة (15٪)</span><span>{q.vatSar} ر.س</span>
            </div>
            <div className="flex justify-between text-slate-900 font-black text-lg pt-2 border-t border-slate-200">
              <span>الإجمالي</span><span className="text-emerald-700">{q.totalSar} ر.س</span>
            </div>
          </div>

          {q.notesToCustomer && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 text-sm text-blue-900 leading-relaxed">
              {q.notesToCustomer}
            </div>
          )}
          {q.termsText && (
            <details className="text-xs text-slate-600 mb-4">
              <summary className="cursor-pointer font-bold text-slate-700 mb-1">الشروط والأحكام</summary>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{q.termsText}</p>
            </details>
          )}
          {q.validUntil && (
            <p className="text-xs text-slate-500 mb-4">
              صالح حتى: {new Date(q.validUntil).toLocaleDateString('ar-SA', { dateStyle: 'long' })}
            </p>
          )}

          {/* Action bar */}
          {!isFinal && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-t border-slate-200 pt-5 print:hidden"
            >
              {!showAccept ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setShowAccept(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl"
                  >
                    <CheckCircle2 className="w-4 h-4" /> قبول وتوقيع رقمي
                  </button>
                  <button
                    onClick={() => confirm('رفض العرض؟') && reject.mutate()}
                    className="sm:w-32 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
                  >
                    رفض
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="sm:w-32 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center gap-1"
                  >
                    <Printer className="w-4 h-4" /> طباعة
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-emerald-900 font-bold text-sm mb-1">التوقيع الرقمي</p>
                  <p className="text-emerald-800 text-xs mb-3 leading-relaxed">
                    اكتب اسمك الكامل كما يظهر في هويتك. سيُعتبر هذا توقيعاً رقمياً ملزماً
                    لقبول العرض حسب نظام التعاملات الإلكترونية السعودي.
                  </p>
                  <input
                    type="text"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="الاسم الكامل"
                    className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2.5 text-slate-900 mb-3"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAccept(false)} className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-100">رجوع</button>
                    <button
                      onClick={() => signature.trim().length >= 2 && accept.mutate()}
                      disabled={signature.trim().length < 2 || accept.isPending}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {accept.isPending ? '...' : 'تأكيد القبول'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-slate-400 mt-8 print:mt-12">
            عرض سعر صادر عبر منصة <span className="font-bold">Jdawil</span> — موقّع رقمياً + متوافق مع نظام التعاملات الإلكترونية السعودي.
          </p>
        </div>
      </div>
    </div>
  );
}
