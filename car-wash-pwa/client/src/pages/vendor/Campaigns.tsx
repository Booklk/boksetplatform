import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Users, Clock, CheckCircle, XCircle, Plus, Eye, MessageSquare } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../lib/api';

const SEGMENTS = [
  { value: 'all', label: 'كل العملاء', desc: 'جميع العملاء الذين أجروا حجزاً مكتملاً', icon: '👥' },
  { value: 'inactive_21', label: 'غير نشطين (21+ يوم)', desc: 'عملاء لم يغسلوا منذ أكثر من 21 يوماً', icon: '😴' },
  { value: 'inactive_14', label: 'غير نشطين (14+ يوم)', desc: 'عملاء لم يغسلوا منذ أكثر من 14 يوماً', icon: '💤' },
  { value: 'top_customers', label: 'أفضل العملاء', desc: 'العملاء الأكثر حجزاً (أول 50)', icon: '⭐' },
];

const TEMPLATES = [
  { label: 'كوبون خصم', text: '🎁 عرض خاص من {اسم المغسلة}!\n\nاحصل على خصم 15% على غسلتك القادمة باستخدام الكود: WASH15\n\nصالح حتى نهاية الأسبوع 🚗✨' },
  { label: 'تذكير الغسلة', text: '🚗 مرحباً!\n\nسيارتك تستحق الاهتمام 💧\n\nاحجز غسلتك الآن واستمتع بسيارة لامعة:\n{رابط الحجز}' },
  { label: 'عرض موسمي', text: '🌟 عرض محدود!\n\nهذا الأسبوع فقط — خصم خاص على الباقة الذهبية ✨\n\nاحجز الآن قبل انتهاء العرض:\n{رابط الحجز}' },
];

const STATUS_COLOR: Record<string, string> = {
  draft: 'text-slate-400',
  sending: 'text-amber-400',
  sent: 'text-emerald-400',
  failed: 'text-red-400',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة', sending: 'جاري الإرسال...', sent: 'تم الإرسال', failed: 'فشل',
};

export default function Campaigns() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', segment: 'all', message: '' });
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then(r => r.data),
  });

  const sendCampaign = useMutation({
    mutationFn: (d: typeof form) => api.post('/campaigns', d).then(r => r.data),
    onSuccess: () => {
      toast.success('تم بدء الإرسال في الخلفية ✓');
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      setShowForm(false);
      setForm({ name: '', segment: 'all', message: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'خطأ في الإرسال'),
  });

  async function previewSegment(segment: string) {
    setPreviewLoading(true);
    try {
      const { data } = await api.get(`/campaigns/preview/${segment}`);
      setPreviewCount(data.count);
    } catch { setPreviewCount(null); }
    setPreviewLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] p-4 sm:p-6 lg:p-8 text-white" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-3">
              <MessageSquare className="w-7 h-7 text-green-400" />
              حملات واتساب
            </h1>
            <p className="text-slate-400 text-sm mt-1">أرسل رسائل مستهدفة لشرائح عملائك</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-green-500/20 text-sm"
          >
            <Plus size={16} /> حملة جديدة
          </motion.button>
        </div>

        {/* Create Campaign Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 space-y-5"
            >
              <h2 className="text-lg font-bold">إنشاء حملة جديدة</h2>

              {/* Campaign name */}
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-1.5 block">اسم الحملة</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: عرض الجمعة البيضاء"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-green-500/50 text-sm" />
              </div>

              {/* Segment */}
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-2 block">الشريحة المستهدفة</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SEGMENTS.map(s => (
                    <button key={s.value} onClick={() => { setForm(f => ({ ...f, segment: s.value })); previewSegment(s.value); }}
                      className={`text-right p-3.5 rounded-xl border transition-all ${form.segment === s.value ? 'bg-green-500/20 border-green-500/50' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                    >
                      <span className="text-xl">{s.icon}</span>
                      <p className="text-white font-bold text-sm mt-1">{s.label}</p>
                      <p className="text-slate-400 text-xs">{s.desc}</p>
                    </button>
                  ))}
                </div>
                {form.segment && (
                  <p className="text-green-400 text-sm mt-2 flex items-center gap-1.5">
                    <Eye size={14} />
                    {previewLoading ? 'جاري الحساب...' : previewCount !== null ? `${previewCount} مستلم متوقع` : ''}
                  </p>
                )}
              </div>

              {/* Templates */}
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-2 block">قوالب جاهزة</label>
                <div className="flex gap-2 flex-wrap">
                  {TEMPLATES.map(t => (
                    <button key={t.label} onClick={() => setForm(f => ({ ...f, message: t.text }))}
                      className="text-xs bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1.5 rounded-lg text-slate-300 transition-all">
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-1.5 block">
                  نص الرسالة ({form.message.length}/1000)
                </label>
                <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  rows={5} maxLength={1000}
                  placeholder="اكتب رسالتك هنا..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-green-500/50 text-sm resize-none" />
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl bg-white/10 text-slate-300 text-sm font-bold">إلغاء</button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => sendCampaign.mutate(form)}
                  disabled={sendCampaign.isPending || !form.name || !form.message}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-xl text-sm"
                >
                  <Send size={15} />
                  {sendCampaign.isPending ? 'جاري الإرسال...' : 'إرسال الحملة'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Campaigns list */}
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />)}</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد حملات بعد — أنشئ حملتك الأولى</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c: any) => (
              <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold">{c.name}</span>
                    <span className={`text-xs font-bold ${STATUS_COLOR[c.status] ?? 'text-slate-400'}`}>
                      · {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm line-clamp-1">{c.message}</p>
                  <p className="text-slate-600 text-xs mt-1">
                    {SEGMENTS.find(s => s.value === c.segment)?.label} · {new Date(c.createdAt).toLocaleDateString('ar-SA')}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-white font-bold">{c.recipientCount ?? 0}</p>
                    <p className="text-slate-500 text-xs">مستلم</p>
                  </div>
                  <div className="text-center">
                    <p className="text-emerald-400 font-bold">{c.sentCount ?? 0}</p>
                    <p className="text-slate-500 text-xs">تم</p>
                  </div>
                  {(c.failedCount ?? 0) > 0 && (
                    <div className="text-center">
                      <p className="text-red-400 font-bold">{c.failedCount}</p>
                      <p className="text-slate-500 text-xs">فشل</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
