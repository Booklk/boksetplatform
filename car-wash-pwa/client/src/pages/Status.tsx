import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Activity, Database, Wifi } from 'lucide-react';
import api from '../lib/api';
import MarketingLayout from '../components/marketing/MarketingLayout';
import { MotivationalEmpty } from '../components/ui/MotivationalEmpty';

interface ServiceCheck {
  ok: boolean;
  latencyMs: number;
}
interface HealthPayload {
  ok: boolean;
  services: {
    api: ServiceCheck;
    database: ServiceCheck;
    websocket: ServiceCheck;
    replica?: ServiceCheck;
    whatsapp?: { ok: boolean; pending: number; oldestPendingMs: number };
  };
  infra?: {
    storage: 'local' | 's3';
    cache: 'redis' | 'memory';
    queue: 'redis' | 'memory';
    replica: boolean;
  };
  uptime: { bootedAt: string; seconds: number };
  incidents: Array<{ startedAt: string; resolvedAt: string | null; title: string; status: string }>;
  uptime90d: number;
  checkedAt: string;
}

function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d} يوم ${h} ساعة`;
  if (h > 0) return `${h} ساعة ${m} دقيقة`;
  return `${m} دقيقة`;
}

function ServiceRow({
  label,
  icon: Icon,
  ok,
  latencyMs,
}: {
  label: string;
  icon: typeof Database;
  ok: boolean;
  latencyMs: number;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-white text-sm font-bold">{label}</p>
          {latencyMs > 0 && (
            <p className="text-xs text-slate-500">استجابة: {latencyMs} مللي ثانية</p>
          )}
        </div>
      </div>
      <span
        className={`text-xs font-bold px-3 py-1 rounded-full ${
          ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
        }`}
      >
        {ok ? 'يعمل' : 'متوقف'}
      </span>
    </div>
  );
}

export default function Status() {
  const { data, isLoading, error } = useQuery<HealthPayload>({
    queryKey: ['system-status'],
    queryFn: async () => (await api.get('/system-status/health')).data,
    refetchInterval: 60_000,
    retry: 1,
  });

  const allOk = data?.ok ?? false;

  return (
    <MarketingLayout>
      <Helmet>
        <title>حالة المنصة — Jdawil</title>
        <meta name="description" content="حالة النظام لحظياً + سجل الأعطال + نسبة التشغيل لـ 90 يوم." />
        <link rel="canonical" href="https://jdawil.sa/status" />
      </Helmet>
      <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white">
        <div className="max-w-3xl mx-auto px-4 py-12">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${allOk ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/15 text-red-300 border border-red-500/30'}`}>
              {allOk ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  جميع الأنظمة تعمل بشكل طبيعي
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  هناك خلل حالياً — نعمل على إصلاحه
                </>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-black mt-5 mb-3">حالة المنصة</h1>
            <p className="text-slate-400 max-w-md mx-auto">
              فحص لحظي لـ Jdawil كل دقيقة. إذا واجهت مشكلة، تابع هذي الصفحة قبل ما تشكّ في اتصالك.
            </p>
          </div>

          {/* Services */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-5"
          >
            <h2 className="text-white font-bold text-base mb-2">الأنظمة</h2>
            {isLoading ? (
              <p className="text-slate-500 text-sm py-6 text-center">جاري الفحص…</p>
            ) : error ? (
              <p className="text-red-300 text-sm py-6 text-center">تعذّر الوصول للنظام</p>
            ) : data ? (
              <>
                <ServiceRow label="واجهة API" icon={Activity} ok={data.services.api.ok} latencyMs={data.services.api.latencyMs} />
                <ServiceRow label="قاعدة البيانات" icon={Database} ok={data.services.database.ok} latencyMs={data.services.database.latencyMs} />
                {data.services.replica && (
                  <ServiceRow label="قاعدة القراءة (Replica)" icon={Database} ok={data.services.replica.ok} latencyMs={data.services.replica.latencyMs} />
                )}
                <ServiceRow label="WebSocket (التتبع المباشر)" icon={Wifi} ok={data.services.websocket.ok} latencyMs={data.services.websocket.latencyMs} />
                {data.services.whatsapp && (
                  <ServiceRow
                    label={`واتساب — قائمة الانتظار${data.services.whatsapp.pending > 0 ? ` (${data.services.whatsapp.pending} رسالة معلقة)` : ''}`}
                    icon={Activity}
                    ok={data.services.whatsapp.ok}
                    latencyMs={Math.round(data.services.whatsapp.oldestPendingMs)}
                  />
                )}
              </>
            ) : null}
          </motion.div>

          {/* Uptime stats */}
          {data && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="grid grid-cols-2 gap-4 mb-5"
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
                <p className="text-xs text-slate-500 mb-1">نسبة التشغيل (90 يوم)</p>
                <p className="text-2xl font-black text-emerald-300">{data.uptime90d.toFixed(2)}٪</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
                <p className="text-xs text-slate-500 mb-1">آخر إعادة تشغيل</p>
                <p className="text-2xl font-black text-white">{formatUptime(data.uptime.seconds)}</p>
                <p className="text-[10px] text-slate-600 mt-1">منذ التشغيل</p>
              </div>
            </motion.div>
          )}

          {/* Incidents */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <h2 className="text-white font-bold text-base mb-3">سجل الأعطال (آخر 90 يوم)</h2>
            {data && data.incidents.length === 0 ? (
              <MotivationalEmpty
                icon={CheckCircle2}
                accent="emerald"
                title="لا أعطال خلال آخر 90 يوم"
                body="استقرار كامل — هدفنا الدائم 🎯"
              />
            ) : (
              <ul className="space-y-3">
                {data?.incidents.map((inc, i) => (
                  <li key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-white font-bold text-sm">{inc.title}</p>
                      <span className="text-xs text-slate-500">{inc.status}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      بدأ: {new Date(inc.startedAt).toLocaleString('ar-SA')}
                      {inc.resolvedAt && (
                        <>
                          {' • '}انتهى: {new Date(inc.resolvedAt).toLocaleString('ar-SA')}
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-600 mt-8">
            {data ? `آخر فحص: ${new Date(data.checkedAt).toLocaleTimeString('ar-SA')}` : ''}
          </p>
        </div>
      </div>
    </MarketingLayout>
  );
}
