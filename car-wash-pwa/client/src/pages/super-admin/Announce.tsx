import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Megaphone, Send, CheckCircle } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function Announce() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const sendMutation = useMutation({
    mutationFn: () => api.post('/super-admin/announce', { title, body, type: 'system' }).then(r => r.data),
    onSuccess: (data) => {
      setSent(true);
      setSentCount(data.sent);
      toast.success(`تم إرسال الإعلان لـ ${data.sent} تاجر`);
    },
    onError: () => toast.error('فشل في الإرسال'),
  });

  if (sent) {
    return (
      <div className="text-center py-16 space-y-4" dir="rtl">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </motion.div>
        <h3 className="text-xl font-black text-white">تم إرسال الإعلان</h3>
        <p className="text-slate-500">وصل لـ {sentCount} تاجر</p>
        <button onClick={() => { setSent(false); setTitle(''); setBody(''); }} className="text-sm text-indigo-400 hover:text-indigo-300">إرسال إعلان آخر</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl" dir="rtl">
      <h2 className="text-xl font-black text-white flex items-center gap-2"><Megaphone className="w-5 h-5 text-amber-400" /> إرسال إعلان لكل التجار</h2>
      <p className="text-slate-500 text-sm">الإعلان يوصل كإشعار داخلي لكل أصحاب المشاريع المسجلين</p>

      <div>
        <label className="label">عنوان الإعلان</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: تحديث جديد — ميزة الفواتير الإلكترونية" className="input-field" maxLength={100} />
      </div>

      <div>
        <label className="label">محتوى الإعلان</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="اكتب تفاصيل الإعلان هنا..." className="input-field h-32 resize-none" maxLength={500} />
        <p className="text-xs text-slate-600 mt-1">{body.length}/500</p>
      </div>

      <button
        onClick={() => sendMutation.mutate()}
        disabled={!title.trim() || !body.trim() || sendMutation.isPending}
        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold px-6 py-3 rounded-xl transition-colors flex items-center gap-2"
      >
        <Send className="w-4 h-4" />
        {sendMutation.isPending ? 'جاري الإرسال...' : 'إرسال الإعلان'}
      </button>
    </div>
  );
}
