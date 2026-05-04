import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShieldCheck, Download, FileText, History, Trash2 } from 'lucide-react';
import api from '../../lib/api';

interface PolicyVersionsResponse {
  versions: Record<string, string>;
  rights: Array<{ key: string; label: string; endpoint: string }>;
}

interface ConsentRow {
  id: number;
  scope: string;
  granted: boolean;
  documentVersion: string | null;
  createdAt: string;
  ip: string | null;
}

const SCOPE_LABEL: Record<string, string> = {
  cookies: 'Cookies',
  terms: 'الشروط والأحكام',
  privacy: 'سياسة الخصوصية',
  marketing: 'الرسائل التسويقية',
  data_processing: 'معالجة البيانات',
  photo_use: 'استخدام صور الخدمة',
};

export default function CustomerPrivacy() {
  const { data: meta } = useQuery<PolicyVersionsResponse>({
    queryKey: ['pdpl-policy-versions'],
    queryFn: async () => (await api.get('/pdpl/policy-versions')).data,
    staleTime: 60 * 60 * 1000,
  });

  const { data: consents = [] } = useQuery<ConsentRow[]>({
    queryKey: ['pdpl-my-consents'],
    queryFn: async () => (await api.get('/pdpl/my-consents')).data,
  });

  const downloadMyData = async () => {
    const res = await api.get('/pdpl/my-data', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `jdawil-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div dir="rtl" className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          خصوصيتك وحقوقك
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          متوافق مع نظام حماية البيانات الشخصية في المملكة العربية السعودية (PDPL).
        </p>
      </div>

      {/* Rights cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5"
        >
          <Download className="w-5 h-5 text-blue-300 mb-2" />
          <h3 className="text-white font-bold text-sm mb-1">حمّل كل بياناتك</h3>
          <p className="text-slate-400 text-xs leading-relaxed mb-3">
            ملف JSON واحد فيه: ملفك، حجوزاتك، نقاط الولاء، الإشعارات، وسجل موافقاتك.
          </p>
          <button
            onClick={downloadMyData}
            className="bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold px-3.5 py-2 rounded-lg"
          >
            تحميل ملف JSON
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5"
        >
          <Trash2 className="w-5 h-5 text-rose-300 mb-2" />
          <h3 className="text-white font-bold text-sm mb-1">احذف حسابك</h3>
          <p className="text-slate-400 text-xs leading-relaxed mb-3">
            تنتهي بياناتك خلال 30 يوم — بإمكانك التراجع خلال هذي الفترة.
          </p>
          <a
            href="/app/profile"
            className="inline-block bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold px-3.5 py-2 rounded-lg"
          >
            افتح حسابي
          </a>
        </motion.div>
      </div>

      {/* Policy versions */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-5">
        <h2 className="text-white font-bold text-base mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          الوثائق المعمول بها حالياً
        </h2>
        <ul className="space-y-1.5 text-sm">
          {meta?.versions && Object.entries(meta.versions).map(([scope, version]) => (
            <li key={scope} className="flex items-center justify-between text-slate-300">
              <span>{SCOPE_LABEL[scope] ?? scope}</span>
              <span className="text-slate-500 text-xs">إصدار {version}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Consent log */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-white font-bold text-base mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          سجل موافقاتك
        </h2>
        {consents.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">لا توجد موافقات مسجّلة</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {consents.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-white font-bold text-xs">{SCOPE_LABEL[c.scope] ?? c.scope}</p>
                  <p className="text-slate-500 text-[11px]">
                    {new Date(c.createdAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                    {c.documentVersion && <> • إصدار {c.documentVersion}</>}
                  </p>
                </div>
                <span className={`text-xs font-bold ${c.granted ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {c.granted ? 'موافق' : 'رفض'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
